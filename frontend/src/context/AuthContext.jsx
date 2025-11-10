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
          // Сохраняем токен доступа в состоянии
          setToken(data.key); // <--- ИЗМЕНЕНИЕ
          // Сохраняем токен доступа в localStorage, чтобы он не пропадал при перезагрузке
          localStorage.setItem('accessToken', data.key); // <--- ИЗМЕНЕНИЕ
        } catch (error) {
          // ...
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