// frontend/src/__tests__/pages/worker/WorkerTaxpayerSearch.test.js
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkerTaxpayerSearch from '../../../pages/worker/WorkerTaxpayerSearch';

// Мокаем все зависимости
jest.mock('../../../api/workersApi', () => ({
  getRegions: jest.fn(),
  getCurrentWorker: jest.fn(),
  searchTaxpayers: jest.fn(),
  getTaxpayerDetail: jest.fn(),
  getRequestDetail: jest.fn(),
  updateRequestStatus: jest.fn(),
  updateDeclarationStatus: jest.fn(),
  updateTaxAccrual: jest.fn(),
  deleteContact: jest.fn(),
  deleteDocument: jest.fn(),
  deleteTaxableObject: jest.fn()
}));

jest.mock('../../../components/ui/Spinner', () => () => <div>Loading...</div>);

describe('WorkerTaxpayerSearch', () => {
  let queryClient;
  let workersApi;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    workersApi = require('../../../api/workersApi');
    
    // Мокируем API вызовы
    workersApi.getRegions.mockResolvedValue([
      { region_id: 1, region_name: 'Москва' },
      { region_id: 2, region_name: 'Санкт-Петербург' }
    ]);
    
    workersApi.getCurrentWorker.mockResolvedValue({
      worker_id: 1,
      fio: 'Тестовый Сотрудник',
      role_id: 1,
      can_review_requests: true
    });
    
    workersApi.searchTaxpayers.mockResolvedValue({ results: [] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <WorkerTaxpayerSearch />
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  test('should render basic search interface', async () => {
    await act(async () => {
      renderComponent();
    });

    // Ждем загрузки и проверяем основные элементы
    expect(await screen.findByText('Поиск налогоплательщика')).toBeInTheDocument();
    
    // Кнопка называется "Найти", а не "Поиск"
    expect(screen.getByRole('button', { name: /найти/i })).toBeInTheDocument();
    
    // Проверяем другие элементы
    expect(screen.getByPlaceholderText(/введите инн, фио/i)).toBeInTheDocument();
    expect(screen.getByText(/простой поиск/i)).toBeInTheDocument();
    expect(screen.getByText(/расширенный поиск/i)).toBeInTheDocument();
  });

  test('should show error when search fails', async () => {
    await act(async () => {
      renderComponent();
    });

    // Ждем загрузки компонента
    await screen.findByText('Поиск налогоплательщика');

    // Подготавливаем ошибку для следующего вызова
    workersApi.searchTaxpayers.mockRejectedValueOnce(new Error('Search failed'));

    // Находим форму поиска и кнопку
    const searchInput = screen.getByPlaceholderText(/введите инн, фио/i);
    const searchButton = screen.getByRole('button', { name: /найти/i });

    // Заполняем и отправляем форму
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'тестовый запрос' } });
      fireEvent.click(searchButton);
    });

    // Ждем появления ошибки
    await waitFor(() => {
      expect(screen.getByText(/ошибка при выполнении поиска/i)).toBeInTheDocument();
    });
  });

  test('should handle successful search', async () => {
    await act(async () => {
      renderComponent();
    });

    // Ждем загрузки компонента
    await screen.findByText('Поиск налогоплательщика');

    // Подготавливаем успешный ответ
    workersApi.searchTaxpayers.mockResolvedValueOnce({
      results: [
        {
          taxpayer_id: 1,
          inn: '1234567890',
          fio: 'Иванов Иван Иванович',
          payer_type_id: 1,
          registration_address: 'Москва, ул. Пушкина, д. 1'
        }
      ]
    });

    // Находим форму поиска и кнопку
    const searchInput = screen.getByPlaceholderText(/введите инн, фио/i);
    const searchButton = screen.getByRole('button', { name: /найти/i });

    // Заполняем и отправляем форму
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '1234567890' } });
      fireEvent.click(searchButton);
    });

    // Ждем результатов
    await waitFor(() => {
      expect(screen.getByText('Иванов Иван Иванович')).toBeInTheDocument();
      expect(screen.getByText('1234567890')).toBeInTheDocument();
    });
  });
});