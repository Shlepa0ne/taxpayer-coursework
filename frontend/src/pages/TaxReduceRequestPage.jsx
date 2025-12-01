// frontend/src/pages/TaxReduceRequestPage.jsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import CreateRequestForm from '../features/tax_requests/CreateRequestForm';
import MyRequestsList from '../features/tax_requests/MyRequestsList';
import { getMyRequests } from '../api/taxpayersApi';
import Spinner from '../components/ui/Spinner';

const TaxReduceRequestPage = () => {
  const [activeTab, setActiveTab] = useState('new');

  // Запрос для получения количества заявлений
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['myRequests'],
    queryFn: getMyRequests,
  });

  // Получаем количество заявлений
  const requestsCount = requests?.length || 0;

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex align-items-center mb-3">
            <div className="bg-primary rounded-circle p-3 me-3 d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
              <i className="bi bi-file-earmark-text text-white fs-2"></i>
            </div>
            <div>
              <h1 className="h3 mb-1">Заявления на снижение налога</h1>
              <p className="text-muted mb-0">
                Подача новых заявлений и просмотр истории обращений
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
                onClick={() => setActiveTab('new')}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Новое заявление
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => setActiveTab('list')}
              >
                <i className="bi bi-list-check me-2"></i>
                Мои заявления
                <span className={`badge ${requestsCount > 0 ? 'bg-primary' : 'bg-secondary'} ms-2`}>
                  {requestsLoading ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    requestsCount
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
              <CreateRequestForm />
              
              {/* Дополнительная информация - с кругами вместо овалов */}
              <div className="row mt-5">
                <div className="col-md-4 mb-4">
                  <div className="card border-0 text-center h-100">
                    <div className="card-body">
                      <div className="bg-info rounded-circle p-4 d-inline-flex align-items-center justify-content-center mb-3" 
                           style={{ width: '100px', height: '100px' }}>
                        <i className="bi bi-check-circle text-white fs-1"></i>
                      </div>
                      <h5 className="card-title">Простая подача</h5>
                      <p className="card-text text-muted small">
                        Заполните форму онлайн без необходимости посещения налоговой инспекции
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="col-md-4 mb-4">
                  <div className="card border-0 text-center h-100">
                    <div className="card-body">
                      <div className="bg-warning rounded-circle p-4 d-inline-flex align-items-center justify-content-center mb-3" 
                           style={{ width: '100px', height: '100px' }}>
                        <i className="bi bi-clock text-white fs-1"></i>
                      </div>
                      <h5 className="card-title">Быстрое рассмотрение</h5>
                      <p className="card-text text-muted small">
                        Стандартный срок рассмотрения заявления составляет 30 календарных дней
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="col-md-4 mb-4">
                  <div className="card border-0 text-center h-100">
                    <div className="card-body">
                      <div className="bg-success rounded-circle p-4 d-inline-flex align-items-center justify-content-center mb-3" 
                           style={{ width: '100px', height: '100px' }}>
                        <i className="bi bi-telephone text-white fs-1"></i>
                      </div>
                      <h5 className="card-title">Поддержка</h5>
                      <p className="card-text text-muted small">
                        При возникновении вопросов обращайтесь в службу поддержки ФНС
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <MyRequestsList />
          )}
        </div>
      </div>
    </div>
  );
};

export default TaxReduceRequestPage;