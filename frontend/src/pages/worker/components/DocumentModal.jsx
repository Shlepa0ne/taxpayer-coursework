import React, { useState, useEffect } from 'react';
import { createDocument, updateDocument, getDocumentTypes } from '../../../api/workersApi';

// Модальное окно для документов
const DocumentModal = ({ document, taxpayerId, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    document_type_id: '',
    series: '',
    number: '',
    issued_by: '',
    issued_date: '',
    expire_date: '',
    additional_info: ''
  });
  
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [issuedDateError, setIssuedDateError] = useState('');
  const [expireDateError, setExpireDateError] = useState('');

  useEffect(() => {
    // Заменяем заглушку на реальный вызов API
    const loadDocumentTypes = async () => {
      try {
        const types = await getDocumentTypes();
        setDocumentTypes(types);
      } catch (error) {
        console.error('Ошибка загрузки типов документов:', error);
        // Запасной вариант
        const mockDocumentTypes = [
          { document_type_id: 1, name: 'Паспорт' },
          { document_type_id: 2, name: 'Водительское удостоверение' },
          { document_type_id: 3, name: 'Свидетельство о регистрации' }
        ];
        setDocumentTypes(mockDocumentTypes);
      }
    };

    loadDocumentTypes();

    if (document) {
      setFormData({
        document_type_id: document.document_type_id || '',
        series: document.series || '',
        number: document.number || '',
        issued_by: document.issued_by || '',
        issued_date: document.issued_date || '',
        expire_date: document.expire_date || '',
        additional_info: document.additional_info || ''
      });
    }
  }, [document]);

  // Валидация даты выдачи
  const validateIssuedDate = (dateString) => {
    if (!dateString) {
      setIssuedDateError('');
      return true;
    }
    
    const issuedDate = new Date(dateString);
    const currentYear = new Date().getFullYear();
    const issuedYear = issuedDate.getFullYear();
    
    // Проверка года (1900 - текущий год)
    if (issuedYear < 1900 || issuedYear > currentYear) {
      setIssuedDateError(`Год должен быть между 1900 и ${currentYear}`);
      return false;
    }
    
    // Проверка, что дата не в будущем
    if (issuedDate > new Date()) {
      setIssuedDateError('Дата выдачи не может быть в будущем');
      return false;
    }
    
    setIssuedDateError('');
    
    // Если есть дата действия, перепроверяем ее
    if (formData.expire_date) {
      validateExpireDate(formData.expire_date, dateString);
    }
    
    return true;
  };

  // Валидация даты действия
  const validateExpireDate = (expireDateString, issuedDateString = null) => {
    if (!expireDateString) {
      setExpireDateError('');
      return true;
    }
    
    const expireDate = new Date(expireDateString);
    const issuedDate = issuedDateString ? new Date(issuedDateString) : new Date(formData.issued_date);
    const currentYear = new Date().getFullYear();
    const expireYear = expireDate.getFullYear();
    
    // Проверка года (не позднее 2100 года)
    if (expireYear > 2100) {
      setExpireDateError('Год не может быть позже 2100');
      return false;
    }
    
    // Проверка, что дата действия больше даты выдачи
    if (formData.issued_date && expireDate <= issuedDate) {
      setExpireDateError('Дата действия должна быть позже даты выдачи');
      return false;
    }
    
    setExpireDateError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Валидация перед отправкой
    if (formData.issued_date && !validateIssuedDate(formData.issued_date)) {
      setLoading(false);
      return;
    }
    
    if (formData.expire_date && !validateExpireDate(formData.expire_date)) {
      setLoading(false);
      return;
    }

    try {
      // Подготавливаем данные для отправки
      const submitData = {
        ...formData,
        document_type: formData.document_type_id // переименовываем поле
      };
      
      // Удаляем старое поле, если оно есть
      delete submitData.document_type_id;

      console.log('Отправка данных документа:', submitData);
      
      if (document) {
        await updateDocument(document.document_id, submitData);
      } else {
        await createDocument(taxpayerId, submitData);
      }
      onSave();
    } catch (error) {
      console.error('Ошибка сохранения документа:', error);
      console.error('Детали ошибки:', error.response?.data);
      alert('Ошибка при сохранении документа: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Валидация при изменении дат
    if (field === 'issued_date') {
      validateIssuedDate(value);
    } else if (field === 'expire_date') {
      validateExpireDate(value);
    }
  };

  return (
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              {document ? 'Редактирование документа' : 'Добавление документа'}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Тип документа *</label>
                    <select
                      className="form-select"
                      value={formData.document_type_id}
                      onChange={(e) => handleChange('document_type_id', e.target.value)}
                      required
                    >
                      <option value="">Выберите тип документа</option>
                      {documentTypes.map(type => (
                        <option key={type.document_type_id} value={type.document_type_id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="mb-3">
                    <label className="form-label">Серия</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.series}
                      onChange={(e) => handleChange('series', e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="mb-3">
                    <label className="form-label">Номер *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.number}
                      onChange={(e) => handleChange('number', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Кем выдан</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.issued_by}
                  onChange={(e) => handleChange('issued_by', e.target.value)}
                />
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Дата выдачи</label>
                    <input
                      type="date"
                      className={`form-control ${issuedDateError ? 'is-invalid' : ''}`}
                      value={formData.issued_date}
                      onChange={(e) => handleChange('issued_date', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    {issuedDateError && (
                      <div className="invalid-feedback">
                        {issuedDateError}
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Действителен до</label>
                    <input
                      type="date"
                      className={`form-control ${expireDateError ? 'is-invalid' : ''}`}
                      value={formData.expire_date}
                      onChange={(e) => handleChange('expire_date', e.target.value)}
                      min={formData.issued_date || undefined}
                      max="2100-12-31"
                    />
                    {expireDateError && (
                      <div className="invalid-feedback">
                        {expireDateError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Дополнительная информация</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.additional_info}
                  onChange={(e) => handleChange('additional_info', e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Сохранить
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};

export default DocumentModal;