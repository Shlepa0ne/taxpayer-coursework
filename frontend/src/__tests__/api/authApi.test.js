import { login, loginWorker, logout } from '../../api/authApi';
import axiosInstance from '../../api/axiosInstance';

jest.mock('../../api/axiosInstance');

describe('Auth API', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('login should store tokens and set headers', async () => {
    const mockResponse = { data: { access: 'token123', refresh: 'refresh123' } };
    axiosInstance.post.mockResolvedValue(mockResponse);

    const result = await login('1234567890', 'password');

    expect(localStorage.getItem('authTokens')).toBe(JSON.stringify(mockResponse.data));
    expect(axiosInstance.defaults.headers.common['Authorization']).toBe('Bearer token123');
    expect(result).toEqual(mockResponse.data);
  });
});