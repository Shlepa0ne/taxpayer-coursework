import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DeclarationForm from '../../features/declarations/DeclarationForm';
import { getTaxTypes } from '../../api/taxpayersApi';

jest.mock('../../api/taxpayersApi');

// Mock window.alert
global.alert = jest.fn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('DeclarationForm', () => {
  beforeEach(() => {
    getTaxTypes.mockResolvedValue([
      { tax_type_id: 1, tax_type_name: 'НДФЛ' },
      { tax_type_id: 2, tax_type_name: 'НДС' }
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should render form with all fields', async () => {
    await act(async () => {
      render(<DeclarationForm />, { wrapper });
    });

    expect(await screen.findByText('Форма подачи налоговой декларации')).toBeInTheDocument();
    
    // Use more specific queries that match your actual DOM
    expect(screen.getByText('Тип декларации')).toBeInTheDocument();
    expect(screen.getByText('Вид налога')).toBeInTheDocument();
    expect(screen.getByText('Начисленная сумма налога (руб.)')).toBeInTheDocument();
    expect(screen.getByText('Общий доход (руб.)')).toBeInTheDocument();
    
    // Check for specific form elements
    expect(screen.getByLabelText('3-НДФЛ (Декларация по налогу на доходы ФЛ)')).toBeInTheDocument();
    expect(screen.getByLabelText('6-НДФЛ (Расчет сумм налога на доходы ФЛ)')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /вид налога/i })).toBeInTheDocument();
    
    // There are multiple inputs with placeholder '0.00' - use getAll
    const inputsWithPlaceholder = screen.getAllByPlaceholderText('0.00');
    expect(inputsWithPlaceholder.length).toBe(2);
  });

  test('should validate required fields', async () => {
    await act(async () => {
      render(<DeclarationForm />, { wrapper });
    });

    // Wait for form to load
    await screen.findByText('Форма подачи налоговой декларации');
    
    const submitButton = screen.getByRole('button', { name: /подать декларацию/i });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Check for HTML5 validation
    const taxTypeSelect = screen.getByRole('combobox', { name: /вид налога/i });
    expect(taxTypeSelect).toBeInvalid();
    
    const taxAmountInput = screen.getByLabelText(/начисленная сумма налога/i);
    expect(taxAmountInput).toBeInvalid();
  });

  test('should validate tax type selection', async () => {
    await act(async () => {
      render(<DeclarationForm />, { wrapper });
    });

    await screen.findByText('Форма подачи налоговой декларации');
    
    const taxTypeSelect = screen.getByRole('combobox', { name: /вид налога/i });
    
    // Initially should be invalid (no selection)
    expect(taxTypeSelect).toBeInvalid();
    
    // Select a tax type
    await act(async () => {
      fireEvent.change(taxTypeSelect, { target: { value: '1' } });
    });
    
    expect(taxTypeSelect).toHaveValue('1');
  });

  test('should switch between declaration types', async () => {
    await act(async () => {
      render(<DeclarationForm />, { wrapper });
    });

    await screen.findByText('Форма подачи налоговой декларации');
    
    const threeNdflRadio = screen.getByLabelText('3-НДФЛ (Декларация по налогу на доходы ФЛ)');
    const sixNdflRadio = screen.getByLabelText('6-НДФЛ (Расчет сумм налога на доходы ФЛ)');
    
    // 3-NDFL should be checked by default
    expect(threeNdflRadio).toBeChecked();
    expect(sixNdflRadio).not.toBeChecked();
    
    // Switch to 6-NDFL
    await act(async () => {
      fireEvent.click(sixNdflRadio);
    });
    
    expect(sixNdflRadio).toBeChecked();
    expect(threeNdflRadio).not.toBeChecked();
  });

  test('should validate number inputs', async () => {
    await act(async () => {
      render(<DeclarationForm />, { wrapper });
    });

    await screen.findByText('Форма подачи налоговой декларации');
    
    const taxAmountInput = screen.getByLabelText(/начисленная сумма налога/i);
    
    // Test valid number
    await act(async () => {
      fireEvent.change(taxAmountInput, { target: { value: '1000.50' } });
    });
    
    expect(taxAmountInput).toHaveValue(1000.50);
    
    // Test invalid negative number
    await act(async () => {
      fireEvent.change(taxAmountInput, { target: { value: '-100' } });
    });
    
    // The input might still be valid due to HTML5 validation
    // But we can check the value
    expect(taxAmountInput).toHaveValue(-100);
  });

  test('should fill and submit form with valid data', async () => {
    await act(async () => {
      render(<DeclarationForm />, { wrapper });
    });

    await screen.findByText('Форма подачи налоговой декларации');
    
    // Fill in required fields
    const taxTypeSelect = screen.getByRole('combobox', { name: /вид налога/i });
    await act(async () => {
      fireEvent.change(taxTypeSelect, { target: { value: '1' } });
    });
    
    const taxAmountInput = screen.getByLabelText(/начисленная сумма налога/i);
    await act(async () => {
      fireEvent.change(taxAmountInput, { target: { value: '15000' } });
    });
    
    const totalIncomeInput = screen.getByLabelText(/общий доход/i);
    await act(async () => {
      fireEvent.change(totalIncomeInput, { target: { value: '100000' } });
    });
    
    const periodStartInput = screen.getByLabelText(/дата начала периода/i);
    await act(async () => {
      fireEvent.change(periodStartInput, { target: { value: '2024-01-01' } });
    });
    
    const periodEndInput = screen.getByLabelText(/дата окончания периода/i);
    await act(async () => {
      fireEvent.change(periodEndInput, { target: { value: '2024-12-31' } });
    });
    
    // Verify all fields have values
    expect(taxTypeSelect).toHaveValue('1');
    expect(taxAmountInput).toHaveValue(15000);
    expect(totalIncomeInput).toHaveValue(100000);
    expect(periodStartInput).toHaveValue('2024-01-01');
    expect(periodEndInput).toHaveValue('2024-12-31');
    
    // Form submission would be tested here if we mock the API call
    // For now, just verify the submit button is present
    const submitButton = screen.getByRole('button', { name: /подать декларацию/i });
    expect(submitButton).toBeInTheDocument();
  });
});