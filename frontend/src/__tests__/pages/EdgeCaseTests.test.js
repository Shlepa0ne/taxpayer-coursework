// frontend/src/__tests__/pages/EdgeCaseTests.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyTaxesPage from '../../pages/MyTaxesPage';
import * as taxpayersApi from '../../api/taxpayersApi';

// Мокаем API
jest.mock('../../api/taxpayersApi');

describe('Edge Cases Tests', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should handle large accrual amounts formatting', async () => {
    const largeAccrual = [{
      tax_accrual_id: 1,
      accrual_reason: 'Крупный налог',
      accrual_amount: 1234567.89,
      paid_amount: 0,
      remaining_amount: 1234567.89,
      accrual_date: '2024-01-01',
      due_date: '2024-12-31',
      is_overdue: false,
      tax_type_name: 'НДС',
      is_6ndfl_accrual: false
    }];

    taxpayersApi.getMyAccrualsWithPayments.mockResolvedValue(largeAccrual);

    render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <MyTaxesPage />
        </QueryClientProvider>
      </BrowserRouter>
    );

    // Используем getAllByText так как сумма может встречаться несколько раз
    await waitFor(() => {
      const amountElements = screen.getAllByText(/1 234 567,89 ₽/);
      expect(amountElements.length).toBeGreaterThan(0);
    });
  });
});