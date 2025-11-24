import React from 'react';
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

// Компонент-обертка для защиты роутов
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <Spinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <Spinner />;
  }

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
      
      <Route 
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      >
        <Route index element={<MyTaxesPage />} />
        <Route path="new-request" element={<TaxReduceRequestPage />} />
      </Route>
    </Routes>
  );
}

export default App;