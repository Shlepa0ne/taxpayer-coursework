// frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentTaxpayer } from '../api/taxpayersApi';

const DashboardPage = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [taxpayerData, setTaxpayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTaxpayerData = async () => {
      try {
        if (user?.user_type === 'taxpayer') {
          const data = await getCurrentTaxpayer();
          setTaxpayerData(data);
        }
      } catch (error) {
        console.error('Error fetching taxpayer data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTaxpayerData();
  }, [user]);

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Определяем отображаемую роль
  const getDisplayRole = () => {
    if (user?.user_type === 'taxpayer') return 'Налогоплательщик';
    if (user?.user_type === 'worker') return 'Сотрудник';
    return 'Пользователь';
  };

  // Получаем правильное имя для отображения в зависимости от типа налогоплательщика
  const getDisplayName = () => {
    if (!taxpayerData) return 'Пользователь';

    // payer_type_id: 1 - физлицо, 2 - ИП, 3 - юрлицо
    const payerType = taxpayerData.payer_type_id;

    if (payerType === 3) { // Юридическое лицо
      return taxpayerData.short_name || taxpayerData.full_name || 'Организация';
    } else { // Физическое лицо (1) или ИП (2)
      return taxpayerData.fio || taxpayerData.full_name || 'Пользователь';
    }
  };

  const displayName = getDisplayName();

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
                <i className="bi bi-building me-2"></i>
                Личный кабинет налогоплательщика
              </h1>
              <small className="opacity-75">
                {getDisplayRole()} • ИНН: {user?.inn || user?.username}
              </small>
            </div>
            <div className="d-flex align-items-center">
              <span className="me-3 d-none d-md-block">
                Добро пожаловать, {displayName}!
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
              <li className="nav-item mb-2">
                <Link 
                  to="/" 
                  className={`nav-link ${isActive('/') ? 'active' : ''}`}
                >
                  <i className="bi bi-speedometer2 me-2"></i>
                  Обзор
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link 
                  to="/accruals" 
                  className={`nav-link ${isActive('/accruals') ? 'active' : ''}`}
                >
                  <i className="bi bi-list-ul me-2"></i>
                  Начисления
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link 
                  to="/requests" 
                  className={`nav-link ${isActive('/requests') ? 'active' : ''}`}
                >
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Заявления
                </Link>
              </li>
              <li className="nav-item mb-2">
                <Link 
                  to="/declarations" 
                  className={`nav-link ${isActive('/declarations') ? 'active' : ''}`}
                >
                  <i className="bi bi-file-earmark-pdf me-2"></i>
                  Декларации
                </Link>
              </li>
              <li className="nav-item">
                <Link 
                  to="/profile" 
                  className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
                >
                  <i className="bi bi-person-gear me-2"></i>
                  Настройка профиля
                </Link>
              </li>
            </ul>
            
            <div className="mt-4 p-3 bg-white rounded border">
              <h6 className="text-primary mb-2">
                <i className="bi bi-info-circle me-1"></i>
                Справка
              </h6>
              <p className="small text-muted mb-2">
                RiskScore - показатель налоговых рисков. Снижается при своевременной оплате налогов.
              </p>
              <p className="small text-muted mb-0">
                Для снижения налогов обратитесь в раздел "Заявления".
              </p>
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

export default DashboardPage;