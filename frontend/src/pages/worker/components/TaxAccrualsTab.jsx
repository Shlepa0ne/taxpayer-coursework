import React from 'react';
import { formatDate, formatCurrency } from '../../../utils/formatters';

const TaxAccrualsTab = ({ accruals, canEdit, onAccrualClick }) => {
  if (!accruals || accruals.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        <i className="bi bi-receipt display-4"></i>
        <p className="mt-2">Налоговые начисления не найдены</p>
      </div>
    );
  }

  const getStatusBadge = (accrual) => {
    const statusConfig = {
      'оплачено': { class: 'success', text: 'Оплачено' },
      'частично оплачено': { class: 'warning', text: 'Частично оплачено' },
      'просрочено': { class: 'danger', text: 'Просрочено' },
      'начислено': { class: 'primary', text: 'Начислено' }
    };
    
    const config = statusConfig[accrual.payment_status] || { class: 'secondary', text: 'Неизвестно' };
    
    return (
      <span className={`badge bg-${config.class}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div>
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Тип налога</th>
              <th>Дата начисления</th>
              <th>Сумма налога</th>
              <th>Пени/проценты</th>
              <th>Общая сумма</th>
              <th>Оплачено</th>
              <th>Остаток</th>
              <th>Срок оплаты</th>
              <th>Дата оплаты</th>
              <th>Статус</th>
              {canEdit && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {accruals.map(accrual => (
              <tr 
                key={accrual.tax_accrual_id}
                style={{ cursor: canEdit ? 'pointer' : 'default' }}
                onClick={() => canEdit && onAccrualClick(accrual.tax_accrual_id)}
                className={canEdit ? 'hover-row' : ''}
              >
                <td>
                  <div>
                    <strong>{accrual.tax_type_name}</strong>
                    {accrual.object_name && (
                      <div className="text-muted small">
                        {accrual.object_name}
                      </div>
                    )}
                  </div>
                </td>
                <td>{formatDate(accrual.accrual_date)}</td>
                <td>{formatCurrency(accrual.accrual_amount)}</td>
                <td>
                  {accrual.percent_amount > 0 ? (
                    <span className="text-danger">
                      {formatCurrency(accrual.percent_amount)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <strong>{formatCurrency(accrual.total_amount)}</strong>
                </td>
                <td>
                  {accrual.paid_amount > 0 ? (
                    <span className="text-success">
                      {formatCurrency(accrual.paid_amount)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  {accrual.remaining_amount > 0 ? (
                    <span className="text-warning">
                      {formatCurrency(accrual.remaining_amount)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  {accrual.due_date ? (
                    <span className={accrual.payment_status === 'просрочено' ? 'text-danger' : ''}>
                      {formatDate(accrual.due_date)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  {accrual.payment_date ? (
                    <span className="text-success">
                      {formatDate(accrual.payment_date)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>{getStatusBadge(accrual)}</td>
                {canEdit && (
                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAccrualClick(accrual.tax_accrual_id);
                      }}
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {canEdit && (
        <div className="text-muted small mt-2">
          <i className="bi bi-hand-index me-1"></i>
          Нажмите на начисление для подробного просмотра и редактирования
        </div>
      )}
    </div>
  );
};

export default TaxAccrualsTab;