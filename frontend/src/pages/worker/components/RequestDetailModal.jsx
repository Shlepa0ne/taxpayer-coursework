// frontend/src/pages/worker/components/RequestDetailModal.jsx
import React, { useState } from 'react';

const RequestDetailModal = ({ request, onClose, onStatusUpdate, isUpdating, canChangeStatus }) => {
  const [verdictComment, setVerdictComment] = useState('');
  const [activeTab, setActiveTab] = useState('request');

  // Функция для определения доступных действий
  const getAvailableActions = () => {
    const currentStatus = Number(request.request_status_id);
    
    if (currentStatus === 1) { // на рассмотрении
      return {
        canApprove: true,    // Любой инспектор может одобрить
        canReject: true,     // Любой инспектор может отклонить
        canReturnToReview: false
      };
    } else { // одобрено или отклонено
      return {
        canApprove: false,
        canReject: false,
        canReturnToReview: canChangeStatus // Только старшие инспекторы могут вернуть на рассмотрение
      };
    }
  };

  const actions = getAvailableActions();

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const handleApprove = () => {
    onStatusUpdate(request.request_id, 2, verdictComment);
  };

  const handleReject = () => {
    onStatusUpdate(request.request_id, 3, verdictComment);
  };

  const handleReturnToReview = () => {
    onStatusUpdate(request.request_id, 1, verdictComment);
  };

  // Функция для открытия карточки налогоплательщика в новой вкладке
  const openTaxpayerCard = () => {
    const searchUrl = `/worker/search?inn=${request.taxpayer_info?.inn}`;
    window.open(searchUrl, '_blank');
  };

  // Функция для получения цвета статуса заявления
  const getRequestStatusColor = (statusId) => {
    const id = Number(statusId);
    if (id === 1) return 'warning';    // на рассмотрении - желтый
    if (id === 2) return 'success';    // одобрено - зеленый
    if (id === 3) return 'danger';     // отклонено - красный
    return 'secondary';
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="modal-title mb-0">
              <i className="bi bi-file-earmark-text me-2"></i>
              Рассмотрение заявления #{request.request_id}
            </h5>
            <div className="d-flex align-items-center gap-2">
              <button 
                onClick={openTaxpayerCard}
                className="btn btn-outline-light btn-sm"
              >
                <i className="bi bi-person-badge me-1"></i>
                Карточка налогоплательщика
              </button>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onClose}
                style={{ margin: 0 }}
              ></button>
            </div>
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            
            {/* Навигация по вкладкам */}
            <nav className="mb-4">
              <div className="nav nav-tabs">
                <button
                  className={`nav-link ${activeTab === 'request' ? 'active' : ''}`}
                  onClick={() => setActiveTab('request')}
                >
                  Информация о заявлении
                </button>
                <button
                  className={`nav-link ${activeTab === 'decision' ? 'active' : ''}`}
                  onClick={() => setActiveTab('decision')}
                >
                  Принятие решения
                </button>
              </div>
            </nav>

            {/* Содержимое вкладок */}
            <div className="tab-content">
              
              {/* Вкладка информации о заявлении */}
              {activeTab === 'request' && (
                <div className="row">
                  <div className="col-md-6">
                    <h6 className="text-muted mb-3">Основная информация</h6>
                    <div className="mb-3">
                      <strong>Дата подачи:</strong> {formatDate(request.send_date)}
                    </div>
                    <div className="mb-3">
                      <strong>Статус:</strong>{' '}
                      <span className={`badge bg-${getRequestStatusColor(request.request_status_id)}`}>
                        {request.request_status_name}
                      </span>
                    </div>
                    <div className="mb-3">
                      <strong>Запрошенная сумма:</strong> {formatCurrency(request.requested_reduce_amount)}
                    </div>
                    <div className="mb-3">
                      <strong>Основание для снижения:</strong> {request.reduce_base_name}
                    </div>
                    <div className="mb-3">
                      <strong>Тип снижения:</strong> {request.reduce_type_name}
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <h6 className="text-muted mb-3">Дополнительная информация</h6>
                    {request.tax_types && request.tax_types.length > 0 && (
                      <div className="mb-3">
                        <strong>Типы налогов:</strong>
                        <div className="mt-1">
                          {request.tax_types.map(tax => (
                            <span key={tax.tax_type_id} className="badge bg-secondary me-1">
                              {tax.tax_type_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {request.periods && request.periods.length > 0 && (
                      <div className="mb-3">
                        <strong>Периоды:</strong>
                        <div className="mt-1">
                          {request.periods.map(period => (
                            <span key={period.period_id} className="badge bg-info me-1 mb-1">
                              {period.period_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {request.full_description && (
                    <div className="col-12 mt-3">
                      <h6 className="text-muted mb-2">Описание заявления</h6>
                      <div className="card border">
                        <div className="card-body">
                          <p className="mb-0">{request.full_description}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Вкладка принятия решения */}
              {activeTab === 'decision' && (
                <div>
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    {request.request_status_id === 1 ? (
                      'Примите решение по заявлению. Вы можете одобрить или отклонить заявление.'
                    ) : (
                      'Заявление уже рассмотрено. Вы можете вернуть его на повторное рассмотрение.'
                    )}
                  </div>

                  <div className="mb-4">
                    <label htmlFor="verdictComment" className="form-label">
                      <strong>Комментарий к решению</strong>
                    </label>
                    <textarea
                      id="verdictComment"
                      className="form-control"
                      rows="4"
                      placeholder="Введите комментарий к вашему решению (необязательно)"
                      value={verdictComment}
                      onChange={(e) => setVerdictComment(e.target.value)}
                    />
                  </div>

                  {/* Кнопки действий - отображаются в зависимости от статуса */}
                  <div className="d-flex gap-3">
                    {/* Для заявлений на рассмотрении (статус 1) - доступно всем */}
                    {actions.canApprove && (
                      <button
                        className="btn btn-success flex-fill"
                        onClick={handleApprove}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Обработка...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-check-circle me-2"></i>
                            Одобрить заявление
                          </>
                        )}
                      </button>
                    )}
                    
                    {actions.canReject && (
                      <button
                        className="btn btn-danger flex-fill"
                        onClick={handleReject}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Обработка...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-x-circle me-2"></i>
                            Отклонить заявление
                          </>
                        )}
                      </button>
                    )}

                    {/* Для рассмотренных заявлений (статус 2 или 3) - кнопка возврата только для старших */}
                    {actions.canReturnToReview && (
                      <button
                        className="btn btn-warning flex-fill"
                        onClick={handleReturnToReview}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Обработка...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-arrow-counterclockwise me-2"></i>
                            Вернуть на рассмотрение
                          </>
                        )}
                      </button>
                    )}

                    {/* Сообщение, если нет доступных действий */}
                    {!actions.canApprove && !actions.canReject && !actions.canReturnToReview && (
                      <div className="alert alert-warning w-100 text-center mb-0">
                        <i className="bi bi-info-circle me-2"></i>
                        {request.request_status_id === 1 
                          ? 'Для этого заявления нет доступных действий'
                          : 'Изменение статуса рассмотренных заявлений доступно только старшим инспекторам и руководителям'
                        }
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailModal;