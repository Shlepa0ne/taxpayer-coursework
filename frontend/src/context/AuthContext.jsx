import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as apiLogin } from '../api/apiService'; // Переименовываем импорт, чтобы избежать конфликта имен

// 1. Создаем сам контекст
const AuthContext = createContext(null);

// 2. Создаем компонент-провайдер. Он будет "оберткой" для всего приложения.
export const AuthProvider = ({ children }) => {
// Храним токен в состоянии. Начальное значение берем из localStorage.
const [token, setToken] = useState(localStorage.getItem('accessToken'));

// Функция для входа в систему
const login = async (username, password) => {
    try {
      const data = await apiLogin(username, password);
      setToken(data.access);
      localStorage.setItem('accessToken', data.access);
      // Возвращаем true в случае успеха для обработки в UI
      return true; 
    } catch (error) {
      console.error("Login failed:", error.response?.data || error.message);
      // Очищаем токен на случай, если там было что-то невалидное
      logout();
      // Возвращаем false для обработки в UI (например, показать сообщение об ошибке)
      return false;
    }
  };

  // Функция для выхода из системы
  const logout = () => {
    // Очищаем состояние
    setToken(null);
    // Очищаем localStorage
    localStorage.removeItem('accessToken');
  };

  // Значение, которое будет доступно всем дочерним компонентам
  const value = {
    token,
    login,
    logout,
    isAuthenticated: !!token, // Удобный флаг, чтобы проверять, есть ли токен
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 3. Создаем кастомный хук для удобного доступа к контексту
export const useAuth = () => {
  return useContext(AuthContext);
};