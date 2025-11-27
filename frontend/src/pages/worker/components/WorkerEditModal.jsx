import React, { useState, useEffect } from 'react';

const WorkerEditModal = ({ worker, onClose, onUpdate, isUpdating }) => {
  const [formData, setFormData] = useState({
    tax_officer_name: '',
    unit: '',
    role_id: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (worker) {
      setFormData({
        tax_officer_name: worker.tax_officer_name || '',
        unit: worker.unit || '',
        role_id: worker.role_id || 1
      });
    }
  }, [worker]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.tax_officer_name.trim()) {
      alert('Поле "ФИО сотрудника" обязательно для заполнения');
      return;
    }

    setSaving(true);
    try {
      await onUpdate(worker.tax_officer_id, formData);
      setIsEditing(false);
    } catch (error) {
      alert('Ошибка при сохранении: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      tax_officer_name: worker.tax_officer_name || '',
      unit: worker.unit || '',
      role_id: worker.role_id || 1
    });
    setIsEditing(false);
  };

  if (!worker) return null;

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-person-gear me-2"></i>
              Редактирование сотрудника
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">ФИО сотрудника *</label>
              <input
                type="text"
                className="form-control"
                value={formData.tax_officer_name}
                onChange={(e) => handleChange('tax_officer_name', e.target.value)}
                disabled={!isEditing}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Подразделение</label>
              <input
                type="text"
                className="form-control"
                value={formData.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                disabled={!isEditing}
                placeholder="Введите подразделение"
              />
            </div>

            <div className="mb-4">
              <label className="form-label">Должность</label>
              <select
                className="form-select"
                value={formData.role_id}
                onChange={(e) => handleChange('role_id', parseInt(e.target.value))}
                disabled={!isEditing}
              >
                <option value="1">Инспектор</option>
                <option value="2">Старший инспектор</option>
                <option value="3">Руководитель</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsEditing(true)}
                >
                  <i className="bi bi-pencil me-2"></i>
                  Редактировать
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Закрыть
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Сохранить
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Отмена
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerEditModal;