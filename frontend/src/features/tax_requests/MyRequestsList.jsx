// frontend/src/features/tax_requests/MyRequestsList.jsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyRequests } from '../../api/taxpayersApi';
import Spinner from '../../components/ui/Spinner';

const MyRequestsList = () => {
  const { data: requests, isLoading, isError, error } = useQuery({
    queryKey: ['myRequests'],
    queryFn: getMyRequests,
  });

  // Функция для получения цвета статуса
  const getStatusColor = (status) => {
    switch (status) {
      case 'одобрено':
        return 'success';
      case 'отклонено':
        return 'danger';
      case 'на рассмотрении':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  // Функция для получения иконки статуса
  const getStatusIcon = (status) => {
    switch (status) {
      case 'одобрено':
        return 'bi-check-circle';
      case 'отклонено':
        return 'bi-x-circle';
      case 'на рассмотрении':
        return 'bi-clock';
      default:
        return 'bi-question-circle';
    }
  };

  // Функция для форматирования даты
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Функция для форматирования суммы
  const formatAmount = (amount) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  // Функция для форматирования периода
  const formatPeriod = (period) => {
    if (!period) return '—';
    const startDate = new Date(period.start_date).toLocaleDateString('ru-RU');
    const endDate = new Date(period.end_date).toLocaleDateString('ru-RU');
    return `${startDate} - ${endDate}`;
  };

  // Функция для получения всех периодов заявления в виде строки
  const getPeriodsString = (request) => {
    if (!request.periods || request.periods.length === 0) {
      return '—';
    }
    
    return request.periods.map(period => formatPeriod(period)).join(', ');
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="alert alert-danger">
        <i className="bi bi-exclamation-triangle me-2"></i>
        Ошибка при загрузке заявлений: {error.message}
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-primary text-white">
        <h4 className="card-title mb-0">
          <i className="bi bi-list-check me-2"></i>
          История моих заявлений
        </h4>
      </div>
      <div className="card-body p-0">
        {requests && requests.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col" className="ps-4">Дата подачи</th>
                  <th scope="col">Основание</th>
                  <th scope="col">Тип снижения</th>
                  <th scope="col">Периоды</th>
                  <th scope="col">Сумма снижения</th>
                  <th scope="col">Статус</th>
                  <th scope="col" className="pe-4">Дата решения</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.request_id} className="align-middle">
                    <td className="ps-4">
                      <div className="fw-semibold">
                        {formatDate(request.send_date)}
                      </div>
                    </td>
                    <td>
                      <div className="text-truncate" style={{ maxWidth: '200px' }} 
                           title={request.reduce_base_name}>
                        {request.reduce_base_name}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        request.reduce_type_name === 'Полное освобождение' 
                          ? 'bg-success' 
                          : 'bg-info'
                      }`}>
                        {request.reduce_type_name}
                      </span>
                    </td>
                    <td>
                      <div 
                        className="text-truncate" 
                        style={{ maxWidth: '250px' }}
                        title={getPeriodsString(request)}
                      >
                        {getPeriodsString(request)}
                      </div>
                      {request.periods && request.periods.length > 1 && (
                        <small className="text-muted d-block">
                          {request.periods.length} периодов
                        </small>
                      )}
                    </td>
                    <td>
                      <span className="fw-bold text-dark">
                        {formatAmount(request.requested_reduce_amount)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge bg-${getStatusColor(request.request_status_name)}`}>
                        <i className={`bi ${getStatusIcon(request.request_status_name)} me-1`}></i>
                        {request.request_status_name}
                      </span>
                    </td>
                    <td className="pe-4">
                      {request.verdict_date ? (
                        <span className="text-muted">
                          {formatDate(request.verdict_date)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-5">
            <div className="bg-light rounded-circle p-4 d-inline-block mb-3">
              <i className="bi bi-inbox text-muted fs-1"></i>
            </div>
            <h5 className="text-muted">Заявлений не найдено</h5>
            <p className="text-muted mb-0">
              У вас пока нет поданых заявлений на снижение налога
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRequestsList;