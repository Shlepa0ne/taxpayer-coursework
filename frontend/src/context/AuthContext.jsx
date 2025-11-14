import React, { createContext, useState, useContext } from 'react';
import { login as apiLogin } from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Инициализируем состояние из localStorage
  const [authTokens, setAuthTokens] = useState(() => 
    localStorage.getItem('authTokens')
      ? JSON.parse(localStorage.getItem('authTokens'))
      : null
  );

  // Функция для входа в систему
  const login = async (username, password) => {
    try {
      // simple-jwt возвращает объект { access, refresh }
      const data = await apiLogin(username, password);
      
      // Сохраняем оба токена
      setAuthTokens(data);
      localStorage.setItem('authTokens', JSON.stringify(data));
      
    } catch (error) {
      console.error("Login failed:", error);
      // При ошибке очищаем токены
      logout();
      // Пробрасываем ошибку дальше, чтобы компонент LoginPage мог ее обработать
      throw error;
    }
  };

  // Функция для выхода из системы
  const logout = () => {
    setAuthTokens(null);
    localStorage.removeItem('authTokens');
    // В будущем здесь будет запрос к API для инвалидации refresh-токена
  };

  // Значение, которое будет доступно всем дочерним компонентам
  const contextValue = {
    // Предоставляем только accessToken для использования в заголовках
    accessToken: authTokens?.access,
    login,
    logout,
    // Флаг isAuthenticated теперь зависит от наличия токенов в состоянии
    isAuthenticated: !!authTokens,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Кастомный хук для удобного доступа к контексту
export const useAuth = () => {
  return useContext(AuthContext);
};