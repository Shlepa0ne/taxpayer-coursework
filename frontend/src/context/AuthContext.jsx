// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [user, setUser] = useState(null); // Добавляем полные данные пользователя
  const [isLoading, setIsLoading] = useState(true);

  // Функция для проверки аутентификации и получения данных из токена
  const checkAuth = () => {
    const tokenString = localStorage.getItem('authTokens');
    if (tokenString) {
      try {
        const tokens = JSON.parse(tokenString);
        if (tokens.access) {
          // Проверяем, не истек ли токен
          const payload = JSON.parse(atob(tokens.access.split('.')[1]));
          if (payload.exp * 1000 > Date.now()) {
            setIsAuthenticated(true);
            setAccessToken(tokens.access);
            setUserRole(payload.user_type);
            
            // Устанавливаем полные данные пользователя из токена
            setUser({
              username: payload.inn,
              user_type: payload.user_type,
              inn: payload.inn // Добавляем ИНН явно
            });
            
            setIsLoading(false);
            return true;
          } else {
            // Токен истек - выходим
            logout();
          }
        }
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
    // Если токен невалиден или отсутствует
    setIsAuthenticated(false);
    setAccessToken(null);
    setUserRole(null);
    setUser(null);
    setIsLoading(false);
    return false;
  };

  // Проверяем аутентификацию при загрузке
  useEffect(() => {
    checkAuth();
  }, []);

  const login = (tokens) => {
    localStorage.setItem('authTokens', JSON.stringify(tokens));
    
    // Парсим данные пользователя из access токена
    const payload = JSON.parse(atob(tokens.access.split('.')[1]));
    
    setIsAuthenticated(true);
    setAccessToken(tokens.access);
    setUserRole(payload.user_type);
    setUser({
      username: payload.inn,
      user_type: payload.user_type,
      inn: payload.inn
    });
    setIsLoading(false);
  };

  const logout = async () => {
    const tokenString = localStorage.getItem('authTokens');
    if (tokenString) {
      const tokens = JSON.parse(tokenString);
      // Вызываем API logout если нужно
      // await logout(tokens.refresh);
    }
    localStorage.removeItem('authTokens');
    setIsAuthenticated(false);
    setAccessToken(null);
    setUserRole(null);
    setUser(null);
    setIsLoading(false);
  };

  const value = {
    isAuthenticated,
    accessToken,
    userRole,
    user, // Экспортируем полные данные пользователя
    isLoading,
    login,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}