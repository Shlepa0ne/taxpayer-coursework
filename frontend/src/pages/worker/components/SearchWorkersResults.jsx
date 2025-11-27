import React from 'react';
import Spinner from '../../../components/ui/Spinner';

const SearchWorkersResults = ({ searchResults, onWorkerSelect, loading }) => {
  if (loading) {
    return <Spinner />;
  }

  if (searchResults.length === 0) {
    return (
      <div className="text-center text-muted py-5">
        <i className="bi bi-person-x display-4"></i>
        <p className="mt-3">Сотрудники не найдены</p>
        <small>Измените параметры поиска или попробуйте другой запрос</small>
      </div>
    );
  }

  const getRoleBadgeColor = (roleId) => {
    switch (roleId) {
      case 1: return 'secondary'; // Инспектор
      case 2: return 'info';      // Старший инспектор
      case 3: return 'primary';   // Руководитель
      default: return 'secondary';
    }
  };

  return (
    <div className="row">
      {searchResults.map(worker => (
        <div key={worker.tax_officer_id} className="col-md-6 col-lg-4 mb-4">
          <div 
            className="card h-100 border-0 shadow-sm hover-card"
            onClick={() => onWorkerSelect(worker.tax_officer_id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-header bg-light">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0 text-truncate">{worker.tax_officer_name}</h6>
                <span className={`badge bg-${getRoleBadgeColor(worker.role_id)}`}>
                  {worker.role_name}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="mb-2">
                <small className="text-muted">Подразделение:</small>
                <div className="fw-semibold">{worker.unit || 'Не указано'}</div>
              </div>
              {/* УБРАНО: отображение ИНН */}
            </div>
            <div className="card-footer bg-transparent">
              <small className="text-muted">
                <i className="bi bi-hand-index me-1"></i>
                Нажмите для редактирования
              </small>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchWorkersResults;