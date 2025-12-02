// frontend/src/__tests__/pages/MyTaxesPage.test.js
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyTaxesPage from '../../pages/MyTaxesPage';

// Мокаем API
jest.mock('../../api/taxpayersApi', () => ({
  getMyAccrualsWithPayments: jest.fn(),
  createTaxPayment: jest.fn(),
}));

jest.mock('../../components/ui/Spinner', () => () => <div>Loading...</div>);

describe('MyTaxesPage', () => {
  let queryClient;
  let mockGetAccruals;
  let mockCreatePayment;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    const taxpayersApi = require('../../api/taxpayersApi');
    mockGetAccruals = taxpayersApi.getMyAccrualsWithPayments;
    mockCreatePayment = taxpayersApi.createTaxPayment;

    // Mock данные
    mockGetAccruals.mockResolvedValue([
      {
        tax_accrual_id: 1,
        accrual_reason: 'Налог на имущество',
        accrual_amount: 15000,
        paid_amount: 0,
        remaining_amount: 15000,
        accrual_date: '2024-01-15',
        due_date: '2024-12-01',
        is_overdue: false,
        tax_type_name: 'Налог на имущество физических лиц',
        is_6ndfl_accrual: false,
        object_name: 'Квартира в Москве'
      }
    ]);
    mockCreatePayment.mockResolvedValue({ payment_id: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MyTaxesPage />
      </QueryClientProvider>
    );
  };

  test('should render page title and filters', async () => {
    renderComponent();

    expect(await screen.findByText('Мои налоговые начисления')).toBeInTheDocument();
    expect(screen.getByText('Фильтр начислений:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /все начисления/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /личные налоги/i })).toBeInTheDocument();
  });

  test('should display accrual cards with correct information', async () => {
    renderComponent();

    // Проверяем, что карточки отображаются
    expect(await screen.findByText('Налог на имущество')).toBeInTheDocument();
    
    // Проверяем статусы
    expect(screen.getByText('Ожидает оплаты')).toBeInTheDocument();
    
    // Ищем сумму - используем getAllByText так как их несколько
    const amountElements = screen.getAllByText('15 000,00 ₽');
    expect(amountElements.length).toBeGreaterThan(0);
  });

  test('should show payment modal when pay button clicked', async () => {
    renderComponent();

    await screen.findByText('Налог на имущество');

    // Находим кнопку "Оплатить" на карточке (не в модалке)
    const cardPayButtons = screen.getAllByText('Оплатить');
    // Первая кнопка - на карточке
    fireEvent.click(cardPayButtons[0]);

    // Проверяем, что модальное окно открылось
    expect(screen.getByText('Оплата налогового начисления')).toBeInTheDocument();
  });

  test('should handle payment submission', async () => {
    renderComponent();

    await screen.findByText('Налог на имущество');

    // Открываем модальное окно оплаты
    const cardPayButtons = screen.getAllByText('Оплатить');
    fireEvent.click(cardPayButtons[0]);

    // Ищем кнопку "Оплатить" внутри модального окна
    const modal = screen.getByText('Оплата налогового начисления').closest('.modal-content');
    const submitButton = within(modal).getByText('Оплатить');
    
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreatePayment).toHaveBeenCalled();
    });
  });

  test('should filter accruals by type', async () => {
    // Mock данные с разными типами начислений
    const mixedAccruals = [
      {
        tax_accrual_id: 1,
        accrual_reason: 'Личный налог',
        accrual_amount: 10000,
        paid_amount: 0,
        remaining_amount: 10000,
        accrual_date: '2024-01-01',
        due_date: '2024-12-01',
        is_overdue: false,
        tax_type_name: 'НДФЛ',
        is_6ndfl_accrual: false
      },
      {
        tax_accrual_id: 2,
        accrual_reason: 'НДФЛ за сотрудника',
        accrual_amount: 20000,
        paid_amount: 0,
        remaining_amount: 20000,
        accrual_date: '2024-02-01',
        due_date: '2024-12-01',
        is_overdue: false,
        is_6ndfl_accrual: true,
        declarant_info: {
          is_declarant: true,
          declarant_name: 'Иванов И.И.',
          target_name: 'Петров П.П.'
        }
      }
    ];

    mockGetAccruals.mockResolvedValueOnce(mixedAccruals);

    renderComponent();

    // Ждем загрузки
    await screen.findByText('Личный налог');

    // Фильтруем только личные налоги
    const ownTaxesButton = screen.getByText('Личные налоги');
    fireEvent.click(ownTaxesButton);

    expect(screen.getByText('Личный налог')).toBeInTheDocument();
    expect(screen.queryByText('НДФЛ за сотрудника')).not.toBeInTheDocument();
  });
});