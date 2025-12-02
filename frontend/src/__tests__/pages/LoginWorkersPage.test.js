// frontend/src/__tests__/pages/LoginWorkersPage.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginWorkersPage from '../../pages/LoginWorkersPage';

// Мокаем API
jest.mock('../../api/authApi', () => ({
  loginWorker: jest.fn()
}));

// Мокаем навигацию
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Создаем мок функции login
const mockLogin = jest.fn();

// Мокаем контекст аутентификации
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

describe('LoginWorkersPage', () => {
  let mockLoginWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockLogin.mockClear();
    
    const authApi = require('../../api/authApi');
    mockLoginWorker = authApi.loginWorker;
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <LoginWorkersPage />
      </BrowserRouter>
    );
  };

  test('should handle successful worker login', async () => {
    const mockResponse = {
      access: 'worker-access-token',
      refresh: 'worker-refresh-token',
      role: { id: 1, name: 'inspector' }
    };
    mockLoginWorker.mockResolvedValueOnce(mockResponse);

    renderComponent();

    const innInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]');
    const submitButton = screen.getByRole('button', { name: /войти/i });

    fireEvent.change(innInput, { target: { value: '9876543210' } });
    fireEvent.change(passwordInput, { target: { value: 'workerpassword' } });
    
    // Создаем мок для preventDefault
    const mockPreventDefault = jest.fn();
    
    // Передаем event с preventDefault
    fireEvent.click(submitButton, { 
      preventDefault: mockPreventDefault 
    });

    await waitFor(() => {
      expect(mockLoginWorker).toHaveBeenCalledWith({
        inn: '9876543210',
        password: 'workerpassword'
      });
      expect(mockLogin).toHaveBeenCalledWith({
        access: 'worker-access-token',
        refresh: 'worker-refresh-token',
        role: { id: 1, name: 'inspector' }
      });
      expect(mockNavigate).toHaveBeenCalledWith('/worker');
    });
  });
});