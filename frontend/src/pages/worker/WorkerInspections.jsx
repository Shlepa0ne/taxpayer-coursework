// frontend/src/pages/worker/WorkerInspections.jsx
import React, { useState, useEffect } from 'react';
import { getWorkerInspections, getCurrentWorker, createInspection, updateInspection, getAvailableOfficers } from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';

const WorkerInspections = () => {
  const [inspections, setInspections] = useState([]);
  const [workerData, setWorkerData] = useState(null);
  const [availableOfficers, setAvailableOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [formData, setFormData] = useState({
    taxpayer_id: '',
    inspection_date: '',
    inspection_type_id: 1,
    inspection_reason: '',
    participants: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inspectionsData, workerData, officersData] = await Promise.all([
        getWorkerInspections(),
        getCurrentWorker(),
        getAvailableOfficers()
      ]);
      setInspections(inspectionsData);
      setWorkerData(workerData);
      setAvailableOfficers(officersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInspection = async (e) => {
    e.preventDefault();
    try {
      await createInspection(formData);
      setShowCreateModal(false);
      setFormData({
        taxpayer_id: '',
        inspection_date: '',
        inspection_type_id: 1,
        inspection_reason: '',
        participants: []
      });
      fetchData();
    } catch (error) {
      console.error('Error creating inspection:', error);
    }
  };

  const getInspectionStatus = (statusId) => {
    const statusMap = {
      1: { text: 'Запланирована', color: 'warning' },
      2: { text: 'В процессе', color: 'info' },
      3: { text: 'Завершена', color: 'success' },
      4: { text: 'Отменена', color: 'danger' }
    };
    return statusMap[statusId] || { text: 'Неизвестно', color: 'secondary' };
  };

  const getInspectionType = (typeId) => {
    const typeMap = {
      1: 'Выездная проверка',
      2: 'Камеральная проверка',
      3: 'Встречная проверка'
    };
    return typeMap[typeId] || 'Неизвестный тип';
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Проверки</h2>
        {workerData?.can_review_requests && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Создать проверку
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">Мои проверки</h5>
        </div>
        <div className="card-body">
          {inspections.length === 0 ? (
            <div className="text-center py-4">
              <i className="bi bi-clipboard-x display-4 text-muted"></i>
              <p className="mt-3 text-muted">Нет назначенных проверок</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Дата проверки</th>
                    <th>Налогоплательщик</th>
                    <th>Тип проверки</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((inspection) => {
                    const status = getInspectionStatus(inspection.inspection_type_status_id);
                    return (
                      <tr key={inspection.inspection_id}>
                        <td>#{inspection.inspection_id}</td>
                        <td>{new Date(inspection.inspection_date).toLocaleDateString('ru-RU')}</td>
                        <td>
                          {inspection.taxpayer.fio || inspection.taxpayer.full_name || inspection.taxpayer.short_name}
                          <br />
                          <small className="text-muted">ИНН: {inspection.taxpayer.inn}</small>
                        </td>
                        <td>{getInspectionType(inspection.inspection_type_id)}</td>
                        <td>
                          <span className={`badge bg-${status.color}`}>
                            {status.text}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => setSelectedInspection(inspection)}
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания проверки */}
      {showCreateModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">Создание новой проверки</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <form onSubmit={handleCreateInspection}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">ИНН налогоплательщика *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.taxpayer_id}
                          onChange={(e) => setFormData({...formData, taxpayer_id: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Дата проверки *</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.inspection_date}
                          onChange={(e) => setFormData({...formData, inspection_date: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Тип проверки</label>
                    <select
                      className="form-select"
                      value={formData.inspection_type_id}
                      onChange={(e) => setFormData({...formData, inspection_type_id: parseInt(e.target.value)})}
                    >
                      <option value={1}>Выездная проверка</option>
                      <option value={2}>Камеральная проверка</option>
                      <option value={3}>Встречная проверка</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Причина проверки</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formData.inspection_reason}
                      onChange={(e) => setFormData({...formData, inspection_reason: e.target.value})}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Участники проверки</label>
                    <select
                      className="form-select"
                      multiple
                      value={formData.participants}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                        setFormData({...formData, participants: selected});
                      }}
                    >
                      {availableOfficers.map(officer => (
                        <option key={officer.tax_officer_id} value={officer.tax_officer_id}>
                          {officer.tax_officer_name} ({officer.unit})
                        </option>
                      ))}
                    </select>
                    <small className="text-muted">Для выбора нескольких участников удерживайте Ctrl</small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Создать проверку
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно деталей проверки */}
      {selectedInspection && (
        <InspectionDetailModal 
          inspection={selectedInspection}
          onClose={() => setSelectedInspection(null)}
          onUpdate={fetchData}
          workerData={workerData}
        />
      )}
    </div>
  );
};

// Компонент модального окна деталей проверки
const InspectionDetailModal = ({ inspection, onClose, onUpdate, workerData }) => {
  const [inspectionDetail, setInspectionDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInspectionDetail();
  }, [inspection]);

  const fetchInspectionDetail = async () => {
    try {
      const data = await getInspectionDetail(inspection.inspection_id);
      setInspectionDetail(data);
    } catch (error) {
      console.error('Error fetching inspection detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner />;
  if (!inspectionDetail) return null;

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              Проверка #{inspectionDetail.inspection_id}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {/* Детальная информация о проверке */}
            <div className="row">
              <div className="col-md-6">
                <h6>Основная информация</h6>
                <p><strong>Дата:</strong> {new Date(inspectionDetail.inspection_date).toLocaleDateString('ru-RU')}</p>
                <p><strong>Тип:</strong> {getInspectionType(inspectionDetail.inspection_type_id)}</p>
                <p><strong>Статус:</strong> {getInspectionStatus(inspectionDetail.inspection_type_status_id).text}</p>
                <p><strong>Причина:</strong> {inspectionDetail.inspection_reason || 'Не указана'}</p>
              </div>
              <div className="col-md-6">
                <h6>Налогоплательщик</h6>
                <p><strong>ИНН:</strong> {inspectionDetail.taxpayer.inn}</p>
                <p><strong>Наименование:</strong> {inspectionDetail.taxpayer.fio || inspectionDetail.taxpayer.full_name || inspectionDetail.taxpayer.short_name}</p>
                <p><strong>Адрес регистрации:</strong> {inspectionDetail.taxpayer.registration_address || 'Не указан'}</p>
              </div>
            </div>

            <hr />

            <div className="row">
              <div className="col-md-6">
                <h6>Участники проверки</h6>
                <ul>
                  {inspectionDetail.participants.map(participant => (
                    <li key={participant.tax_officer_id}>
                      {participant.tax_officer_name} ({participant.unit})
                    </li>
                  ))}
                </ul>
              </div>
              <div className="col-md-6">
                <h6>Нарушения</h6>
                {inspectionDetail.violations.length === 0 ? (
                  <p className="text-muted">Нарушения не выявлены</p>
                ) : (
                  <ul>
                    {inspectionDetail.violations.map(violation => (
                      <li key={violation.violation_id}>
                        {violation.violation_description} - {violation.violation_amount} руб.
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            {workerData?.can_review_requests && (
              <button className="btn btn-warning">
                <i className="bi bi-pencil me-2"></i>
                Редактировать
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Вспомогательные функции (добавьте в компонент или вынесите в отдельный файл)
const getInspectionStatus = (statusId) => {
  const statusMap = {
    1: { text: 'Запланирована', color: 'warning' },
    2: { text: 'В процессе', color: 'info' },
    3: { text: 'Завершена', color: 'success' },
    4: { text: 'Отменена', color: 'danger' }
  };
  return statusMap[statusId] || { text: 'Неизвестно', color: 'secondary' };
};

const getInspectionType = (typeId) => {
  const typeMap = {
    1: 'Выездная проверка',
    2: 'Камеральная проверка',
    3: 'Встречная проверка'
  };
  return typeMap[typeId] || 'Неизвестный тип';
};

export default WorkerInspections;