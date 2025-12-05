// frontend/src/pages/DeclarationsPage.jsx
import React, { useState, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import DeclarationForm from '../features/declarations/DeclarationForm';
import DeclarationList from '../features/declarations/DeclarationList';
import { getMyDeclarations } from '../api/taxpayersApi';
import Spinner from '../components/ui/Spinner';
import { FormContext } from './DashboardPage';

const DeclarationsPage = () => {
  const [activeTab, setActiveTab] = useState('new');
  const { isFormDirty, setIsFormDirty } = useContext(FormContext);

  const handleTabChange = (tab) => {
    if (isFormDirty && tab !== activeTab) {
      const confirmLeave = window.confirm(
        'У вас есть несохраненные изменения. Вы уверены, что хотите покинуть страницу? Изменения будут потеряны.'
      );
      if (!confirmLeave) return;
      setIsFormDirty(false);
    }
    setActiveTab(tab);
  };

  // Запрос для получения количества деклараций
  const { data: declarations, isLoading: declarationsLoading } = useQuery({
    queryKey: ['myDeclarations'],
    queryFn: getMyDeclarations,
  });

  // Получаем количество деклараций
  const declarationsCount = declarations?.length || 0;

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex align-items-center mb-3">
            <div className="bg-primary rounded-circle p-3 me-3 d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
              <i className="bi bi-file-earmark-pdf text-white fs-2"></i>
            </div>
            <div>
              <h1 className="h3 mb-1">Налоговые декларации</h1>
              <p className="text-muted mb-0">
                Подача новых деклараций и просмотр истории подачи
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="row mb-4">
        <div className="col-12">
          <ul className="nav nav-pills nav-fill">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'new' ? 'active' : ''}`}
                onClick={() => handleTabChange('new')}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Новая декларация
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => handleTabChange('list')}
              >
                <i className="bi bi-list-check me-2"></i>
                Мои декларации
                <span className={`badge ${declarationsCount > 0 ? 'bg-primary' : 'bg-secondary'} ms-2`}>
                  {declarationsLoading ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    declarationsCount
                  )}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Содержимое вкладок */}
      <div className="row">
        <div className="col-12">
          {activeTab === 'new' ? (
            <>
              <DeclarationForm />
              
              {/* Дополнительная информация */}
              <div className="row mt-5">
                <div className="col-md-4 mb-4">
                  <div className="card border-0 text-center h-100">
                    <div className="card-body">
                      <div className="bg-info rounded-circle p-4 d-inline-flex align-items-center justify-content-center mb-3" 
                           style={{ width: '100px', height: '100px' }}>
                        <i className="bi bi-file-text text-white fs-1"></i>
                      </div>
                      <h5 className="card-title">3-НДФЛ</h5>
                      <p className="card-text text-muted small">
                        Декларация по налогу на доходы физических лиц. Подается за себя.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="col-md-4 mb-4">
                  <div className="card border-0 text-center h-100">
                    <div className="card-body">
                      <div className="bg-warning rounded-circle p-4 d-inline-flex align-items-center justify-content-center mb-3" 
                           style={{ width: '100px', height: '100px' }}>
                        <i className="bi bi-calculator text-white fs-1"></i>
                      </div>
                      <h5 className="card-title">6-НДФЛ</h5>
                      <p className="card-text text-muted small">
                        Расчет сумм налога на доходы ФЛ. Подается за другого налогоплательщика.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="col-md-4 mb-4">
                  <div className="card border-0 text-center h-100">
                    <div className="card-body">
                      <div className="bg-success rounded-circle p-4 d-inline-flex align-items-center justify-content-center mb-3" 
                           style={{ width: '100px', height: '100px' }}>
                        <i className="bi bi-shield-check text-white fs-1"></i>
                      </div>
                      <h5 className="card-title">Безопасно</h5>
                      <p className="card-text text-muted small">
                        Все данные защищены и передаются по зашифрованному соединению.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <DeclarationList />
          )}
        </div>
      </div>
    </div>
  );
};

export default DeclarationsPage;