import React, { createContext, useState, useContext } from 'react';
import { login as apiLogin, logout as apiLogout } from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authTokens, setAuthTokens] = useState(() =>
    localStorage.getItem('authTokens')
      ? JSON.parse(localStorage.getItem('authTokens'))
      : null
  );

  const login = async (username, password) => {
    try {
      const data = await apiLogin(username, password);
      setAuthTokens(data);
      localStorage.setItem('authTokens', JSON.stringify(data));
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      const tokenString = localStorage.getItem('authTokens');
      const refreshToken = tokenString ? JSON.parse(tokenString).refresh : null;
      if (refreshToken) {
        await apiLogout(refreshToken);
      }
    } catch (error) {
      console.error("Ошибка при выходе на сервере:", error);
    } finally {
      setAuthTokens(null);
      localStorage.removeItem('authTokens');
    }
  };

  const contextValue = {
    accessToken: authTokens?.access,
    login,
    logout,
    isAuthenticated: !!authTokens,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};