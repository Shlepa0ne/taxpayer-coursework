import React, { useState, useEffect } from 'react';
import { createTaxableObject, updateTaxableObject } from '../../../api/workersApi';

// Модальное окно для объектов
const ObjectModal = ({ object, taxpayerId, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    object_type_id: '',
    object_name: '',
    object_address: '',
    cadastral_number: '',
    cadastral_value: '',
    transport_vin: '',
    registration_plate: '',
    transport_model: '',
    engine_power: '',
    extra_value: '',
    ownership_start_date: '',
    ownership_end_date: ''
  });
  const [objectTypes, setObjectTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Заглушка для типов объектов
    const mockObjectTypes = [
      { object_type_id: 1, object_type_name: 'недвижимость' },
      { object_type_id: 2, object_type_name: 'транспорт' },
      { object_type_id: 3, object_type_name: 'прочее имущество' }
    ];
    setObjectTypes(mockObjectTypes);

    if (object) {
      setFormData({
        object_type_id: object.object_type_id || '',
        object_name: object.object_name || '',
        object_address: object.object_address || '',
        cadastral_number: object.cadastral_number || '',
        cadastral_value: object.cadastral_value || '',
        transport_vin: object.transport_vin || '',
        registration_plate: object.registration_plate || '',
        transport_model: object.transport_model || '',
        engine_power: object.engine_power || '',
        extra_value: object.extra_value || '',
        ownership_start_date: object.ownership?.ownership_start_date || '',
        ownership_end_date: object.ownership?.ownership_end_date || ''
      });
    }
  }, [object]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (object) {
        await updateTaxableObject(object.object_id, formData);
      } else {
        await createTaxableObject(taxpayerId, formData);
      }
      onSave();
    } catch (error) {
      console.error('Ошибка сохранения объекта:', error);
      alert('Ошибка при сохранении объекта');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Функция для определения, какие поля показывать в зависимости от типа объекта
  const getVisibleFields = () => {
    const objectType = objectTypes.find(type => type.object_type_id == formData.object_type_id);
    
    if (!objectType) return {};

    switch (objectType.object_type_name) {
      case 'недвижимость':
        return {
          showCadastralFields: true,
          showTransportFields: false,
          showExtraValue: false
        };
      case 'транспорт':
        return {
          showCadastralFields: false,
          showTransportFields: true,
          showExtraValue: false
        };
      case 'прочее имущество':
        return {
          showCadastralFields: false,
          showTransportFields: false,
          showExtraValue: true
        };
      default:
        return {
          showCadastralFields: false,
          showTransportFields: false,
          showExtraValue: false
        };
    }
  };

  const { showCadastralFields, showTransportFields, showExtraValue } = getVisibleFields();

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              {object ? 'Редактирование объекта' : 'Добавление объекта'}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Тип объекта *</label>
                    <select
                      className="form-select"
                      value={formData.object_type_id}
                      onChange={(e) => handleChange('object_type_id', e.target.value)}
                      required
                    >
                      <option value="">Выберите тип объекта</option>
                      {objectTypes.map(type => (
                        <option key={type.object_type_id} value={type.object_type_id}>
                          {type.object_type_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Название объекта *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.object_name}
                      onChange={(e) => handleChange('object_name', e.target.value)}
                      placeholder="Например: Квартира, Автомобиль, Оборудование и т.д."
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Поля для недвижимости */}
              {showCadastralFields && (
                <div className="border rounded p-3 mb-3 bg-light">
                  <h6 className="text-muted mb-3">Данные недвижимости</h6>
                  <div className="mb-3">
                    <label className="form-label">Адрес объекта</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formData.object_address}
                      onChange={(e) => handleChange('object_address', e.target.value)}
                      placeholder="Введите адрес объекта"
                    />
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Кадастровый номер</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.cadastral_number}
                          onChange={(e) => handleChange('cadastral_number', e.target.value)}
                          placeholder="00:00:0000000:000"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Кадастровая стоимость</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.cadastral_value}
                          onChange={(e) => handleChange('cadastral_value', e.target.value)}
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Поля для транспорта */}
              {showTransportFields && (
                <div className="border rounded p-3 mb-3 bg-light">
                  <h6 className="text-muted mb-3">Данные транспорта</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">VIN</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.transport_vin}
                          onChange={(e) => handleChange('transport_vin', e.target.value)}
                          placeholder="1HGCM82633A123456"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Госномер</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.registration_plate}
                          onChange={(e) => handleChange('registration_plate', e.target.value)}
                          placeholder="А123БВ777"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Марка/модель</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.transport_model}
                          onChange={(e) => handleChange('transport_model', e.target.value)}
                          placeholder="Toyota Camry"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Мощность двигателя (л.с.)</label>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.engine_power}
                          onChange={(e) => handleChange('engine_power', e.target.value)}
                          placeholder="150"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Поле для прочего имущества */}
              {showExtraValue && (
                <div className="border rounded p-3 mb-3 bg-light">
                  <h6 className="text-muted mb-3">Оценочная стоимость</h6>
                  <div className="mb-3">
                    <label className="form-label">Оценочная стоимость</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.extra_value}
                      onChange={(e) => handleChange('extra_value', e.target.value)}
                      step="0.01"
                      placeholder="0.00"
                    />
                    <div className="form-text">
                      Укажите оценочную стоимость имущества
                    </div>
                  </div>
                </div>
              )}

              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Дата начала владения *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.ownership_start_date}
                      onChange={(e) => handleChange('ownership_start_date', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Дата окончания владения</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.ownership_end_date}
                      onChange={(e) => handleChange('ownership_end_date', e.target.value)}
                    />
                    <div className="form-text">Оставьте пустым, если владение продолжается</div>
                  </div>
                </div>
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

export default ObjectModal;