import React, { useState } from 'react';

const AccrualDetailModal = ({ 
  accrual, 
  onClose, 
  onUpdate, 
  isUpdating, 
  canChangeStatus,
  fromSearch = false 
}) => {
  const [editForm, setEditForm] = useState({
    accrual_amount: accrual?.accrual_amount || 0,
    percent_amount: accrual?.percent_amount || 0,
    due_date: accrual?.due_date || '',
    tax_type_id: accrual?.tax_type_id || ''
  });

  const handleSave = async () => {
    try {
      await onUpdate(accrual.tax_accrual_id, editForm);
      onClose();
    } catch (error) {
      console.error('Ошибка при обновлении начисления:', error);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  if (!accrual) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Редактирование налогового начисления</h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={handleCancel}
              disabled={isUpdating}
            ></button>
          </div>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label">Тип налога</label>
                  <input
                    type="text"
                    className="form-control"
                    value={accrual.tax_type_name || 'Не указан'}
                    disabled
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Дата начисления</label>
                  <input
                    type="text"
                    className="form-control"
                    value={accrual.accrual_date ? new Date(accrual.accrual_date).toLocaleDateString('ru-RU') : 'Не указана'}
                    disabled
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label">Статус</label>
                  <input
                    type="text"
                    className="form-control"
                    value={accrual.payment_status || 'Неизвестно'}
                    disabled
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Оплачено</label>
                  <input
                    type="text"
                    className="form-control"
                    value={`${accrual.paid_amount || 0} руб.`}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-md-4">
                <div className="mb-3">
                  <label className="form-label">Сумма налога *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.accrual_amount}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      accrual_amount: parseFloat(e.target.value) || 0
                    })}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div className="col-md-4">
                <div className="mb-3">
                  <label className="form-label">Пени/проценты</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.percent_amount}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      percent_amount: parseFloat(e.target.value) || 0
                    })}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div className="col-md-4">
                <div className="mb-3">
                  <label className="form-label">Срок оплаты *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      due_date: e.target.value
                    })}
                  />
                </div>
              </div>
            </div>

            {accrual.object_name && (
              <div className="mb-3">
                <label className="form-label">Объект налогообложения</label>
                <input
                  type="text"
                  className="form-control"
                  value={accrual.object_name}
                  disabled
                />
              </div>
            )}

            <div className="alert alert-info">
              <strong>Общая сумма к оплате:</strong> {accrual.total_amount || 0} руб.<br/>
              <strong>Остаток к оплате:</strong> {accrual.remaining_amount || 0} руб.
            </div>
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleCancel}
              disabled={isUpdating}
            >
              Отмена
            </button>
            {canChangeStatus && (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSave}
                disabled={isUpdating || !editForm.accrual_amount || !editForm.due_date}
              >
                {isUpdating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Сохранение...
                  </>
                ) : (
                  'Сохранить изменения'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccrualDetailModal;