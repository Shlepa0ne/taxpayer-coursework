import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
});

// Перехватчик запросов для автоматического добавления токена авторизации
apiClient.interceptors.request.use(
  (config) => {
    // Получаем токен из localStorage
    const token = localStorage.getItem('accessToken');
    // Если токен существует, добавляем заголовок Authorization
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Функция для выполнения входа в систему
export const login = async (username, password) => {
  try {
    const response = await apiClient.post('/auth/login/', {
      username: username,
      password: password,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Функция для получения списка налогоплательщиков
export const getTaxpayers = async () => {
    try {
        // Этот запрос теперь автоматически будет содержать заголовок Authorization
        const response = await apiClient.get('/taxpayers/');
        return response.data;
    } catch (error) {
        throw error;
    }
}