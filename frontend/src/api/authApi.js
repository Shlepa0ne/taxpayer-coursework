import axiosInstance from './axiosInstance';

// Функция для входа в систему
export const login = async (username, password) => {
  const { data } = await axiosInstance.post('/auth/token/', {
    username,
    password,
  });
  return data;
};

// Функция для обновления токена с помощью refresh токена
export const refreshToken = async (refresh) => {
  const { data } = await axiosInstance.post('/auth/token/refresh/', {
    refresh,
  });
  return data;
};

// Функция для безопасного выхода (добавляет refresh токен в черный список)
export const logout = async (refresh) => {
  await axiosInstance.post('/auth/logout/', {
    refresh,
  });
};