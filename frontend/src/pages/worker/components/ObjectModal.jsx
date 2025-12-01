import React, { useState, useEffect } from 'react';
import { createTaxableObject, updateTaxableObject, getObjectTypes } from '../../../api/workersApi';

// Модальное окно для объектов
const ObjectModal = ({ object, taxpayerId, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    object_type: '',
    object_name: '',
    object_address: '',
    cadastral_number: '',
    cadastral_value: '',
    transport_vin: '',
    registration_plate: '',
    transport_model: '',
    engine_power: '',
    extra_value: '',
    real_estate_type: null,
    ownership_start_date: '',
    ownership_end_date: ''
  });
  
  const [objectTypes, setObjectTypes] = useState([]);
  const [realEstateTypes, setRealEstateTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoadingTypes(true);
      try {
        // Загружаем типы объектов с сервера
        const types = await getObjectTypes();
        console.log('Loaded object types:', types);
        setObjectTypes(types);
        
        // Заглушка для типов недвижимости
        const mockRealEstateTypes = [
          { real_estate_type_id: 1, real_estate_type_name: 'Квартира' },
          { real_estate_type_id: 2, real_estate_type_name: 'Дом' },
          { real_estate_type_id: 3, real_estate_type_name: 'Земельный участок' },
          { real_estate_type_id: 4, real_estate_type_name: 'Коммерческая недвижимость' }
        ];
        setRealEstateTypes(mockRealEstateTypes);
        
        // Если редактируем объект, устанавливаем его тип
        if (object) {
          console.log('Editing object data:', object);
          
          // ВАЖНО: Проверяем, откуда берется тип объекта
          // object может содержать object_type_id напрямую или через object_type
          const objectTypeId = object.object_type_id || 
                              (object.object_type && object.object_type.object_type_id) ||
                              '';
          
          const realEstateTypeId = object.real_estate_type_id ||
                                  (object.real_estate_type && object.real_estate_type.real_estate_type_id) ||
                                  null;
          
          console.log('Object type ID:', objectTypeId);
          console.log('Real estate type ID:', realEstateTypeId);
          
          setFormData({
            object_type: objectTypeId || '',
            object_name: object.object_name || '',
            object_address: object.object_address || '',
            cadastral_number: object.cadastral_number || '',
            cadastral_value: object.cadastral_value || '',
            transport_vin: object.transport_vin || '',
            registration_plate: object.registration_plate || '',
            transport_model: object.transport_model || '',
            engine_power: object.engine_power || '',
            extra_value: object.extra_value || '',
            real_estate_type: realEstateTypeId || null,
            ownership_start_date: object.ownership?.ownership_start_date || '',
            ownership_end_date: object.ownership?.ownership_end_date || ''
          });
        }
      } catch (error) {
        console.error('Ошибка загрузки типов объектов:', error);
        // Запасной вариант
        const mockObjectTypes = [
          { object_type_id: 1, object_type_name: 'транспорт' },
          { object_type_id: 2, object_type_name: 'недвижимость' },
          { object_type_id: 3, object_type_name: 'земельный участок' }
        ];
        setObjectTypes(mockObjectTypes);
      } finally {
        setLoadingTypes(false);
      }
    };

    loadData();
  }, [object]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Submitting object data:', formData);
      
      // Функция для форматирования числовых полей
      const formatNumberField = (value) => {
        if (value === '' || value === null || value === undefined) return null;
        const num = Number(value);
        return isNaN(num) ? null : num;
      };

      // Подготавливаем данные для отправки
      const submitData = {
        object_type: formData.object_type,
        object_name: formData.object_name,
        object_address: formData.object_address || null,
        cadastral_number: formData.cadastral_number || null,
        cadastral_value: formatNumberField(formData.cadastral_value),
        transport_vin: formData.transport_vin || null,
        registration_plate: formData.registration_plate || null,
        transport_model: formData.transport_model || null,
        engine_power: formatNumberField(formData.engine_power),
        extra_value: formatNumberField(formData.extra_value),
        real_estate_type: formData.real_estate_type || null,
        ownership_start_date: formData.ownership_start_date,
        ownership_end_date: formData.ownership_end_date || null
      };

      console.log('Sending to API:', submitData);

      if (object) {
        await updateTaxableObject(object.object_id, submitData);
      } else {
        await createTaxableObject(taxpayerId, submitData);
      }
      
      onSave();
      
    } catch (error) {
      console.error('Ошибка сохранения объекта:', error);
      console.error('Детали ошибки:', error.response?.data);
      alert('Ошибка при сохранении объекта: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Функция для определения, какие поля показывать в зависимости от типа объекта
  const getVisibleFields = () => {
    const objectTypeId = parseInt(formData.object_type);
    
    if (objectTypeId === 1) {  // транспорт
      return {
        showCadastralFields: false,
        showTransportFields: true,
        showExtraValue: false,
        showRealEstateType: false,
        showObjectAddress: false
      };
    } else if (objectTypeId === 2) {  // недвижимость
      return {
        showCadastralFields: true, 
        showTransportFields: false, 
        showExtraValue: false,
        showRealEstateType: true,  
        showObjectAddress: true   
      };
    } else {  // прочее имущество (если появятся новые типы)
      return {
        showCadastralFields: false,
        showTransportFields: false,
        showExtraValue: true,       // для прочего имущества показываем поле оценки
        showRealEstateType: false,
        showObjectAddress: false
      };
    }
  };

  const { showCadastralFields, showTransportFields, showExtraValue, showRealEstateType, showObjectAddress } = getVisibleFields();

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
                      value={formData.object_type}
                      onChange={(e) => handleChange('object_type', e.target.value)}
                      required
                      disabled={loadingTypes}
                    >
                      <option value="">
                        {loadingTypes ? 'Загрузка типов...' : 'Выберите тип объекта'}
                      </option>
                      {!loadingTypes && objectTypes.map(type => (
                        <option key={type.object_type_id || type.id} value={type.object_type_id || type.id}>
                          {type.object_type_name || type.name}
                        </option>
                      ))}
                    </select>
                    {loadingTypes && (
                      <div className="form-text">Загрузка доступных типов объектов...</div>
                    )}
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

              {/* Поле адреса объекта (показывается для всех, кроме прочего имущества) */}
              {showObjectAddress && (
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
              )}

              {/* Тип недвижимости (показывается только для недвижимости) */}
              {showRealEstateType && (
                <div className="mb-3">
                  <label className="form-label">Тип недвижимости</label>
                  <select
                    className="form-select"
                    value={formData.real_estate_type || ''}
                    onChange={(e) => handleChange('real_estate_type', e.target.value)}
                  >
                    <option value="">Выберите тип недвижимости</option>
                    {realEstateTypes.map(type => (
                      <option key={type.real_estate_type_id} value={type.real_estate_type_id}>
                        {type.real_estate_type_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Поля для недвижимости */}
              {showCadastralFields && (
                <div className="border rounded p-3 mb-3 bg-light">
                  <h6 className="text-muted mb-3">Данные недвижимости</h6>
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
                          min="0"
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
                          min="0"
                          step="1"
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
                    <label className="form-label">Оценочная стоимость *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.extra_value}
                      onChange={(e) => handleChange('extra_value', e.target.value)}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      required
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