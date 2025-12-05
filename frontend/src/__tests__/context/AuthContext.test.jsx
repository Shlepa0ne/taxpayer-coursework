import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock the entire AuthContext to avoid complex JWT issues
jest.mock('../../context/AuthContext', () => {
  const originalModule = jest.requireActual('../../context/AuthContext');
  return {
    ...originalModule,
    // We'll test the actual implementation but handle the JWT decoding
  };
});

// Simple localStorage mock
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Test component that uses the auth context
const TestComponent = () => {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">
        {isAuthenticated ? 'authenticated' : 'not-authenticated'}
      </span>
      <button 
        onClick={() => login({ 
          access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiZXhwIjoxNzEwMDAwMDAwfQ.mock_signature', 
          refresh: 'mock-refresh' 
        })}
      >
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('should provide initial authentication state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status').textContent).toBe('not-authenticated');
  });

  test('should handle login with valid token structure', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Use a properly formatted JWT token
    const loginButton = screen.getByText('Login');
    
    await act(async () => {
      loginButton.click();
    });

    // Check if tokens were stored
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  test('should handle logout', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const logoutButton = screen.getByText('Logout');
    
    act(() => {
      logoutButton.click();
    });

    expect(localStorage.removeItem).toHaveBeenCalled();
  });
});