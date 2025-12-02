// frontend/src/features/declarations/DeclarationList.jsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyDeclarations } from '../../api/taxpayersApi';
import Spinner from '../../components/ui/Spinner';

const DeclarationList = () => {
  const { data: declarations, isLoading, isError, error } = useQuery({
    queryKey: ['myDeclarations'],
    queryFn: getMyDeclarations,
  });

  // Функция для получения цвета типа декларации
  const getDeclarationTypeColor = (type) => {
    return type === '3-НДФЛ' ? 'info' : 'warning';
  };

  // Функция для получения иконки типа декларации
  const getDeclarationTypeIcon = (type) => {
    return type === '3-НДФЛ' ? 'bi-person' : 'bi-building';
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
  const formatPeriod = (declaration) => {
    if (declaration.period_name) {
      return declaration.period_name;
    }
    
    // Если period_name нет, попробуем сформировать из дат
    if (declaration.period_start && declaration.period_end) {
      const start = new Date(declaration.period_start).toLocaleDateString('ru-RU');
      const end = new Date(declaration.period_end).toLocaleDateString('ru-RU');
      return `${start} - ${end}`;
    }
    
    return '—';
  };

  // Функция для получения статуса декларации
  const getStatusInfo = (declaration) => {
    const statusMap = {
      1: { text: 'Черновик', class: 'secondary' },
      2: { text: 'Подана', class: 'warning' },
      3: { text: 'Принята', class: 'success' },
      4: { text: 'Отклонена', class: 'danger' }
    };
    
    const status = statusMap[declaration.declaration_status_id] || statusMap[1];
    
    return {
      text: status.text,
      class: status.class,
      icon: declaration.declaration_status_id === 2 ? 'bi-check-circle' : 
            declaration.declaration_status_id === 3 ? 'bi-check-circle-fill' :
            declaration.declaration_status_id === 4 ? 'bi-x-circle' : 'bi-pencil'
    };
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
        Ошибка при загрузке деклараций: {error.message}
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-primary text-white">
        <h4 className="card-title mb-0">
          <i className="bi bi-list-check me-2"></i>
          История моих деклараций
        </h4>
      </div>
      <div className="card-body p-0">
        {declarations && declarations.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col" className="ps-4">Дата подачи</th>
                  <th scope="col">Тип декларации</th>
                  <th scope="col">Период</th>
                  <th scope="col">За кого подано</th>
                  <th scope="col">Вид налога</th>
                  <th scope="col">Сумма налога</th>
                  <th scope="col">Общий доход</th>
                  <th scope="col" className="pe-4">Статус</th>
                </tr>
              </thead>
              <tbody>
                {declarations.map((declaration) => {
                  const statusInfo = getStatusInfo(declaration);
                  return (
                    <tr key={declaration.declaration_id} className="align-middle">
                      <td className="ps-4">
                        <div className="fw-semibold">
                          {formatDate(declaration.submission_date)}
                        </div>
                      </td>
                      <td>
                        <span className={`badge bg-${getDeclarationTypeColor(declaration.declaration_type)}`}>
                          <i className={`bi ${getDeclarationTypeIcon(declaration.declaration_type)} me-1`}></i>
                          {declaration.declaration_type}
                        </span>
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '150px' }} 
                             title={formatPeriod(declaration)}>
                          {formatPeriod(declaration)}
                        </div>
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '200px' }} 
                             title={declaration.target_taxpayer_name}>
                          {declaration.target_taxpayer_name}
                        </div>
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '200px' }} 
                             title={declaration.tax_type_name}>
                          {declaration.tax_type_name}
                        </div>
                      </td>
                      <td>
                        <span className="fw-bold text-dark">
                          {formatAmount(declaration.tax_amount || declaration.tax_sum)}
                        </span>
                      </td>
                      <td>
                        <span className="fw-bold text-success">
                          {formatAmount(declaration.total_income)}
                        </span>
                      </td>
                      <td className="pe-4">
                        <span className={`badge bg-${statusInfo.class}`}>
                          <i className={`bi ${statusInfo.icon} me-1`}></i>
                          {statusInfo.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-5">
            <div className="bg-light rounded-circle p-4 d-inline-block mb-3">
              <i className="bi bi-inbox text-muted fs-1"></i>
            </div>
            <h5 className="text-muted">Деклараций не найдено</h5>
            <p className="text-muted mb-0">
              У вас пока нет поданых налоговых деклараций
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeclarationList;