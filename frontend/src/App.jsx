// frontend/src/App.js
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Импортируем все наши страницы
import LoginPage from './pages/LoginPage';
import LoginWorkersPage from './pages/LoginWorkersPage';
import DashboardPage from './pages/DashboardPage';
import DashboardHome from './pages/DashboardHome';
import MyTaxesPage from './pages/MyTaxesPage';
import TaxReduceRequestPage from './pages/TaxReduceRequestPage';
import DeclarationsPage from './pages/DeclarationsPage';
import Spinner from './components/ui/Spinner';
import WorkersDashboardPage from './pages/WorkersDashboardPage';
import WorkersDashboardHome from './pages/WorkersDashboardHome';
import ProfilePage from './pages/ProfilePage';

import WorkerTaxpayerSearch from './pages/worker/WorkerTaxpayerSearch';
import WorkerRequests from './pages/worker/WorkerRequests';
import WorkerDeclarations from './pages/worker/WorkerDeclarations';
import WorkerReports from './pages/worker/WorkerReports';
import WorkerAddWorker from './pages/worker/WorkerAddWorker';
import WorkerAddTaxpayer from './pages/worker/WorkerAddTaxpayer';
import WorkerProfile from './pages/worker/WorkerProfile';
import WorkerInspections from './pages/worker/WorkerInspections';

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

function WorkerRoleRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  
  console.log('WorkerRoleRoute debug:', {
    user,
    allowedRoles,
    userType: user?.user_type,
    userRoleId: user?.role_id,
    isWorker: user?.user_type === 'worker',
    hasAllowedRole: allowedRoles.includes(user?.role_id)
  });
  
  // Проверяем, что пользователь - сотрудник и имеет нужную роль
  if (user?.user_type !== 'worker') {
    console.log('Redirecting: not a worker');
    return <Navigate to="/" replace />;
  }
  
  // Проверяем роль пользователя
  if (!allowedRoles.includes(user?.role_id)) {
    console.log('Redirecting: role not allowed', user?.role_id, 'not in', allowedRoles);
    return <Navigate to="/worker" replace />;
  }
  
  return children;
}

// Компонент для редиректа в зависимости от роли
function RoleBasedRedirect() {
  const { user } = useAuth();
  
  if (user?.user_type === 'worker') {
    return <Navigate to="/worker" replace />;
  } else {
    return <Navigate to="/" replace />;
  }
}

function App() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login-workers" element={<LoginWorkersPage />} />

      {/* Личный кабинет сотрудника */}
      <Route 
        path="/worker/*"
        element={
          <ProtectedRoute>
            {user?.user_type === 'worker' ? (
              <WorkersDashboardPage />
            ) : (
              <Navigate to="/" replace />
            )}
          </ProtectedRoute>
        }
      >
        {/* Маршруты для всех инспекторов (роли 1, 2, 3) */}
        <Route index element={<WorkersDashboardHome />} />
        <Route path="search" element={<WorkerTaxpayerSearch />} />
        <Route path="requests" element={<WorkerRequests />} />
        <Route path="declarations" element={<WorkerDeclarations />} />
        <Route path="profile" element={<WorkerProfile />} />
        <Route path="inspections" element={<WorkerInspections />} />
        
        {/* Маршруты для старших инспекторов и руководителей (роли 2, 3) */}
        <Route 
          path="add-taxpayer" 
          element={
            <WorkerRoleRoute allowedRoles={[2, 3]}>
              <WorkerAddTaxpayer />
            </WorkerRoleRoute>
          } 
        />
        
        {/* Маршруты только для руководителей (роль 3) */}
        <Route 
          path="reports" 
          element={
            <WorkerRoleRoute allowedRoles={[3]}>
              <WorkerReports />
            </WorkerRoleRoute>
          } 
        />
        <Route 
          path="add-worker" 
          element={
            <WorkerRoleRoute allowedRoles={[3]}>
              <WorkerAddWorker />
            </WorkerRoleRoute>
          } 
        />
      </Route>
      
      {/* Личный кабинет налогоплательщика */}
      <Route 
        path="/*"
        element={
          <ProtectedRoute>
            {user?.user_type === 'taxpayer' ? (
              <DashboardPage />
            ) : (
              <Navigate to="/worker" replace />
            )}
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="accruals" element={<MyTaxesPage />} />
        <Route path="new-request" element={<TaxReduceRequestPage />} />
        <Route path="declarations" element={<DeclarationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="requests" element={<TaxReduceRequestPage />} />
      </Route>

      {/* Редирект для корневого пути */}
      <Route path="/" element={<RoleBasedRedirect />} />
    </Routes>
  );
}

export default App;