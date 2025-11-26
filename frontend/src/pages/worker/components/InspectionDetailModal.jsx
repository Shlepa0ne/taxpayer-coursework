import React, { useState } from 'react';

const InspectionDetailModal = ({ inspection, onClose, onUpdate, isUpdating, canChangeStatus, fromSearch = false }) => {
  const [activeTab, setActiveTab] = useState('inspection');
  const [formData, setFormData] = useState({
    inspection_date: inspection.inspection_date || '',
    inspection_type_id: inspection.inspection_type_id || '',
    inspection_reason: inspection.inspection_reason || '',
    inspection_type_status_id: inspection.inspection_type_status_id || ''
  });
  const [violations, setViolations] = useState(inspection.violations || []);

  const isFutureInspection = () => {
    if (!inspection.inspection_date) return false;
    const inspectionDate = new Date(inspection.inspection_date);
    const today = new Date();
    return inspectionDate > today;
  };

  const canEdit = canChangeStatus && isFutureInspection();

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

  const getInspectionTypeText = (typeId) => {
    const types = {
      1: 'Выездная',
      2: 'Камеральная',
      3: 'Документарная'
    };
    return types[typeId] || 'Неизвестно';
  };

  const getInspectionReasonText = (reasonId) => {
    const reasons = {
      1: 'Плановая проверка',
      2: 'Жалоба', 
      3: 'Анализ рисков'
    };
    return reasons[reasonId] || 'Неизвестно';
  };

  const getInspectionStatusText = (statusId) => {
    const statuses = {
      1: 'Запланирована',
      2: 'Завершена',
      3: 'Отменена'
    };
    return statuses[statusId] || 'Неизвестно';
  };

  const getInspectionStatusColor = (statusId) => {
    if (statusId === 1) return 'warning';
    if (statusId === 2) return 'success';
    if (statusId === 3) return 'secondary';
    return 'secondary';
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await onUpdate(inspection.inspection_id, formData);
    } catch (error) {
      console.error('Ошибка сохранения проверки:', error);
    }
  };

  const addViolation = () => {
    const newViolation = {
      violation_id: Date.now(), // временный ID
      sum_to_pay: '',
      violation_type_id: '',
      period_id: ''
    };
    setViolations(prev => [...prev, newViolation]);
  };

  const removeViolation = (violationId) => {
    setViolations(prev => prev.filter(v => v.violation_id !== violationId));
  };

  const updateViolation = (violationId, field, value) => {
    setViolations(prev => prev.map(v => 
      v.violation_id === violationId ? { ...v, [field]: value } : v
    ));
  };

  // Функция для открытия карточки налогоплательщика в новой вкладке
  const openTaxpayerCard = () => {
    const searchUrl = `/worker/search?inn=${inspection.taxpayer_inn}`;
    window.open(searchUrl, '_blank');
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="modal-title mb-0">
              <i className="bi bi-clipboard-check me-2"></i>
              Проверка #{inspection.inspection_id}
            </h5>
            <div className="d-flex align-items-center gap-2">
              {/* Показываем кнопку только если НЕ из поиска */}
              {!fromSearch && (
                <button 
                  onClick={openTaxpayerCard}
                  className="btn btn-outline-light btn-sm"
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
                  className={`nav-link ${activeTab === 'inspection' ? 'active' : ''}`}
                  onClick={() => setActiveTab('inspection')}
                >
                  Информация о проверке
                </button>
                {canEdit && (
                  <button
                    className={`nav-link ${activeTab === 'edit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('edit')}
                  >
                    Редактирование
                  </button>
                )}
                <button
                  className={`nav-link ${activeTab === 'violations' ? 'active' : ''}`}
                  onClick={() => setActiveTab('violations')}
                >
                  Нарушения ({violations.length})
                </button>
              </div>
            </nav>

            {/* Содержимое вкладок */}
            <div className="tab-content">
              
              {/* Вкладка информации о проверке */}
              {activeTab === 'inspection' && (
                <div className="row">
                  <div className="col-md-6">
                    <h6 className="text-muted mb-3">Основная информация</h6>
                    <div className="mb-3">
                      <strong>Дата проверки:</strong> {formatDate(inspection.inspection_date)}
                    </div>
                    <div className="mb-3">
                      <strong>Статус:</strong>{' '}
                      <span className={`badge bg-${getInspectionStatusColor(inspection.inspection_type_status_id)}`}>
                        {getInspectionStatusText(inspection.inspection_type_status_id)}
                      </span>
                    </div>
                    <div className="mb-3">
                      <strong>Тип проверки:</strong> {getInspectionTypeText(inspection.inspection_type_id)}
                    </div>
                    <div className="mb-3">
                      <strong>Основание:</strong> {getInspectionReasonText(inspection.inspection_reason)}
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <h6 className="text-muted mb-3">Дополнительная информация</h6>
                    {isFutureInspection() && (
                      <div className="alert alert-info">
                        <i className="bi bi-info-circle me-2"></i>
                        Это предстоящая проверка
                      </div>
                    )}
                    
                    {violations.length > 0 && (
                      <div className="mb-3">
                        <strong>Выявленные нарушения:</strong> {violations.length}
                      </div>
                    )}
                    
                    {inspection.tax_officers && inspection.tax_officers.length > 0 && (
                      <div className="mb-3">
                        <strong>Ответственные сотрудники:</strong>
                        <ul className="mb-0 mt-1">
                          {inspection.tax_officers.map(officer => (
                            <li key={officer.tax_officer_id}>{officer.tax_officer_name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Вкладка редактирования */}
              {activeTab === 'edit' && canEdit && (
                <div>
                  <div className="alert alert-warning">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Вы можете редактировать только предстоящие проверки
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Дата проверки *</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={formData.inspection_date}
                          onChange={(e) => handleFormChange('inspection_date', e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">Тип проверки *</label>
                        <select
                          className="form-select"
                          value={formData.inspection_type_id}
                          onChange={(e) => handleFormChange('inspection_type_id', e.target.value)}
                          required
                        >
                          <option value="">Выберите тип</option>
                          <option value="1">Выездная</option>
                          <option value="2">Камеральная</option>
                          <option value="3">Документарная</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Основание *</label>
                        <select
                          className="form-select"
                          value={formData.inspection_reason}
                          onChange={(e) => handleFormChange('inspection_reason', e.target.value)}
                          required
                        >
                          <option value="">Выберите основание</option>
                          <option value="1">Плановая проверка</option>
                          <option value="2">Жалоба</option>
                          <option value="3">Анализ рисков</option>
                        </select>
                      </div>
                      
                      <div className="mb-3">
                        <label className="form-label">Статус *</label>
                        <select
                          className="form-select"
                          value={formData.inspection_type_status_id}
                          onChange={(e) => handleFormChange('inspection_type_status_id', e.target.value)}
                          required
                        >
                          <option value="1">Запланирована</option>
                          <option value="3">Отменена</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex gap-2 mt-4">
                    <button
                      className="btn btn-success"
                      onClick={handleSave}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Сохранить изменения
                        </>
                      )}
                    </button>
                    
                    <button
                      className="btn btn-secondary"
                      onClick={() => setActiveTab('inspection')}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {/* Вкладка нарушений */}
              {activeTab === 'violations' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="mb-0">Выявленные нарушения</h6>
                    {canEdit && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={addViolation}
                      >
                        <i className="bi bi-plus-circle me-1"></i>
                        Добавить нарушение
                      </button>
                    )}
                  </div>

                  {violations.length === 0 ? (
                    <div className="text-center text-muted py-4">
                      <i className="bi bi-shield-exclamation display-4"></i>
                      <p className="mt-2">Нарушения не выявлены</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Тип нарушения</th>
                            <th>Сумма к оплате</th>
                            <th>Период</th>
                            {canEdit && <th>Действия</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {violations.map(violation => (
                            <tr key={violation.violation_id}>
                              <td>
                                {canEdit ? (
                                  <select
                                    className="form-select form-select-sm"
                                    value={violation.violation_type_id}
                                    onChange={(e) => updateViolation(violation.violation_id, 'violation_type_id', e.target.value)}
                                  >
                                    <option value="">Выберите тип</option>
                                    <option value="1">Несвоевременная подача</option>
                                    <option value="2">Неполная информация</option>
                                    <option value="3">Нарушение сроков оплата</option>
                                  </select>
                                ) : (
                                  violation.violation_type_name || 'Не указан'
                                )}
                              </td>
                              <td>
                                {canEdit ? (
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={violation.sum_to_pay}
                                    onChange={(e) => updateViolation(violation.violation_id, 'sum_to_pay', e.target.value)}
                                    step="0.01"
                                  />
                                ) : (
                                  formatCurrency(violation.sum_to_pay)
                                )}
                              </td>
                              <td>
                                {violation.period_name || 'Не указан'}
                              </td>
                              {canEdit && (
                                <td>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => removeViolation(violation.violation_id)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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

export default InspectionDetailModal;