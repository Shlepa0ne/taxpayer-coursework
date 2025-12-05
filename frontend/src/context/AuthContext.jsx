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
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Функция для проверки аутентификации и получения данных из токена и localStorage
  const checkAuth = () => {
  const tokenString = localStorage.getItem('authTokens');
  console.log('Auth debug - tokenString:', tokenString);

  if (tokenString) {
    try {
      const tokens = JSON.parse(tokenString);
      console.log('Auth debug - tokens object:', tokens);

      if (tokens.access) {
        const payload = JSON.parse(atob(tokens.access.split('.')[1]));
        console.log('Auth debug - token payload:', payload); // Должен показать role_id: 3

        if (payload.exp * 1000 > Date.now()) {
          setIsAuthenticated(true);
          setAccessToken(tokens.access);
          setUserRole(payload.user_type);
          
          // ВАЖНОЕ ИСПРАВЛЕНИЕ: убедитесь, что role_id берется из payload
          setUser({
            username: payload.inn,
            user_type: payload.user_type,
            inn: payload.inn,
            role_id: payload.role_id // Убедитесь, что это payload.role_id, а не tokens.role_id
          });
          
          console.log('Auth debug - user set to:', {
            username: payload.inn,
            user_type: payload.user_type,
            inn: payload.inn,
            role_id: payload.role_id
          });
          
          setIsLoading(false);
          return true;
        } else {
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

  // Слушаем события storage для синхронизации между вкладками
  useEffect(() => {
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = (tokens) => {
    localStorage.setItem('authTokens', JSON.stringify(tokens));
    
    const payload = JSON.parse(atob(tokens.access.split('.')[1]));
    
    setIsAuthenticated(true);
    setAccessToken(tokens.access);
    setUserRole(payload.user_type);
    setUser({
      username: payload.inn,
      user_type: payload.user_type,
      inn: payload.inn,
      role_id: payload.role_id // Убедитесь, что здесь тоже payload.role_id
    });
    setIsLoading(false);
  };

  const logout = async () => {
    const tokenString = localStorage.getItem('authTokens');
    if (tokenString) {
      const tokens = JSON.parse(tokenString);
      // Можно добавить вызов API logout если нужно
      // await authApi.logout(tokens.refresh);
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
    user,
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