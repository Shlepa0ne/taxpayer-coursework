import React, { useState } from 'react';
import { deleteTaxableObject } from '../../../api/workersApi';
import ObjectModal from './ObjectModal';
import { formatDate, formatCurrency } from '../../../utils/formatters';

const ObjectsSection = ({ objects, taxpayerId, canEdit, onUpdate }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingObject, setEditingObject] = useState(null);

  const handleDeleteObject = async (objectId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот объект?')) {
      try {
        await deleteTaxableObject(objectId);
        onUpdate(taxpayerId);
      } catch (error) {
        console.error('Ошибка при удалении объекта:', error);
      }
    }
  };

  return (
    <div>
      {canEdit && (
        <div className="mb-3">
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
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
            return (
              <div key={ownership.ownership_id} className="col-12 mb-3">
                <div className="card border">
                  <div className="card-header bg-light d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">
                      <i className={`bi ${
                        obj.object_type_name === 'транспорт' ? 'bi-car-front' :
                        obj.object_type_name === 'недвижимость' ? 'bi-building' :
                        'bi-geo-alt'
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
                          onClick={() => setEditingObject({ ...obj, ownership })}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="btn btn-outline-danger"
                          onClick={() => handleDeleteObject(obj.object_id)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-2">
                          <strong>Адрес:</strong> {obj.object_address || 'Не указан'}
                        </div>
                        <div className="mb-2">
                          <strong>Период владения:</strong>{' '}
                          {formatDate(ownership.ownership_start_date)} -{' '}
                          {ownership.ownership_end_date 
                            ? formatDate(ownership.ownership_end_date)
                            : 'по настоящее время'
                          }
                        </div>
                        {obj.cadastral_number && (
                          <div className="mb-2">
                            <strong>Кадастровый номер:</strong> {obj.cadastral_number}
                          </div>
                        )}
                      </div>
                      <div className="col-md-6">
                        {obj.cadastral_value && (
                          <div className="mb-2">
                            <strong>Кадастровая стоимость:</strong> {formatCurrency(obj.cadastral_value)}
                          </div>
                        )}
                        {obj.extra_value && (
                          <div className="mb-2">
                            <strong>Дополнительная стоимость:</strong> {formatCurrency(obj.extra_value)}
                          </div>
                        )}
                        {obj.transport_vin && (
                          <div className="mb-2">
                            <strong>VIN:</strong> {obj.transport_vin}
                          </div>
                        )}
                        {obj.registration_plate && (
                          <div className="mb-2">
                            <strong>Госномер:</strong> {obj.registration_plate}
                          </div>
                        )}
                        {obj.engine_power && (
                          <div className="mb-2">
                            <strong>Мощность двигателя:</strong> {obj.engine_power} л.с.
                          </div>
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

      {/* Модальные окна для добавления/редактирования объектов */}
      {(showAddModal || editingObject) && (
        <ObjectModal
          object={editingObject}
          taxpayerId={taxpayerId}
          onClose={() => {
            setShowAddModal(false);
            setEditingObject(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingObject(null);
            onUpdate(taxpayerId);
          }}
        />
      )}
    </div>
  );
};

export default ObjectsSection;