// frontend/src/pages/WorkersDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentWorker } from '../api/workersApi';

const WorkersDashboardPage = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [workerData, setWorkerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkerData = async () => {
      try {
        if (user?.user_type === 'worker') {
          const data = await getCurrentWorker();
          setWorkerData(data);
        }
      } catch (error) {
        console.error('Error fetching worker data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkerData();
  }, [user]);

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getPosition = () => {
    if (!workerData) return 'Сотрудник';
    
    const roleMap = {
      1: 'Инспектор',
      2: 'Старший инспектор', 
      3: 'Руководитель'
    };
    
    return roleMap[workerData.role_id] || 'Сотрудник';
  };

  // Функция для рендеринга меню в зависимости от роли
  const renderMenuItems = () => {
    if (!workerData) return null;

    const roleId = workerData.role_id;
    
    // Базовые пункты меню для всех ролей
    const baseMenuItems = (
      <>
        <li className="nav-item mb-2">
          <Link 
            to="/worker" 
            className={`nav-link ${isActive('/worker') && location.pathname === '/worker' ? 'active' : ''}`}
          >
            <i className="bi bi-speedometer2 me-2"></i>
            Обзор
          </Link>
        </li>
        <li className="nav-item mb-2">
          <Link 
            to="/worker/search" 
            className={`nav-link ${isActive('/worker/search') ? 'active' : ''}`}
          >
            <i className="bi bi-search me-2"></i>
            Поиск налогоплательщика
          </Link>
        </li>
        <li className="nav-item mb-2">
          <Link 
            to="/worker/requests" 
            className={`nav-link ${isActive('/worker/requests') ? 'active' : ''}`}
          >
            <i className="bi bi-file-earmark-text me-2"></i>
            Заявления
          </Link>
        </li>
        <li className="nav-item mb-2">
          <Link 
            to="/worker/declarations" 
            className={`nav-link ${isActive('/worker/declarations') ? 'active' : ''}`}
          >
            <i className="bi bi-file-earmark-pdf me-2"></i>
            Декларации
          </Link>
        </li>
      </>
    );

    // Дополнительные пункты для старших инспекторов и руководителей
    const seniorMenuItems = roleId >= 2 && (
      <>
        <li className="nav-item mb-2">
          <Link 
            to="/worker/add-taxpayer" 
            className={`nav-link ${isActive('/worker/add-taxpayer') ? 'active' : ''}`}
          >
            <i className="bi bi-person-badge me-2"></i>
            Регистрация нового плательщика
          </Link>
        </li>
        <li className="nav-item mb-2">
          <Link 
            to="/worker/inspections" 
            className={`nav-link ${isActive('/worker/inspections') ? 'active' : ''}`}
          >
            <i className="bi bi-clipboard-check me-2"></i>
            Проверки
          </Link>
        </li>
      </>
    );

    // Дополнительные пункты только для руководителей
    const managerMenuItems = roleId === 3 && (
      <>
        <li className="nav-item mb-2">
          <Link 
            to="/worker/reports" 
            className={`nav-link ${isActive('/worker/reports') ? 'active' : ''}`}
          >
            <i className="bi bi-graph-up me-2"></i>
            Отчётность
          </Link>
        </li>
        <li className="nav-item mb-2">
          <Link 
            to="/worker/add-worker" 
            className={`nav-link ${isActive('/worker/add-worker') ? 'active' : ''}`}
          >
            <i className="bi bi-person-plus me-2"></i>
            Регистрация нового сотрудника
          </Link>
        </li>
      </>
    );

    return (
      <>
        {baseMenuItems}
        {seniorMenuItems}
        {managerMenuItems}
        <li className="nav-item">
          <Link 
            to="/worker/profile" 
            className={`nav-link ${isActive('/worker/profile') ? 'active' : ''}`}
          >
            <i className="bi bi-person-gear me-2"></i>
            Настройка профиля
          </Link>
        </li>
      </>
    );
  };

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="bg-primary text-white shadow-sm">
        <div className="container-fluid">
          <div className="d-flex justify-content-between align-items-center py-3">
            <div>
              <h1 className="h4 mb-0">
                <i className="bi bi-building-gear me-2"></i>
                Личный кабинет сотрудника
              </h1>
              <small className="opacity-75">
                {getPosition()} • ИНН: {user?.inn || user?.username}
              </small>
            </div>
            <div className="d-flex align-items-center">
              <span className="me-3 d-none d-md-block">
                Добро пожаловать, {workerData?.tax_officer_name || 'Сотрудник'}!
              </span>
              <button 
                onClick={logout} 
                className="btn btn-outline-light btn-sm"
              >
                <i className="bi bi-box-arrow-right me-1"></i>
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <div style={{ display: 'flex', flex: 1 }}>
        <nav className="bg-light border-end" style={{ width: '280px' }}>
          <div className="p-3">
            <ul className="nav nav-pills flex-column">
              {renderMenuItems()}
            </ul>
            
            <div className="mt-4 p-3 bg-white rounded border">
              <h6 className="text-primary mb-2">
                <i className="bi bi-info-circle me-1"></i>
                Информация о Вас
              </h6>
              <p className="small text-muted mb-2">
                Вы вошли как: <strong>{getPosition()}</strong>
              </p>
              {workerData?.unit && (
                <p className="small text-muted mb-0">
                  Подразделение: <strong>{workerData.unit}</strong>
                </p>
              )}
            </div>
          </div>
        </nav>
        
        <main className="flex-grow-1 bg-white">
          <div className="container-fluid py-4">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default WorkersDashboardPage;