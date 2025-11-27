// frontend/src/pages/worker/components/InspectionDetailModal.jsx
import { useState, useEffect } from 'react';
import { 
  getInspectionDetail,
  getViolationTypes,
  getTaxPeriods,
  getInspectionViolations,
  createViolation,
  updateViolation,
  deleteViolation,
  updateInspection, // НОВЫЙ ИМПОРТ
  updateInspectionStatus // НОВЫЙ ИМПОРТ
} from '../../../api/workersApi';
import Spinner from '../../../components/ui/Spinner';

const InspectionDetailModal = ({ 
  inspection, 
  onClose, 
  onUpdate, 
  workerData, 
  inspectionBases, 
  inspectionTypes,
  availableOfficers,
  isSeniorOrManager 
}) => {
  const [inspectionDetail, setInspectionDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState([]);
  const [violationTypes, setViolationTypes] = useState([]);
  const [taxPeriods, setTaxPeriods] = useState([]);
  const [showAddViolation, setShowAddViolation] = useState(false);
  const [editingViolation, setEditingViolation] = useState(null);
  const [editMode, setEditMode] = useState(false); // НОВОЕ СОСТОЯНИЕ
  const [inspectionForm, setInspectionForm] = useState({ // НОВОЕ СОСТОЯНИЕ
    inspection_date: '',
    inspection_type_id: '',
    inspection_reason: '',
    participants: []
  });

  const [violationForm, setViolationForm] = useState({
    violation_type_id: '',
    sum_to_pay: '',
    period_id: ''
  });

  useEffect(() => {
    fetchInspectionDetail();
  }, [inspection]);

  const fetchInspectionDetail = async () => {
    try {
      const data = await getInspectionDetail(inspection.inspection_id);
      setInspectionDetail(data);
      
      // Загружаем нарушения, типы нарушений и периоды
      if (isInspectionCompleted(data)) {
        await fetchViolations();
        await fetchViolationTypes();
        await fetchTaxPeriods();
      }

      // Заполняем форму данными проверки
      setInspectionForm({
        inspection_date: data.inspection_date,
        inspection_type_id: data.inspection_type_id,
        inspection_reason: data.inspection_reason,
        participants: data.participants.map(p => p.tax_officer_id)
      });
    } catch (error) {
      console.error('Error fetching inspection detail:', error);
      alert('Ошибка загрузки деталей проверки');
    } finally {
      setLoading(false);
    }
  };

  const fetchViolations = async () => {
    try {
      const data = await getInspectionViolations(inspection.inspection_id);
      setViolations(data);
    } catch (error) {
      console.error('Error fetching violations:', error);
    }
  };

  const fetchViolationTypes = async () => {
    try {
      const data = await getViolationTypes();
      setViolationTypes(data);
    } catch (error) {
      console.error('Error fetching violation types:', error);
    }
  };

  const fetchTaxPeriods = async () => {
    try {
      const data = await getTaxPeriods();
      setTaxPeriods(data);
    } catch (error) {
      console.error('Error fetching tax periods:', error);
    }
  };

  const isInspectionCompleted = (inspectionData) => {
    if (!inspectionData) return false;
    
    // Проверяем статус "Завершена" или дата проверки уже прошла
    const inspectionDate = new Date(inspectionData.inspection_date);
    const today = new Date();
    
    return inspectionData.inspection_type_status_id === 3 || inspectionDate < today;
  };

  const canAddViolations = () => {
    return isInspectionCompleted(inspectionDetail);
  };

  // НОВАЯ ФУНКЦИЯ - может ли пользователь редактировать проверку
  const canEditInspection = () => {
    return isSeniorOrManager && !isInspectionCompleted(inspectionDetail);
  };

  // НОВАЯ ФУНКЦИЯ - обновление проверки
  const handleUpdateInspection = async (e) => {
    e.preventDefault();
    try {
      await updateInspection(inspectionDetail.inspection_id, inspectionForm);
      setEditMode(false);
      await fetchInspectionDetail(); // Перезагружаем данные
      onUpdate(); // Обновляем список проверок
      alert('Проверка успешно обновлена!');
    } catch (error) {
      console.error('Error updating inspection:', error);
      alert('Ошибка при обновлении проверки');
    }
  };

  // НОВАЯ ФУНКЦИЯ - обновление статуса проверки
  const handleUpdateStatus = async (newStatusId) => {
    try {
      await updateInspectionStatus(inspectionDetail.inspection_id, {
        inspection_type_status_id: newStatusId
      });
      await fetchInspectionDetail();
      onUpdate();
      alert('Статус проверки обновлен!');
    } catch (error) {
      console.error('Error updating inspection status:', error);
      alert('Ошибка при обновлении статуса проверки');
    }
  };

  // ОСТАЛЬНЫЕ ФУНКЦИИ (handleAddViolation, handleEditViolation и т.д.) остаются без изменений
  // ... (остальной код обработки нарушений)

  const handleAddViolation = async (e) => {
    e.preventDefault();
    try {
      await createViolation({
        inspection_id: inspectionDetail.inspection_id,
        ...violationForm
      });
      setViolationForm({ violation_type_id: '', sum_to_pay: '', period_id: '' });
      setShowAddViolation(false);
      await fetchViolations();
      alert('Нарушение успешно добавлено!');
    } catch (error) {
      console.error('Error adding violation:', error);
      alert('Ошибка при добавлении нарушения: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditViolation = (violation) => {
    setEditingViolation(violation);
    setViolationForm({
      violation_type_id: violation.violation_type_id.toString(),
      sum_to_pay: violation.sum_to_pay ? violation.sum_to_pay.toString() : '',
      period_id: violation.period_id.toString()
    });
    setShowAddViolation(true);
  };

  const handleUpdateViolation = async (e) => {
    e.preventDefault();
    try {
      await updateViolation(editingViolation.violation_id, violationForm);
      setEditingViolation(null);
      setViolationForm({ violation_type_id: '', sum_to_pay: '', period_id: '' });
      setShowAddViolation(false);
      await fetchViolations();
      alert('Нарушение успешно обновлено!');
    } catch (error) {
      console.error('Error updating violation:', error);
      alert('Ошибка при обновлении нарушения');
    }
  };

  const handleDeleteViolation = async (violationId) => {
    if (window.confirm('Вы уверены, что хотите удалить это нарушение?')) {
      try {
        await deleteViolation(violationId);
        await fetchViolations();
        alert('Нарушение успешно удалено!');
      } catch (error) {
        console.error('Error deleting violation:', error);
        alert('Ошибка при удалении нарушения');
      }
    }
  };

  const resetViolationForm = () => {
    setViolationForm({ violation_type_id: '', sum_to_pay: '', period_id: '' });
    setEditingViolation(null);
    setShowAddViolation(false);
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

  const getInspectionTypeName = (typeId) => {
    if (!inspectionTypes || inspectionTypes.length === 0) {
      return `Тип (${typeId})`;
    }
    const type = inspectionTypes.find(t => t.id === typeId);
    return type ? type.name : `Тип (${typeId})`;
  };

  const getInspectionReasonName = (reasonId) => {
    if (!inspectionBases || inspectionBases.length === 0) {
      return `Причина (${reasonId})`;
    }
    const reason = inspectionBases.find(r => r.id === reasonId);
    return reason ? reason.name : `Причина (${reasonId})`;
  };

  if (loading) return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-body text-center py-5">
            <Spinner />
            <p className="mt-3">Загрузка деталей проверки...</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (!inspectionDetail) return null;

  const status = getInspectionStatus(inspectionDetail.inspection_type_status_id);
  const canAddViolationsFlag = canAddViolations();
  const canEditInspectionFlag = canEditInspection();

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 className="modal-title mb-0">
              <i className="bi bi-clipboard-check me-2"></i>
              Проверка #{inspectionDetail.inspection_id}
            </h5>
            <div className="d-flex align-items-center gap-2">
              <span className={`badge bg-${status.color} fs-6`}>
                {status.text}
              </span>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
          </div>
          <div className="modal-body">
            
            {/* КНОПКИ УПРАВЛЕНИЯ ДЛЯ СТАРШИХ ИНСПЕКТОРОВ */}
            {isSeniorOrManager && (
              <div className="mb-4 p-3 bg-light rounded">
                <h6>Управление проверкой</h6>
                <div className="d-flex gap-2 flex-wrap">
                  {canEditInspectionFlag && (
                    <button 
                      className={`btn ${editMode ? 'btn-secondary' : 'btn-outline-primary'}`}
                      onClick={() => setEditMode(!editMode)}
                    >
                      <i className="bi bi-pencil me-1"></i>
                      {editMode ? 'Отменить редактирование' : 'Редактировать проверку'}
                    </button>
                  )}
                  
                  {/* КНОПКИ СМЕНЫ СТАТУСА */}
                  {inspectionDetail.inspection_type_status_id === 1 && (
                    <button 
                      className="btn btn-outline-info"
                      onClick={() => handleUpdateStatus(2)}
                    >
                      Начать проверку
                    </button>
                  )}
                  {inspectionDetail.inspection_type_status_id === 2 && (
                    <button 
                      className="btn btn-outline-success"
                      onClick={() => handleUpdateStatus(3)}
                    >
                      Завершить проверку
                    </button>
                  )}
                  {(inspectionDetail.inspection_type_status_id === 1 || inspectionDetail.inspection_type_status_id === 2) && (
                    <button 
                      className="btn btn-outline-danger"
                      onClick={() => {
                        if (window.confirm('Вы уверены, что хотите отменить проверку?')) {
                          handleUpdateStatus(4);
                        }
                      }}
                    >
                      Отменить проверку
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="row">
              <div className="col-md-6">
                <h6>Основная информация</h6>
                
                {editMode ? (
                  // ФОРМА РЕДАКТИРОВАНИЯ
                  <form onSubmit={handleUpdateInspection}>
                    <div className="mb-3">
                      <label className="form-label">Дата и время проверки *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={inspectionForm.inspection_date ? new Date(inspectionForm.inspection_date).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setInspectionForm({...inspectionForm, inspection_date: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label">Тип проверки *</label>
                      <select
                        className="form-select"
                        value={inspectionForm.inspection_type_id}
                        onChange={(e) => setInspectionForm({...inspectionForm, inspection_type_id: parseInt(e.target.value)})}
                        required
                      >
                        {inspectionTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label">Причина проверки *</label>
                      <select
                        className="form-select"
                        value={inspectionForm.inspection_reason}
                        onChange={(e) => setInspectionForm({...inspectionForm, inspection_reason: parseInt(e.target.value)})}
                        required
                      >
                        {inspectionBases.map(base => (
                          <option key={base.id} value={base.id}>{base.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="mb-3">
                      <label className="form-label">Участники проверки</label>
                      <select
                        className="form-select"
                        multiple
                        size="4"
                        value={inspectionForm.participants}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                          setInspectionForm({...inspectionForm, participants: selected});
                        }}
                      >
                        {availableOfficers.map(officer => (
                          <option key={officer.tax_officer_id} value={officer.tax_officer_id}>
                            {officer.tax_officer_name} ({officer.unit})
                          </option>
                        ))}
                      </select>
                      <small className="text-muted">
                        Для выбора нескольких участников удерживайте Ctrl (Cmd на Mac)
                      </small>
                    </div>
                    
                    <div className="d-flex gap-2">
                      <button type="submit" className="btn btn-success">
                        Сохранить изменения
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => setEditMode(false)}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                ) : (
                  // ОТОБРАЖЕНИЕ ИНФОРМАЦИИ
                  <>
                    <p><strong>Дата и время:</strong> {new Date(inspectionDetail.inspection_date).toLocaleString('ru-RU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                    <p><strong>Тип:</strong> {getInspectionTypeName(inspectionDetail.inspection_type_id)}</p>
                    <p><strong>Причина:</strong> {getInspectionReasonName(inspectionDetail.inspection_reason)}</p>
                  </>
                )}
              </div>
              
              <div className="col-md-6">
                <h6>Налогоплательщик</h6>
                <p><strong>ИНН:</strong> {inspectionDetail.taxpayer?.inn}</p>
                <p><strong>Наименование:</strong> {inspectionDetail.taxpayer?.fio || inspectionDetail.taxpayer?.full_name || inspectionDetail.taxpayer?.short_name}</p>
                <p><strong>Адрес регистрации:</strong> {inspectionDetail.taxpayer?.registration_address || 'Не указан'}</p>
              </div>
            </div>
            
            <hr />

            <div className="row">
              <div className="col-md-6">
                <h6>Участники проверки</h6>
                {inspectionDetail.participants && inspectionDetail.participants.length > 0 ? (
                  <ul className="list-group">
                    {inspectionDetail.participants.map(participant => (
                      <li key={participant.tax_officer_id} className="list-group-item">
                        {participant.tax_officer_name} ({participant.unit})
                        {participant.tax_officer_id === workerData?.tax_officer_id && (
                          <span className="badge bg-primary ms-2">Вы</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">Участники не назначены</p>
                )}
              </div>
              
              <div className="col-md-6">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="mb-0">Выявленные нарушения</h6>
                  {canAddViolationsFlag && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAddViolation(true)}
                    >
                      <i className="bi bi-plus-circle me-1"></i>
                      Добавить нарушение
                    </button>
                  )}
                </div>

                {/* ФОРМА ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ НАРУШЕНИЙ */}
                {showAddViolation && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <h6>{editingViolation ? 'Редактирование нарушения' : 'Добавление нарушения'}</h6>
                      <form onSubmit={editingViolation ? handleUpdateViolation : handleAddViolation}>
                        <div className="row">
                          <div className="col-md-4">
                            <label className="form-label">Тип нарушения *</label>
                            <select 
                              className="form-select"
                              value={violationForm.violation_type_id}
                              onChange={(e) => setViolationForm({...violationForm, violation_type_id: e.target.value})}
                              required
                            >
                              <option value="">Выберите тип</option>
                              {violationTypes.map(type => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Сумма</label>
                            <input 
                              type="number" 
                              className="form-control"
                              step="0.01"
                              value={violationForm.sum_to_pay}
                              onChange={(e) => setViolationForm({...violationForm, sum_to_pay: e.target.value})}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="col-md-3">
                            <label className="form-label">Период *</label>
                            <select 
                              className="form-select"
                              value={violationForm.period_id}
                              onChange={(e) => setViolationForm({...violationForm, period_id: e.target.value})}
                              required
                            >
                              <option value="">Выберите период</option>
                              {taxPeriods.map(period => (
                                <option key={period.period_id} value={period.period_id}>{period.period_name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-2 d-flex align-items-end">
                            <button type="submit" className="btn btn-success btn-sm">
                              {editingViolation ? 'Обновить' : 'Добавить'}
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-secondary btn-sm ms-2" 
                              onClick={resetViolationForm}
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* ТАБЛИЦА НАРУШЕНИЙ */}
                {violations.length === 0 ? (
                  <p className="text-muted">Нарушения не выявлены</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-striped">
                      <thead>
                        <tr>
                          <th>Тип нарушения</th>
                          <th>Сумма</th>
                          <th>Период</th>
                          {canAddViolationsFlag && <th>Действия</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {violations.map(violation => (
                          <tr key={violation.violation_id}>
                            <td>{violation.violation_type_name}</td>
                            <td>
                              {violation.sum_to_pay ? 
                                `${parseFloat(violation.sum_to_pay).toLocaleString('ru-RU')} руб.` : 
                                'Не указана'
                              }
                            </td>
                            <td>{violation.period_name}</td>
                            {canAddViolationsFlag && (
                              <td>
                                <button 
                                  className="btn btn-warning btn-sm me-1"
                                  onClick={() => handleEditViolation(violation)}
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button 
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteViolation(violation.violation_id)}
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!canAddViolationsFlag && (
                  <div className="alert alert-info mt-3">
                    <i className="bi bi-info-circle me-2"></i>
                    Для добавления нарушений проверка должна быть завершена
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectionDetailModal;