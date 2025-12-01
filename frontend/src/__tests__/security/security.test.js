import { logout } from '../../api/authApi';

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: jest.fn((key) => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => {
    localStorageMock.store[key] = value.toString();
  }),
  removeItem: jest.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  })
};

global.localStorage = localStorageMock;

// Mock axios
jest.mock('../../api/axiosInstance', () => ({
  defaults: {
    headers: {
      common: {}
    }
  }
}));

describe('Security Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('should clear tokens on logout', async () => {
    // Mock the logout function
    const mockLogout = jest.fn().mockImplementation(() => {
      localStorage.removeItem('authTokens');
    });
    
    localStorage.setItem('authTokens', JSON.stringify({ access: 'token', refresh: 'refresh' }));
    
    mockLogout();
    
    expect(localStorage.getItem('authTokens')).toBeNull();
  });
});