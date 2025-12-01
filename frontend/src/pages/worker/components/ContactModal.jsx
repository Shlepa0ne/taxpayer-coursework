import React, { useState, useEffect } from 'react';
import { createContact, updateContact, getContactTypes } from '../../../api/workersApi'; // ДОБАВИТЬ getContactTypes

const ContactModal = ({ contact, taxpayerId, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    contact_type: '',  // ИЗМЕНЕНО: было contact_type_id
    value: ''
  });
  const [contactTypes, setContactTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const loadContactTypes = async () => {
      try {
        // Пробуем загрузить типы контактов с сервера
        const types = await getContactTypes();
        console.log('Loaded contact types:', types);
        setContactTypes(types);
      } catch (error) {
        console.error('Ошибка загрузки типов контактов:', error);
        // Запасной вариант
        const mockContactTypes = [
          { type_id: 1, name: 'Телефон' },
          { type_id: 2, name: 'Email' }
        ];
        setContactTypes(mockContactTypes);
      }
    };

    loadContactTypes();

    if (contact) {
      console.log('Editing contact:', contact);
      setFormData({
        contact_type: contact.contact_type_id || contact.contact_type || '',  // ИЗМЕНЕНО
        value: contact.value || ''
      });
    }
  }, [contact]);

  // Валидация формы
  const validateForm = () => {
    const newErrors = {};

    if (!formData.contact_type) {
      newErrors.contact_type = 'Выберите тип контакта';
    }

    if (!formData.value) {
      newErrors.value = 'Введите значение';
    } else {
      const contactType = contactTypes.find(type => 
        type.type_id == formData.contact_type || type.contact_type_id == formData.contact_type
      );
      
      if (contactType) {
        const typeName = contactType.name || contactType.contact_type_name;
        
        if (typeName === 'Телефон' || typeName === 'телефон' || typeName === 'Phone' || typeName === 'phone') {
          // Более гибкая валидация телефона
          const phoneRegex = /^[0-9+-\s()]{10,20}$/;
          const cleanPhone = formData.value.replace(/\s/g, '');
          if (!phoneRegex.test(cleanPhone)) {
            newErrors.value = 'Введите корректный номер телефона (минимум 10 цифр)';
          }
        } else if (typeName === 'Email' || typeName === 'email') {
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
      console.log('Submitting contact data:', formData);
      
      // Подготавливаем данные для отправки
      const submitData = {
        contact_type: formData.contact_type,
        value: formData.value
      };
      
      console.log('Sending to API:', submitData);
      
      if (contact) {
        await updateContact(contact.contact_id, submitData);
      } else {
        await createContact(taxpayerId, submitData);
      }
      
      onSave();
      
    } catch (error) {
      console.error('Ошибка сохранения контакта:', error);
      console.error('Детали ошибки:', error.response?.data);
      alert('Ошибка при сохранении контакта: ' + (error.response?.data?.error || error.message));
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
    const contactType = contactTypes.find(type => 
      type.type_id == formData.contact_type || type.contact_type_id == formData.contact_type
    );
    if (contactType) {
      const typeName = contactType.name || contactType.contact_type_name;
      if (typeName === 'Телефон' || typeName === 'телефон' || typeName === 'Phone'  || typeName === 'phone') {
        return '+7 (999) 123-45-67';
      } else if (typeName === 'Email' || typeName === 'email') {
        return 'example@mail.ru';
      }
    }
    return 'Введите значение';
  };

  return (
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
                  className={`form-select ${errors.contact_type ? 'is-invalid' : ''}`}
                  value={formData.contact_type}
                  onChange={(e) => handleChange('contact_type', e.target.value)}
                  required
                >
                  <option value="">Выберите тип контакта</option>
                  {contactTypes.map(type => (
                    <option 
                      key={type.type_id || type.contact_type_id} 
                      value={type.type_id || type.contact_type_id}
                    >
                      {type.name || type.contact_type_name}
                    </option>
                  ))}
                </select>
                {errors.contact_type && (
                  <div className="invalid-feedback">{errors.contact_type}</div>
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">
                  {(() => {
                    const contactType = contactTypes.find(type => 
                      type.type_id == formData.contact_type || type.contact_type_id == formData.contact_type
                    );
                    if (contactType) {
                      const typeName = contactType.name || contactType.contact_type_name;
                      if (typeName === 'Телефон' || typeName === 'телефон' || typeName === 'Phone' || typeName === 'phone') {
                        return 'Номер телефона *';
                      } else if (typeName === 'Email' || typeName === 'email') {
                        return 'Email адрес *';
                      }
                    }
                    return 'Значение *';
                  })()}
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
                {(() => {
                  const contactType = contactTypes.find(type => 
                    type.type_id == formData.contact_type || type.contact_type_id == formData.contact_type
                  );
                  if (contactType) {
                    const typeName = contactType.name || contactType.contact_type_name;
                    if (typeName === 'Телефон' || typeName === 'телефон' || typeName === 'Phone' || typeName === 'phone') {
                      return <div className="form-text">Формат: +7 (999) 123-45-67 или 89991234567</div>;
                    } else if (typeName === 'Email' || typeName === 'email') {
                      return <div className="form-text">Формат: example@mail.ru</div>;
                    }
                  }
                  return null;
                })()}
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

export default ContactModal;