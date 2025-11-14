import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Компонент-обертка для защищенных роутов
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  
  // Если пользователь не аутентифицирован, перенаправляем его на страницу входа
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Если аутентифицирован, показываем запрошенный компонент
  return children;
}

function App() {
  return (
    <Routes>
      {/* Публичный роут: страница входа */}
      <Route path="/login" element={<LoginPage />} />

      {/* Защищенный роут: главная панель */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Можно добавить роут для "страница не найдена" */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;