import React, { useState, useEffect } from 'react';
import { createContact, updateContact } from '../../../api/workersApi';

// Модальное окно для контактов
const ContactModal = ({ contact, taxpayerId, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    contact_type_id: '',
    value: ''
  });
  const [contactTypes, setContactTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Заглушка для типов контактов
    const mockContactTypes = [
      { contact_type_id: 1, name: 'Телефон' },
      { contact_type_id: 2, name: 'Email' }
    ];
    setContactTypes(mockContactTypes);

    if (contact) {
      setFormData({
        contact_type_id: contact.contact_type_id || '',
        value: contact.value || ''
      });
    }
  }, [contact]);

  // Валидация формы
  const validateForm = () => {
    const newErrors = {};

    if (!formData.contact_type_id) {
      newErrors.contact_type_id = 'Выберите тип контакта';
    }

    if (!formData.value) {
      newErrors.value = 'Введите значение';
    } else {
      const contactType = contactTypes.find(type => type.contact_type_id == formData.contact_type_id);
      
      if (contactType) {
        if (contactType.name === 'Телефон') {
          // Валидация телефона: только цифры, минимум 10 символов
          const phoneRegex = /^[0-9+-\s()]{10,15}$/;
          if (!phoneRegex.test(formData.value.replace(/\s/g, ''))) {
            newErrors.value = 'Введите корректный номер телефона';
          }
        } else if (contactType.name === 'Email') {
          // Валидация email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(formData.value)) {
            newErrors.value = 'Введите корректный email адрес';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (contact) {
        await updateContact(contact.contact_id, formData);
      } else {
        await createContact(taxpayerId, formData);
      }
      onSave();
    } catch (error) {
      console.error('Ошибка сохранения контакта:', error);
      alert('Ошибка при сохранении контакта');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Очищаем ошибку при изменении поля
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getPlaceholder = () => {
    const contactType = contactTypes.find(type => type.contact_type_id == formData.contact_type_id);
    if (contactType) {
      if (contactType.name === 'Телефон') {
        return '+7 (999) 123-45-67';
      } else if (contactType.name === 'Email') {
        return 'example@mail.ru';
      }
    }
    return 'Введите значение';
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              {contact ? 'Редактирование контакта' : 'Добавление контакта'}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Тип контакта *</label>
                <select
                  className={`form-select ${errors.contact_type_id ? 'is-invalid' : ''}`}
                  value={formData.contact_type_id}
                  onChange={(e) => handleChange('contact_type_id', e.target.value)}
                  required
                >
                  <option value="">Выберите тип контакта</option>
                  {contactTypes.map(type => (
                    <option key={type.contact_type_id} value={type.contact_type_id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {errors.contact_type_id && (
                  <div className="invalid-feedback">{errors.contact_type_id}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">
                  {formData.contact_type_id == 1 ? 'Номер телефона *' : 
                   formData.contact_type_id == 2 ? 'Email адрес *' : 'Значение *'}
                </label>
                <input
                  type="text"
                  className={`form-control ${errors.value ? 'is-invalid' : ''}`}
                  value={formData.value}
                  onChange={(e) => handleChange('value', e.target.value)}
                  required
                  placeholder={getPlaceholder()}
                />
                {errors.value && (
                  <div className="invalid-feedback">{errors.value}</div>
                )}
                {formData.contact_type_id == 1 && (
                  <div className="form-text">Формат: +7 (999) 123-45-67 или 89991234567</div>
                )}
                {formData.contact_type_id == 2 && (
                  <div className="form-text">Формат: example@mail.ru</div>
                )}
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
    </div>
  );
};

export default ContactModal;