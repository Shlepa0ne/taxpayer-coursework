import React, { useState } from 'react';

const DeclarationDetailModal = ({ declaration, onClose, onStatusUpdate, isUpdating, canChangeStatus, isSeniorInspector, fromSearch = false }) => {
  const [activeTab, setActiveTab] = useState('declaration');

  // Функция для определения доступных действий
  const getAvailableActions = () => {
    const currentStatus = Number(declaration.declaration_status_id);
    
    console.log('Current status:', currentStatus);
    console.log('isSeniorInspector:', isSeniorInspector);
    console.log('canChangeStatus:', canChangeStatus);
    
    // Обычный инспектор может менять статус только у поданых деклараций (статус 2)
    if (currentStatus === 2) {
      return {
        canAccept: true,    // Принять
        canReject: true,    // Отклонить
        canReturnToDraft: false
      };
    } 
    // Старший инспектор может возвращать принятые/отклоненные декларации на доработку
    else if ((currentStatus === 3 || currentStatus === 4) && isSeniorInspector) {
      return {
        canAccept: false,
        canReject: false,
        canReturnToDraft: true // Вернуть на доработку (статус 2)
      };
    }
    
    return {
      canAccept: false,
      canReject: false,
      canReturnToDraft: false
    };
  };

  const actions = getAvailableActions();

  // Добавим отладочный вывод
  console.log('Available actions:', actions);

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

  const handleAccept = () => {
    onStatusUpdate(declaration.declaration_id, 3); // Принять
  };

  const handleReject = () => {
    onStatusUpdate(declaration.declaration_id, 4); // Отклонить
  };

  const handleReturnToDraft = () => {
    console.log('Return to draft clicked for declaration:', declaration.declaration_id);
    onStatusUpdate(declaration.declaration_id, 2); // Вернуть на доработку (статус "подана")
  };

  // Функция для получения цвета статуса декларации
  const getDeclarationStatusColor = (statusId) => {
    const id = Number(statusId);
    if (id === 1) return 'secondary';  // черновик
    if (id === 2) return 'warning';    // подана
    if (id === 3) return 'success';    // принята
    if (id === 4) return 'danger';     // отклонена
    return 'secondary';
  };

  const getDeclarationStatusText = (statusId) => {
    const statusMap = {
      1: 'черновик',
      2: 'подана', 
      3: 'принята',
      4: 'отклонена'
    };
    return statusMap[statusId] || 'неизвестно';
  };

  // Функция для получения ИНН налогоплательщика
  const getTaxpayerInn = () => {
    return declaration.taxpayer_inn || 'Не указан';
  };

  // Функция для открытия карточки налогоплательщика в новой вкладке
  const openTaxpayerCard = () => {
    const inn = getTaxpayerInn();
    if (inn && inn !== 'Не указан') {
      const searchUrl = `/worker/search?inn=${inn}`;
      window.open(searchUrl, '_blank');
    } else {
      alert('ИНН налогоплательщика не указан');
    }
  };

  // Функция для получения отображаемого имени налогоплательщика
  const getTaxpayerDisplayName = () => {
    if (declaration.declaration_type === '6-НДФЛ') {
      return declaration.target_taxpayer_name || 'Не указано';
    } else {
      return declaration.taxpayer_fio || 
             declaration.taxpayer_full_name || 
             declaration.taxpayer_short_name || 
             'Не указано';
    }
  };

  // Функция для получения типа плательщика
  const getPayerType = () => {
    const payerTypes = {
      1: 'Физ. лицо',
      2: 'ИП',
      3: 'Юр. лицо'
    };
    return payerTypes[declaration.payer_type_id] || 'Неизвестно';
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="modal-title mb-0">
              <i className="bi bi-file-earmark-spreadsheet me-2"></i>
              Декларация #{declaration.declaration_id}
            </h5>
            <div className="d-flex align-items-center gap-2">
              {/* Показываем кнопку только если НЕ из поиска */}
              {!fromSearch && (
                <button 
                  onClick={openTaxpayerCard}
                  className="btn btn-outline-light btn-sm"
                  disabled={!getTaxpayerInn() || getTaxpayerInn() === 'Не указан'}
                >
                  <i className="bi bi-person-badge me-1"></i>
                  Карточка налогоплательщика
                </button>
              )}
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
                  className={`nav-link ${activeTab === 'declaration' ? 'active' : ''}`}
                  onClick={() => setActiveTab('declaration')}
                >
                  Информация о декларации
                </button>
                {(canChangeStatus || isSeniorInspector) && (
                  <button
                    className={`nav-link ${activeTab === 'decision' ? 'active' : ''}`}
                    onClick={() => setActiveTab('decision')}
                  >
                    Принятие решения
                  </button>
                )}
              </div>
            </nav>

            {/* Содержимое вкладок */}
            <div className="tab-content">
              
              {/* Вкладка информации о декларации */}
              {activeTab === 'declaration' && (
                <div className="row">
                  <div className="col-md-6">
                    <h6 className="text-muted mb-3">Информация о налогоплательщике</h6>
                    <div className="mb-3">
                      <strong>Налогоплательщик:</strong> {getTaxpayerDisplayName()}
                    </div>
                    <div className="mb-3">
                      <strong>Тип плательщика:</strong> {getPayerType()}
                    </div>
                    <div className="mb-3">
                      <strong>ИНН:</strong> {getTaxpayerInn()}
                    </div>
                    
                    <h6 className="text-muted mb-3 mt-4">Основная информация</h6>
                    <div className="mb-3">
                      <strong>Дата подачи:</strong> {formatDate(declaration.submission_date)}
                    </div>
                    <div className="mb-3">
                      <strong>Статус:</strong>{' '}
                      <span className={`badge bg-${getDeclarationStatusColor(declaration.declaration_status_id)}`}>
                        {getDeclarationStatusText(declaration.declaration_status_id)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <h6 className="text-muted mb-3">Налоговая информация</h6>
                    <div className="mb-3">
                      <strong>Тип налога:</strong> {declaration.tax_type_name}
                    </div>
                    <div className="mb-3">
                      <strong>Сумма налога:</strong> {formatCurrency(declaration.tax_amount)}
                    </div>
                    <div className="mb-3">
                      <strong>Общий доход:</strong> {formatCurrency(declaration.total_income)}
                    </div>
                    
                    <h6 className="text-muted mb-3 mt-4">Период и тип</h6>
                    <div className="mb-3">
                      <strong>Период:</strong> {declaration.period_name}
                    </div>
                    <div className="mb-3">
                      <strong>Тип декларации:</strong> {declaration.declaration_type}
                    </div>
                    
                    {declaration.declaration_type === '6-НДФЛ' && (
                      <div className="mb-3">
                        <strong>Подана за:</strong> {declaration.target_taxpayer_name}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Вкладка принятия решения */}
              {activeTab === 'decision' && (
                <div>
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    {declaration.declaration_status_id === 2 ? (
                      'Примите решение по декларации. Вы можете принять или отклонить декларацию.'
                    ) : (
                      isSeniorInspector ? 
                      'Вы можете вернуть декларацию на доработку.' :
                      'Изменение статуса принятых деклараций доступно только старшим инспекторам.'
                    )}
                  </div>

                  {/* Кнопки действий */}
                  <div className="d-flex gap-3">
                    {/* Для поданых деклараций (статус 2) - доступно всем инспекторам */}
                    {actions.canAccept && (
                      <button
                        className="btn btn-success flex-fill"
                        onClick={handleAccept}
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
                            Принять декларацию
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
                            Отклонить декларацию
                          </>
                        )}
                      </button>
                    )}

                    {/* Для принятых/отклоненных деклараций - кнопка возврата только для старших */}
                    {actions.canReturnToDraft && (
                      <button
                        className="btn btn-warning flex-fill"
                        onClick={handleReturnToDraft}
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
                            Вернуть на доработку
                          </>
                        )}
                      </button>
                    )}

                    {/* Сообщение, если нет доступных действий */}
                    {!actions.canAccept && !actions.canReject && !actions.canReturnToDraft && (
                      <div className="alert alert-warning w-100 text-center mb-0">
                        <i className="bi bi-info-circle me-2"></i>
                        {declaration.declaration_status_id === 1 
                          ? 'Декларация находится в статусе черновика'
                          : declaration.declaration_status_id === 2
                          ? 'Для этой декларации нет доступных действий'
                          : 'Изменение статуса принятых деклараций доступно только старшим инспекторам'
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

export default DeclarationDetailModal;