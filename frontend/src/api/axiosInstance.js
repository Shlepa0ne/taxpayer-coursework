import axios from 'axios';

// Экземпляр axios с преднастроенным baseURL и интерцепторами
const axiosInstance = axios.create({
  baseURL: 'http://localhost:8000/api',
});

axiosInstance.interceptors.request.use(
  (config) => {
    // Получаем строку с токенами
    const tokenString = localStorage.getItem('authTokens');
    if (tokenString) {
      // Парсим JSON и берем accessToken
      const tokens = JSON.parse(tokenString);
      config.headers.Authorization = `Bearer ${tokens.access}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
