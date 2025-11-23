import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Импортируем все наши страницы
import LoginPage from './pages/LoginPage';
import LoginWorkersPage from './pages/LoginWorkersPage';
import DashboardPage from './pages/DashboardPage';
import MyTaxesPage from './pages/MyTaxesPage';
import TaxReduceRequestPage from './pages/TaxReduceRequestPage';
import Spinner from './components/ui/Spinner';
import WorkersDashboardPlaceholder from './pages/WorkersDashboardPlaceholder';

// Компонент-обертка для защиты роутов. Остается без изменений.
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const { accessToken, logout } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);

  // Логика проверки сессии остается без изменений.
  useEffect(() => {
    const verifySession = async () => {
      if (accessToken) {
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          const expirationTime = payload.exp * 1000;
          if (Date.now() >= expirationTime) {
            await logout();
          }
        } catch (e) {
          await logout();
        }
      }
      setIsVerifying(false);
    };
    verifySession();
  }, [accessToken, logout]);

  if (isVerifying) {
    return <Spinner />;
  }

  // Обновленная система роутинга.
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login-workers" element={<LoginWorkersPage/>} />

      <Route 
        path="/worker" 
        element={
          <ProtectedRoute>
            <WorkersDashboardPlaceholder />
          </ProtectedRoute>
        }
      />
      
      {/* Все защищенные роуты теперь являются дочерними для одного общего роута */}
      <Route 
        path="/*" // Звездочка означает "все, что не /login"
        element={
          <ProtectedRoute>
            {/* Каркас Dashboard теперь рендерится для всех страниц кабинета */}
            <DashboardPage />
          </ProtectedRoute>
        }
      >
        {/* Это вложенные (дочерние) роуты. Они будут рендериться внутри <Outlet /> в DashboardPage. */}
        <Route index element={<MyTaxesPage />} /> {/* index === path="/" */}
        <Route path="new-request" element={<TaxReduceRequestPage />} />
      </Route>
    </Routes>
  );
}

export default App;