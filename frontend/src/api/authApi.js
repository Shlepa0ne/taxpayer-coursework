import axiosInstance from './axiosInstance';

// Функция для выполнения входа в систему
export const login = async (username, password) => {
  const { data } = await axiosInstance.post('/auth/token/', {
    username,
    password,
  });
  return data;
};

// В будущем здесь будут refreshToken, logout и т.д.