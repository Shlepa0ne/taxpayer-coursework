// frontend/src/pages/worker/WorkerInspections.jsx
import { useState, useEffect } from 'react';
import { 
  getWorkerInspections, 
  getCurrentWorker, 
  createInspection, 
  getAvailableOfficers,
  searchTaxpayers,
  getInspectionBases,
  getInspectionTypes} from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';
import InspectionDetailModal from './components/InspectionDetailModal';

const WorkerInspections = () => {
  const [inspections, setInspections] = useState([]);
  const [workerData, setWorkerData] = useState(null);
  const [availableOfficers, setAvailableOfficers] = useState([]);
  const [inspectionBases, setInspectionBases] = useState([]);
  const [inspectionTypes, setInspectionTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [taxpayerSearchResults, setTaxpayerSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [formData, setFormData] = useState({
    taxpayer_inn: '',
    inspection_date: '',
    inspection_type_id: 1,
    inspection_reason_id: 1,
    participants: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inspectionsData, workerData, officersData, basesData, typesData] = await Promise.all([
        getWorkerInspections(),
        getCurrentWorker(),
        getAvailableOfficers(),
        getInspectionBases(),
        getInspectionTypes()
      ]);
      
      console.log('Inspections data:', inspectionsData);
      console.log('Inspection bases:', basesData);
      console.log('Inspection types:', typesData);
      
      // СОРТИРОВКА ПРОВЕРОК
      const sortedInspections = sortInspections(inspectionsData);
      setInspections(sortedInspections);
      
      setWorkerData(workerData);
      setAvailableOfficers(officersData);
      setInspectionBases(basesData);
      setInspectionTypes(typesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // ФУНКЦИЯ ДЛЯ СОРТИРОВКИ ПРОВЕРОК
  const sortInspections = (inspections) => {
    const now = new Date();
    
    return [...inspections].sort((a, b) => {
      const dateA = new Date(a.inspection_date);
      const dateB = new Date(b.inspection_date);
      
      // Будущие проверки (включая сегодня) идут первыми
      const isAFuture = dateA >= now;
      const isBFuture = dateB >= now;
      
      if (isAFuture && !isBFuture) return -1; // A будущая, B прошедшая - A идет первой
      if (!isAFuture && isBFuture) return 1;  // A прошедшая, B будущая - B идет первой
      
      // Если обе будущие - сортируем по возрастанию (ближайшие сначала)
      if (isAFuture && isBFuture) {
        return dateA - dateB;
      }
      
      // Если обе прошедшие - сортируем по убыванию (последние сначала)
      return dateB - dateA;
    });
  };

  const handleTaxpayerSearch = async (inn) => {
    if (inn.length < 10) {
      setTaxpayerSearchResults([]);
      return;
    }
    
    try {
      setSearchLoading(true);
      const results = await searchTaxpayers({ type: 'simple', query: inn });
      setTaxpayerSearchResults(results.results || []);
    } catch (error) {
      console.error('Error searching taxpayer:', error);
      setTaxpayerSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.taxpayer_inn) {
      errors.push('Выберите налогоплательщика');
    }

    if (!formData.inspection_date) {
      errors.push('Укажите дату проверки');
    } else {
      const selectedDate = new Date(formData.inspection_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        errors.push('Дата проверки не может быть в прошлом');
      }
    }

    return errors;
  };

  const handleCreateInspection = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      alert(validationErrors.join('\n'));
      return;
    }

    const selectedTaxpayer = taxpayerSearchResults.find(t => t.inn === formData.taxpayer_inn);
    if (!selectedTaxpayer) {
      alert('Пожалуйста, выберите налогоплательщика из списка');
      return;
    }

    try {
      const inspectionDate = new Date(formData.inspection_date);
      const formattedDate = inspectionDate.toISOString();

      const inspectionData = {
        taxpayer_id: selectedTaxpayer.taxpayer_id,
        inspection_date: formattedDate,
        inspection_type_id: parseInt(formData.inspection_type_id),
        inspection_reason_id: parseInt(formData.inspection_reason_id),
        participants: formData.participants.map(p => parseInt(p))
      };

      console.log('Sending inspection data:', inspectionData);

      await createInspection(inspectionData);
      setShowCreateModal(false);
      setFormData({
        taxpayer_inn: '',
        inspection_date: '',
        inspection_type_id: 1,
        inspection_reason_id: 1,
        participants: []
      });
      setTaxpayerSearchResults([]);
      fetchData();
      alert('Проверка успешно создана!');
    } catch (error) {
      console.error('Error creating inspection:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Неизвестная ошибка';
      alert('Ошибка при создании проверки: ' + errorMessage);
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
                    <th>Дата и время проверки</th> {/* ИЗМЕНИЛИ НАЗВАНИЕ КОЛОНКИ */}
                    <th>Налогоплательщик</th>
                    <th>Тип проверки</th>
                    <th>Причина</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((inspection) => {
                    const status = getInspectionStatus(inspection.inspection_type_status_id);
                    return (
                      <tr key={inspection.inspection_id}>
                        {/* ИЗМЕНИЛИ ОТОБРАЖЕНИЕ ДАТЫ НА ПОЛНУЮ ДАТУ И ВРЕМЯ */}
                        <td>{new Date(inspection.inspection_date).toLocaleString('ru-RU', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</td>
                        <td>
                          {inspection.taxpayer?.fio || inspection.taxpayer?.full_name || inspection.taxpayer?.short_name}
                          <br />
                          <small className="text-muted">ИНН: {inspection.taxpayer?.inn}</small>
                        </td>
                        <td>{getInspectionTypeName(inspection.inspection_type_id)}</td>
                        <td>{getInspectionReasonName(inspection.inspection_reason)}</td>
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
                            Подробнее
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
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setShowCreateModal(false);
                    setTaxpayerSearchResults([]);
                  }}
                ></button>
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
                          value={formData.taxpayer_inn}
                          onChange={(e) => {
                            const inn = e.target.value;
                            setFormData({...formData, taxpayer_inn: inn});
                            handleTaxpayerSearch(inn);
                          }}
                          placeholder="Введите ИНН для поиска"
                          required
                        />
                        {searchLoading && (
                          <div className="mt-1">
                            <small className="text-muted">
                              <i className="bi bi-search me-1"></i>
                              Поиск...
                            </small>
                          </div>
                        )}
                        {taxpayerSearchResults.length > 0 && (
                          <div className="mt-2">
                            <small className="text-muted">Выберите налогоплательщика:</small>
                            <div className="list-group mt-1" style={{maxHeight: '150px', overflowY: 'auto'}}>
                              {taxpayerSearchResults.map(taxpayer => (
                                <button
                                  type="button"
                                  key={taxpayer.taxpayer_id}
                                  className={`list-group-item list-group-item-action ${
                                    formData.taxpayer_inn === taxpayer.inn ? 'active' : ''
                                  }`}
                                  onClick={() => setFormData({
                                    ...formData, 
                                    taxpayer_inn: taxpayer.inn
                                  })}
                                >
                                  <div>
                                    <strong>{taxpayer.fio || taxpayer.full_name || taxpayer.short_name}</strong>
                                    <br />
                                    <small>ИНН: {taxpayer.inn} | {taxpayer.payer_type_name}</small>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {formData.taxpayer_inn && taxpayerSearchResults.length === 0 && !searchLoading && (
                          <div className="mt-1">
                            <small className="text-danger">
                              Налогоплательщик с таким ИНН не найден
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Дата и время проверки *</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={formData.inspection_date}
                          onChange={(e) => setFormData({...formData, inspection_date: e.target.value})}
                          min={new Date().toISOString().slice(0, 16)}
                          required
                        />
                        <small className="text-muted">
                          Выберите дату и время будущей проверки
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Тип проверки *</label>
                        <select
                          className="form-select"
                          value={formData.inspection_type_id}
                          onChange={(e) => setFormData({...formData, inspection_type_id: parseInt(e.target.value)})}
                          required
                        >
                          {inspectionTypes.map(type => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Причина проверки *</label>
                        <select
                          className="form-select"
                          value={formData.inspection_reason_id}
                          onChange={(e) => setFormData({...formData, inspection_reason_id: parseInt(e.target.value)})}
                          required
                        >
                          {inspectionBases.map(base => (
                            <option key={base.id} value={base.id}>
                              {base.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Участники проверки</label>
                    <select
                      className="form-select"
                      multiple
                      size="4"
                      value={formData.participants}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setFormData({...formData, participants: selected});
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
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowCreateModal(false);
                      setTaxpayerSearchResults([]);
                    }}
                  >
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
          inspectionBases={inspectionBases}
          inspectionTypes={inspectionTypes}
        />
      )}
    </div>
  );
};

export default WorkerInspections;