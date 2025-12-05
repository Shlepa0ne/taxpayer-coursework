import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentTaxpayer } from '../api/taxpayersApi';

// Контекст для состояния формы
export const FormContext = React.createContext({
  isFormDirty: false,
  setIsFormDirty: () => {}
});

const DashboardPage = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [taxpayerData, setTaxpayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFormDirty, setIsFormDirty] = useState(false);

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

  // Обработка beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isFormDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isFormDirty]);

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getDisplayRole = () => {
    if (user?.user_type === 'taxpayer') return 'Налогоплательщик';
    if (user?.user_type === 'worker') return 'Сотрудник';
    return 'Пользователь';
  };

  const getDisplayName = () => {
    if (!taxpayerData) return 'Пользователь';

    const payerType = taxpayerData.payer_type_id;

    if (payerType === 3) {
      return taxpayerData.short_name || taxpayerData.full_name || 'Организация';
    } else {
      return taxpayerData.fio || taxpayerData.full_name || 'Пользователь';
    }
  };

  const displayName = getDisplayName();

  // Создаем функцию для безопасных ссылок
  const SafeLink = ({ to, children, className }) => {
    const handleClick = (e) => {
      if (isFormDirty) {
        e.preventDefault();
        const confirmLeave = window.confirm(
          'Вы уверены? Введенные данные могут быть потеряны.'
        );
        if (confirmLeave) {
          window.location.href = to;
        }
      }
    };

    return (
      <a 
        href={to} 
        className={className}
        onClick={handleClick}
      >
        {children}
      </a>
    );
  };

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <FormContext.Provider value={{ isFormDirty, setIsFormDirty }}>
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
                  onClick={() => {
                    if (isFormDirty) {
                      const confirmLeave = window.confirm(
                        'Ты уверен? Введенные данные могут быть потеряны.'
                      );
                      if (!confirmLeave) return;
                    }
                    logout();
                  }} 
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
                  <SafeLink 
                    to="/" 
                    className={`nav-link ${isActive('/') ? 'active' : ''}`}
                  >
                    <i className="bi bi-speedometer2 me-2"></i>
                    Обзор
                  </SafeLink>
                </li>
                <li className="nav-item mb-2">
                  <SafeLink 
                    to="/accruals" 
                    className={`nav-link ${isActive('/accruals') ? 'active' : ''}`}
                  >
                    <i className="bi bi-list-ul me-2"></i>
                    Начисления
                  </SafeLink>
                </li>
                <li className="nav-item mb-2">
                  <SafeLink 
                    to="/requests" 
                    className={`nav-link ${isActive('/requests') ? 'active' : ''}`}
                  >
                    <i className="bi bi-file-earmark-text me-2"></i>
                    Заявления
                  </SafeLink>
                </li>
                <li className="nav-item mb-2">
                  <SafeLink 
                    to="/declarations" 
                    className={`nav-link ${isActive('/declarations') ? 'active' : ''}`}
                  >
                    <i className="bi bi-file-earmark-pdf me-2"></i>
                    Декларации
                  </SafeLink>
                </li>
                <li className="nav-item">
                  <SafeLink 
                    to="/profile" 
                    className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
                  >
                    <i className="bi bi-person-gear me-2"></i>
                    Настройка профиля
                  </SafeLink>
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
    </FormContext.Provider>
  );
};

export default DashboardPage;