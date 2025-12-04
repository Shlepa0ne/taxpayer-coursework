// frontend/src/pages/worker/WorkerInspections.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getWorkerInspections, 
  getCurrentWorker, 
  createInspection, 
  getAvailableOfficers,
  searchTaxpayers,
  getInspectionBases,
  getInspectionTypes,
  getAllInspections
} from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';
import InspectionDetailModal from './components/InspectionDetailModal';

const WorkerInspections = () => {
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taxpayerSearchResults, setTaxpayerSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('my'); // для табов
  const [myPage, setMyPage] = useState(1); // страница для "мои проверки"
  const [allPage, setAllPage] = useState(1); // страница для "все проверки"
  const queryClient = useQueryClient();

  // Получаем информацию о текущем сотруднике
  const { data: workerData } = useQuery({
    queryKey: ['currentWorker'],
    queryFn: getCurrentWorker,
  });

  // Проверяем, является ли сотрудник старшим инспектором или руководителем
  const isSeniorOrManager = workerData?.role_id >= 2;

  // Получаем доступных сотрудников
  const { data: availableOfficers = [] } = useQuery({
    queryKey: ['availableOfficers'],
    queryFn: getAvailableOfficers,
  });

  // Получаем причины проверок
  const { data: inspectionBases = [] } = useQuery({
    queryKey: ['inspectionBases'],
    queryFn: getInspectionBases,
  });

  // Получаем типы проверок
  const { data: inspectionTypes = [] } = useQuery({
    queryKey: ['inspectionTypes'],
    queryFn: getInspectionTypes,
  });

  // Получаем мои проверки с пагинацией
  const { 
    data: myInspectionsData, 
    isLoading: myInspectionsLoading,
    error: myInspectionsError,
    refetch: refetchMyInspections
  } = useQuery({
    queryKey: ['workerInspections', myPage],
    queryFn: () => getWorkerInspections(myPage, 10), // 10 проверок на странице
  });

  const myInspections = myInspectionsData?.results || [];
  const myTotalCount = myInspectionsData?.count || 0;
  const myTotalPages = myInspectionsData?.total_pages || 1;

  // Получаем все проверки (только для старших инспекторов и руководителей) с пагинацией
  const { 
    data: allInspectionsData, 
    isLoading: allInspectionsLoading,
    error: allInspectionsError,
    refetch: refetchAllInspections
  } = useQuery({
    queryKey: ['allInspections', allPage],
    queryFn: () => getAllInspections(allPage, 10), // 10 проверок на странице
    enabled: isSeniorOrManager, // Запрашиваем только если есть права
  });

  const allInspections = allInspectionsData?.results || [];
  const allTotalCount = allInspectionsData?.count || 0;
  const allTotalPages = allInspectionsData?.total_pages || 1;

  // Мутация для создания проверки
  const createInspectionMutation = useMutation({
    mutationFn: createInspection,
    onSuccess: () => {
      // Инвалидируем кэш для обновления списков
      queryClient.invalidateQueries(['workerInspections']);
      queryClient.invalidateQueries(['allInspections']);
      
      setShowCreateModal(false);
      setFormData({
        taxpayer_inn: '',
        inspection_date: '',
        inspection_type_id: 1,
        inspection_reason_id: 1,
        participants: []
      });
      setTaxpayerSearchResults([]);
      
      alert('Проверка успешно создана!');
    },
    onError: (error) => {
      console.error('Error creating inspection:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Неизвестная ошибка';
      alert('Ошибка при создании проверки: ' + errorMessage);
    }
  });

  const [formData, setFormData] = useState({
    taxpayer_inn: '',
    inspection_date: '',
    inspection_type_id: 1,
    inspection_reason_id: 1,
    participants: []
  });

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
      
      // Проверяем, что дата не в прошлом
      if (selectedDate < today) {
        errors.push('Дата проверки не может быть в прошлом');
      }
      
      // Проверяем, что дата не более чем на год вперед
      const maxDate = new Date();
      maxDate.setFullYear(today.getFullYear() + 1);
      maxDate.setHours(23, 59, 59, 999);
      
      if (selectedDate > maxDate) {
        errors.push('Дата проверки не может быть более чем на год вперед');
      }
    }

    if (!formData.participants || formData.participants.length === 0) {
      errors.push('Выберите хотя бы одного участника проверки');
    }

    return errors;
  };

  const handleCreateInspection = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      // Показываем все ошибки в одном сообщении
      alert(validationErrors.join('\n'));
      return;
    }

    const selectedTaxpayer = taxpayerSearchResults.find(t => t.inn === formData.taxpayer_inn);
    if (!selectedTaxpayer) {
      alert('Пожалуйста, выберите налогоплательщика из списка');
      return;
    }

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

    createInspectionMutation.mutate(inspectionData);
  };

  // Обработчики пагинации для "моих проверок"
  const handleMyNextPage = () => {
    if (myPage < myTotalPages) {
      setMyPage(prev => prev + 1);
    }
  };

  const handleMyPrevPage = () => {
    if (myPage > 1) {
      setMyPage(prev => prev - 1);
    }
  };

  // Обработчики пагинации для "всех проверок"
  const handleAllNextPage = () => {
    if (allPage < allTotalPages) {
      setAllPage(prev => prev + 1);
    }
  };

  const handleAllPrevPage = () => {
    if (allPage > 1) {
      setAllPage(prev => prev - 1);
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

  // ФУНКЦИЯ ДЛЯ РЕНДЕРИНГА ТАБЛИЦЫ ПРОВЕРОК С ПАГИНАЦИЕЙ
  const renderInspectionsTable = (inspections, isLoading, error, totalCount, currentPage, totalPages, handlePrevPage, handleNextPage, showActions = true) => {
    if (isLoading) return <Spinner />;
    
    if (error) {
      return (
        <div className="alert alert-danger">
          Ошибка при загрузке проверок: {error.message}
        </div>
      );
    }

    if (inspections.length === 0) {
      return (
        <div className="text-center py-4">
          <i className="bi bi-clipboard-x display-4 text-muted"></i>
          <p className="mt-3 text-muted">Нет проверок</p>
        </div>
      );
    }

    return (
      <>
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Дата и время проверки</th>
                <th>Налогоплательщик</th>
                <th>Тип проверки</th>
                <th>Причина</th>
                <th>Статус</th>
                {showActions && <th>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {inspections.map((inspection) => {
                const status = getInspectionStatus(inspection.inspection_type_status_id);
                return (
                  <tr key={inspection.inspection_id}>
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
                    {showActions && (
                      <td>
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setSelectedInspection(inspection)}
                        >
                          <i className="bi bi-eye"></i>
                          Подробнее
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {totalCount > 10 && (
          <div className="d-flex justify-content-center align-items-center mt-3">
            <nav aria-label="Пагинация проверок">
              <ul className="pagination mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    <i className="bi bi-chevron-left"></i>
                  </button>
                </li>
                
                <li className="page-item active">
                  <span className="page-link">{currentPage}</span>
                </li>
                
                <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                  >
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
            
            <div className="ms-3 text-muted">
              Показано {inspections.length} из {totalCount} проверок
            </div>
          </div>
        )}
      </>
    );
  };

  // Отображаем загрузку если грузятся и workerData и myInspections
  if (!workerData || (myInspectionsLoading && activeTab === 'my') || (allInspectionsLoading && activeTab === 'all')) {
    return <Spinner />;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Проверки</h2>
        {workerData?.can_review_requests && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={createInspectionMutation.isLoading}
          >
            {createInspectionMutation.isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Создание...
              </>
            ) : (
              <>
                <i className="bi bi-plus-circle me-2"></i>
                Создать проверку
              </>
            )}
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          {/* ТАБЫ ДЛЯ СТАРШИХ ИНСПЕКТОРОВ И РУКОВОДИТЕЛЕЙ */}
          {isSeniorOrManager ? (
            <ul className="nav nav-tabs card-header-tabs">
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'my' ? 'active' : ''}`}
                  onClick={() => setActiveTab('my')}
                >
                  Мои проверки ({myTotalCount})
                </button>
              </li>
              <li className="nav-item">
                <button 
                  className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  Все проверки ({allTotalCount})
                </button>
              </li>
            </ul>
          ) : (
            <h5 className="card-title mb-0">Мои проверки ({myTotalCount})</h5>
          )}
        </div>
        <div className="card-body">
          {/* ОТОБРАЖЕНИЕ В ЗАВИСИМОСТИ ОТ АКТИВНОЙ ВКЛАДКИ */}
          {isSeniorOrManager ? (
            activeTab === 'my' ? (
              renderInspectionsTable(
                myInspections, 
                myInspectionsLoading, 
                myInspectionsError, 
                myTotalCount, 
                myPage, 
                myTotalPages,
                handleMyPrevPage,
                handleMyNextPage,
                true
              )
            ) : (
              renderInspectionsTable(
                allInspections, 
                allInspectionsLoading, 
                allInspectionsError, 
                allTotalCount, 
                allPage, 
                allTotalPages,
                handleAllPrevPage,
                handleAllNextPage,
                true
              )
            )
          ) : (
            // ДЛЯ ОБЫЧНЫХ ИНСПЕКТОРОВ - ТОЛЬКО СВОИ ПРОВЕРКИ
            renderInspectionsTable(
              myInspections, 
              myInspectionsLoading, 
              myInspectionsError, 
              myTotalCount, 
              myPage, 
              myTotalPages,
              handleMyPrevPage,
              handleMyNextPage,
              true
            )
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
                  disabled={createInspectionMutation.isLoading}
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
                          disabled={createInspectionMutation.isLoading}
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
                                  disabled={createInspectionMutation.isLoading}
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
                          disabled={createInspectionMutation.isLoading}
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
                          disabled={createInspectionMutation.isLoading}
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
                          disabled={createInspectionMutation.isLoading}
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
                      disabled={createInspectionMutation.isLoading}
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
                    disabled={createInspectionMutation.isLoading}
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={createInspectionMutation.isLoading}
                  >
                    {createInspectionMutation.isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Создание...
                      </>
                    ) : (
                      'Создать проверку'
                    )}
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
          onUpdate={() => {
            refetchMyInspections();
            refetchAllInspections();
          }}
          workerData={workerData}
          inspectionBases={inspectionBases}
          inspectionTypes={inspectionTypes}
          availableOfficers={availableOfficers}
          isSeniorOrManager={isSeniorOrManager}
        />
      )}
    </div>
  );
};

export default WorkerInspections;