// frontend/src/pages/WorkersDashboardHome.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getAverageRiskScore, 
  getPendingRequestsCount, 
  getDeclarationsCount, 
  getUpcomingInspectionsCount,
  getCurrentWorker
} from '../api/workersApi';
import Spinner from '../components/ui/Spinner';

const WorkersDashboardHome = () => {
  const [dashboardData, setDashboardData] = useState({
    averageRiskScore: null,
    pendingRequests: 0,
    declarationsCount: 0,
    upcomingInspections: 0
  });
  const [workerData, setWorkerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        const [
          riskScoreData,
          requestsData,
          declarationsData,
          inspectionsData,
          workerData
        ] = await Promise.all([
          getAverageRiskScore(),
          getPendingRequestsCount(),
          getDeclarationsCount(),
          getUpcomingInspectionsCount(),
          getCurrentWorker()
        ]);

        setDashboardData({
          averageRiskScore: riskScoreData.average_score,
          pendingRequests: requestsData.count,
          declarationsCount: declarationsData.count,
          upcomingInspections: inspectionsData.count
        });
        
        setWorkerData(workerData);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getRiskScoreColor = (score) => {
    if (!score) return 'secondary';
    if (score <= 30) return 'success';
    if (score <= 70) return 'warning';
    return 'danger';
  };

  const getRiskScoreText = (score) => {
    if (!score) return 'Нет данных';
    if (score <= 30) return 'Низкий риск';
    if (score <= 70) return 'Средний риск';
    return 'Высокий риск';
  };

  // Функция для получения быстрых действий в зависимости от роли
  const getQuickActions = () => {
    if (!workerData) return [];

    const roleId = workerData.role_id;
    
    // Базовые действия для всех ролей
    const baseActions = [
      {
        to: '/worker/search',
        label: 'Поиск налогоплательщика',
        icon: 'bi-search',
        color: 'outline-primary'
      },
      {
        to: '/worker/requests',
        label: 'Рассмотреть заявления',
        icon: 'bi-file-earmark-text',
        color: 'outline-warning'
      },
      {
        to: '/worker/declarations',
        label: 'Проверить декларации',
        icon: 'bi-file-earmark-pdf',
        color: 'outline-info'
      }
    ];

    // Действия для всех инспекторов (включая обычных) - ДОБАВЛЕНО ПРОВЕРКИ
    const inspectorActions = [
      {
        to: '/worker/inspections',
        label: 'Проверки',
        icon: 'bi-clipboard-check',
        color: 'outline-danger'
      }
    ];

    // Действия для старших инспекторов и руководителей
    const seniorActions = roleId >= 2 ? [
      {
        to: '/worker/add-taxpayer',
        label: 'Регистрация плательщика',
        icon: 'bi-person-badge',
        color: 'outline-success'
      }
    ] : [];

    // Действия только для руководителей
    const managerActions = roleId === 3 ? [
      {
        to: '/worker/reports',
        label: 'Отчётность',
        icon: 'bi-graph-up',
        color: 'outline-success'
      },
      {
        to: '/worker/add-worker',
        label: 'Регистрация сотрудника',
        icon: 'bi-person-plus',
        color: 'outline-info'
      }
    ] : [];

    // Комбинируем действия в зависимости от роли
    if (roleId === 1) {
      // Инспектор - базовые действия + проверки
      return [...baseActions, ...inspectorActions];
    } else if (roleId === 2) {
      // Старший инспектор - базовые + проверки + дополнительные
      return [...baseActions, ...inspectorActions, ...seniorActions];
    } else if (roleId === 3) {
      // Руководитель - все действия
      return [...baseActions, ...inspectorActions, ...seniorActions, ...managerActions];
    }

    return baseActions;
  };

  if (loading) return <Spinner />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const quickActions = getQuickActions();

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Общий обзор ситуации</h2>
        <div className="text-muted">
          <i className="bi bi-calendar me-1"></i>
          {new Date().toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            weekday: 'long'
          })}
        </div>
      </div>

      <div className="row">
        {/* Средний RiskScore */}
        <div className="col-md-6 col-lg-3 mb-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">
                <i className="bi bi-graph-up me-2"></i>
                Средний RiskScore
              </h5>
            </div>
            <div className="card-body text-center">
              {dashboardData.averageRiskScore !== null ? (
                <>
                  <div className={`display-4 fw-bold text-${getRiskScoreColor(dashboardData.averageRiskScore)} mb-3`}>
                    {Math.round(dashboardData.averageRiskScore)}
                  </div>
                  <div className={`badge bg-${getRiskScoreColor(dashboardData.averageRiskScore)} fs-6 mb-2`}>
                    {getRiskScoreText(dashboardData.averageRiskScore)}
                  </div>
                  <p className="text-muted mt-3 small">
                    Средний показатель налогового риска по всем налогоплательщикам
                  </p>
                </>
              ) : (
                <div className="text-muted">
                  <i className="bi bi-info-circle me-2"></i>
                  Данные о RiskScore недоступны
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Заявления для рассмотрения */}
        <div className="col-md-6 col-lg-3 mb-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-warning text-dark">
              <h5 className="card-title mb-0">
                <i className="bi bi-file-earmark-text me-2"></i>
                Заявления
              </h5>
            </div>
            <div className="card-body text-center">
              <div className="display-4 fw-bold text-dark mb-3">
                {dashboardData.pendingRequests}
              </div>
              <div className="text-muted mb-3">
                на рассмотрении
              </div>
              {dashboardData.pendingRequests > 0 ? (
                <Link to="/worker/requests" className="btn btn-warning btn-sm">
                  Перейти к рассмотрению
                </Link>
              ) : (
                <div className="alert alert-success mt-2 mb-0 p-2">
                  <small>
                    <i className="bi bi-check-circle me-1"></i>
                    Все заявления рассмотрены
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Декларации */}
        <div className="col-md-6 col-lg-3 mb-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-info text-white">
              <h5 className="card-title mb-0">
                <i className="bi bi-file-earmark-pdf me-2"></i>
                Декларации
              </h5>
            </div>
            <div className="card-body text-center">
              <div className="display-4 fw-bold text-dark mb-3">
                {dashboardData.declarationsCount}
              </div>
              <div className="text-muted mb-3">
                на рассмотрении
              </div>
              <Link to="/worker/declarations" className="btn btn-info btn-sm text-white">
                Рассмотреть
              </Link>
            </div>
          </div>
        </div>

        {/* Предстоящие проверки */}
        <div className="col-md-6 col-lg-3 mb-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-danger text-white">
              <h5 className="card-title mb-0">
                <i className="bi bi-clipboard-check me-2"></i>
                Проверки
              </h5>
            </div>
            <div className="card-body text-center">
              <div className="display-4 fw-bold text-dark mb-3">
                {dashboardData.upcomingInspections}
              </div>
              <div className="text-muted mb-3">
                предстоящих
              </div>
              {dashboardData.upcomingInspections > 0 ? (
                <Link to="/worker/inspections" className="btn btn-danger btn-sm text-white">
                  Посмотреть
                </Link>
              ) : (
                <div className="alert alert-success mt-2 mb-0 p-2">
                  <small>
                    <i className="bi bi-check-circle me-1"></i>
                    Нет запланированных проверок
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-light">
              <h5 className="card-title mb-0">Быстрые действия</h5>
            </div>
            <div className="card-body">
              <div className="row justify-content-center">
                {quickActions.map((action, index) => (
                  <div key={index} className="col-md-3 mb-3">
                    <div className="d-grid">
                      <Link to={action.to} className={`btn btn-${action.color}`}>
                        <i className={`bi ${action.icon} me-2`}></i>
                        {action.label}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkersDashboardHome;