import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import Spinner from './components/ui/Spinner'; // Нам понадобится спиннер

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const { accessToken, logout } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true); // Состояние проверки

  useEffect(() => {
    // Эта функция будет проверять валидность сессии при загрузке приложения
    const verifySession = async () => {
      if (accessToken) {
        try {
          // Мы можем декодировать токен, чтобы проверить срок его действия на клиенте
          // Это быстрее, чем делать запрос к API
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          const expirationTime = payload.exp * 1000; // в миллисекундах
          
          if (Date.now() >= expirationTime) {
            // Если access токен истек, мы могли бы здесь запустить silent refresh,
            // но для простоты и надежности при холодном старте - просто выходим.
            // Наш axios interceptor позаботится об обновлении во время активной сессии.
            console.log("Access token expired on load, logging out.");
            await logout();
          }
        } catch (e) {
          console.error("Invalid token on load, logging out.", e);
          await logout();
        }
      }
      setIsVerifying(false); // Завершаем проверку
    };

    verifySession();
  }, [accessToken, logout]); // Зависим от токена

  // Пока идет проверка, показываем глобальный спиннер
  if (isVerifying) {
    return <Spinner />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;