import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:8000/api',
});

// Перехватчик запросов
axiosInstance.interceptors.request.use(
  (config) => {
    const tokenString = localStorage.getItem('authTokens');
    if (tokenString) {
      const tokens = JSON.parse(tokenString);
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Перехватчик ответов
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const tokenString = localStorage.getItem('authTokens');
        const oldRefreshToken = tokenString ? JSON.parse(tokenString).refresh : null;

        if (!oldRefreshToken) {
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Используем чистый axios.post, чтобы избежать цикла перехватчиков
        const response = await axios.post('http://localhost:8000/api/auth/token/refresh/', {
          refresh: oldRefreshToken
        });
        
        const newTokens = response.data;

        localStorage.setItem('authTokens', JSON.stringify(newTokens));
        originalRequest.headers['Authorization'] = `Bearer ${newTokens.access}`;

        // Повторяем оригинальный запрос с новым токеном
        return axiosInstance(originalRequest);

      } catch (refreshError) {
        localStorage.removeItem('authTokens');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;