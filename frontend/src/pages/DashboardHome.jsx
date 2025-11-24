// frontend/src/pages/DashboardHome.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Добавьте этот импорт
import { getMyAccruals } from '../api/taxpayersApi';
import { getLatestRiskScore } from '../api/taxpayersApi';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';

const DashboardHome = () => {
  const [riskScore, setRiskScore] = useState(null);
  const [totalDebt, setTotalDebt] = useState(0);
  const [accrualsCount, setAccrualsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Получаем начисления для расчета общей суммы
        const accruals = await getMyAccruals();
        const total = accruals.reduce((sum, accrual) => {
          return sum + parseFloat(accrual.accrual_amount || 0);
        }, 0);
        
        setTotalDebt(total);
        setAccrualsCount(accruals.length);

        // Получаем последний RiskScore
        try {
          const riskData = await getLatestRiskScore();
          if (riskData.risk_score !== undefined) {
            setRiskScore(riskData.risk_score);
          }
        } catch (riskError) {
          console.warn('RiskScore not available:', riskError);
          // Не устанавливаем ошибку, так как RiskScore может быть недоступен
        }

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
    if (score <= 30) return 'success';
    if (score <= 70) return 'warning';
    return 'danger';
  };

  const getRiskScoreText = (score) => {
    if (score <= 30) return 'Низкий риск';
    if (score <= 70) return 'Средний риск';
    return 'Высокий риск';
  };

  if (loading) return <Spinner />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Обзор Вашей налоговой ситуации</h2>
      </div>

      <div className="row">
        {/* Карточка RiskScore */}
        <div className="col-md-6 mb-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">
                <i className="bi bi-graph-up me-2"></i>
                Ваш RiskScore
              </h5>
            </div>
            <div className="card-body text-center">
              {riskScore !== null ? (
                <>
                  <div className={`display-4 fw-bold text-${getRiskScoreColor(riskScore)} mb-3`}>
                    {riskScore}
                  </div>
                  <div className={`badge bg-${getRiskScoreColor(riskScore)} fs-6 mb-2`}>
                    {getRiskScoreText(riskScore)}
                  </div>
                  <p className="text-muted mt-3">
                    Ваша оценка налогового риска. Чем ниже показатель, тем ниже шансы проверок и тем чище ваша совесть!
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

        {/* Карточка общей задолженности */}
        <div className="col-md-6 mb-4">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-header bg-warning text-dark">
              <h5 className="card-title mb-0">
                <i className="bi bi-cash-coin me-2"></i>
                Общая задолженность
              </h5>
            </div>
            <div className="card-body text-center">
              <div className="display-4 fw-bold text-dark mb-3">
                {totalDebt.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-muted">
                <i className="bi bi-receipt me-1"></i>
                На основе {accrualsCount} начислений
              </div>
              {totalDebt > 0 && (
                <div className="alert alert-warning mt-3 mb-0">
                  <small>
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    ФНС России рекомендует погасить задолженность в ближайшее время
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
              <div className="row">
                <div className="col-md-3 mb-3">
                  <div className="d-grid">
                    <Link to="/accruals" className="btn btn-outline-primary">
                      <i className="bi bi-list-ul me-2"></i>
                      Просмотреть начисления
                    </Link>
                  </div>
                </div>
                <div className="col-md-3 mb-3">
                  <div className="d-grid">
                    <Link to="/new-request" className="btn btn-outline-success">
                      <i className="bi bi-file-earmark-text me-2"></i>
                      Подать заявление
                    </Link>
                  </div>
                </div>
                <div className="col-md-3 mb-3">
                  <div className="d-grid">
                    <button className="btn btn-outline-info" disabled>
                      <i className="bi bi-file-earmark-pdf me-2"></i>
                      Декларации
                    </button>
                  </div>
                </div>
                <div className="col-md-3 mb-3">
                  <div className="d-grid">
                    <Link to="/profile" className="btn btn-outline-secondary">
                      <i className="bi bi-gear me-2"></i>
                      Профиль
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;