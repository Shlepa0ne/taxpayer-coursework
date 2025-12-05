// frontend/src/pages/worker/components/ObjectsSection.jsx
import React, { useState, useEffect } from 'react';
import { formatDate, formatCurrency } from '../../../utils/formatters'; // ДОБАВИТЬ импорт

const ObjectsSection = ({ 
  objects, 
  taxpayerId, 
  canEdit, 
  onAddObject,
  onEditObject,
  onDeleteObject
}) => {
  useEffect(() => {
    console.log('ObjectsSection received objects:', objects);
  }, [objects]);

  // Функция для определения, какие поля показывать в зависимости от типа объекта
  const getObjectDisplayFields = (obj) => {
    const typeName = obj.object_type_name?.toLowerCase() || '';
    
    if (typeName.includes('недвижимость')) {
      return {
        showAddress: true,
        showCadastralFields: true,
        showTransportFields: false,
        showExtraValue: false
      };
    } else if (typeName.includes('транспорт')) {
      return {
        showAddress: false,
        showCadastralFields: false,
        showTransportFields: true,
        showExtraValue: false
      };
    } else {
      return {
        showAddress: false,
        showCadastralFields: false,
        showTransportFields: false,
        showExtraValue: true
      };
    }
  };

  return (
    <div>
      {canEdit && (
        <div className="mb-3">
          <button 
            className="btn btn-primary"
            onClick={() => onAddObject()}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Добавить объект
          </button>
        </div>
      )}

      {objects.length > 0 ? (
        <div className="row">
          {objects.map(ownership => {
            const obj = ownership.object;
            const { showAddress, showCadastralFields, showTransportFields, showExtraValue } = getObjectDisplayFields(obj);
            
            return (
              <div key={ownership.ownership_id} className="col-12 mb-3">
                <div className="card border">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">
                      <i className={`bi ${
                        obj.object_type_name?.toLowerCase() === 'транспорт' ? 'bi-car-front' :
                        obj.object_type_name?.toLowerCase() === 'недвижимость' ? 'bi-building' :
                        'bi-box'
                      } me-2`}></i>
                      {obj.object_name || 'Без названия'}
                      <span className="badge bg-secondary ms-2">
                        {obj.object_type_name}
                      </span>
                    </h6>
                    {canEdit && (
                      <div className="btn-group btn-group-sm">
                        <button 
                          className="btn btn-outline-primary"
                          onClick={() => onEditObject({ ...obj, ownership })}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="btn btn-outline-danger"
                          onClick={() => onDeleteObject(obj.object_id)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6">
                        {/* Адрес показываем всегда для недвижимости */}
                        {showAddress && (
                          <div className="mb-2">
                            <strong>Адрес:</strong> {obj.object_address || 'не указан'}
                          </div>
                        )}
                        <div className="mb-2">
                          <strong>Период владения:</strong>{' '}
                          {formatDate(ownership.ownership_start_date)} -{' '}
                          {ownership.ownership_end_date 
                            ? formatDate(ownership.ownership_end_date)
                            : 'по настоящее время'
                          }
                        </div>
                        {/* Кадастровый номер всегда для недвижимости */}
                        {showCadastralFields && (
                          <div className="mb-2">
                            <strong>Кадастровый номер:</strong> {obj.cadastral_number || 'не указан'}
                          </div>
                        )}
                        {/* Оценочная стоимость для всего остального */}
                        {showExtraValue && (
                          <div className="mb-2">
                            <strong>Оценочная стоимость:</strong> {obj.extra_value ? formatCurrency(obj.extra_value) : 'не указана'}
                          </div>
                        )}
                      </div>
                      <div className="col-md-6">
                        {/* Кадастровая стоимость всегда для недвижимости */}
                        {showCadastralFields && (
                          <div className="mb-2">
                            <strong>Кадастровая стоимость:</strong> {obj.cadastral_value ? formatCurrency(obj.cadastral_value) : 'не указана'}
                          </div>
                        )}
                        {/* Транспортные поля */}
                        {showTransportFields && (
                          <>
                            <div className="mb-2">
                              <strong>VIN:</strong> {obj.transport_vin || 'не указан'}
                            </div>
                            <div className="mb-2">
                              <strong>Госномер:</strong> {obj.registration_plate || 'не указан'}
                            </div>
                            {obj.transport_model && (
                              <div className="mb-2">
                                <strong>Марка/модель:</strong> {obj.transport_model}
                              </div>
                            )}
                            {obj.engine_power && (
                              <div className="mb-2">
                                <strong>Мощность двигателя:</strong> {obj.engine_power} л.с.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-muted py-4">
          <i className="bi bi-house-x display-4"></i>
          <p className="mt-2">Налогооблагаемые объекты не найдены</p>
        </div>
      )}
    </div>
  );
};

export default ObjectsSection;