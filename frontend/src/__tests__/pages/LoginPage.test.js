// frontend/src/__tests__/pages/LoginPage.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';

// Мокаем API
jest.mock('../../api/authApi', () => ({
  loginTaxpayer: jest.fn()
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

describe('LoginPage', () => {
  let mockLoginTaxpayer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockLogin.mockClear();
    
    const authApi = require('../../api/authApi');
    mockLoginTaxpayer = authApi.loginTaxpayer;
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
  };

  test('should call login API and auth context on successful login', async () => {
    const mockTokens = {
      access: 'access-token',
      refresh: 'refresh-token'
    };
    mockLoginTaxpayer.mockResolvedValueOnce(mockTokens);

    renderComponent();

    const innInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]');
    const submitButton = screen.getByRole('button', { name: /войти/i });

    fireEvent.change(innInput, { target: { value: '1234567890' } });
    fireEvent.change(passwordInput, { target: { value: 'correctpassword' } });
    
    // Создаем мок для preventDefault
    const mockPreventDefault = jest.fn();
    
    // Передаем event с preventDefault
    fireEvent.click(submitButton, { 
      preventDefault: mockPreventDefault 
    });

    await waitFor(() => {
      expect(mockLoginTaxpayer).toHaveBeenCalledWith({
        inn: '1234567890',
        password: 'correctpassword'
      });
      expect(mockLogin).toHaveBeenCalledWith({
        access: 'access-token',
        refresh: 'refresh-token',
        role: 'taxpayer'
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});