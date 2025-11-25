// frontend/src/pages/worker/WorkerTaxpayerSearch.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchTaxpayers, getTaxpayerDetail, getRegions, getRequestDetail, updateRequestStatus, getCurrentWorker } from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RequestDetailModal from './components/RequestDetailModal';

const WorkerTaxpayerSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchType, setSearchType] = useState('simple');
  const [searchQuery, setSearchQuery] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState({
    inn: '',
    fio: '',
    org_name: '',
    region_id: '',
    payer_type_id: '',
    tax_regime_id: '',
    address: ''
  });
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTaxpayer, setSelectedTaxpayer] = useState(null);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [currentWorker, setCurrentWorker] = useState(null);
  const queryClient = useQueryClient();

  // Загрузка информации о текущем сотруднике
  useEffect(() => {
    const fetchCurrentWorker = async () => {
      try {
        const worker = await getCurrentWorker();
        setCurrentWorker(worker);
      } catch (err) {
        console.error('Error fetching current worker:', err);
      }
    };
    fetchCurrentWorker();
  }, []);

  // Обработка параметра INN из URL
  useEffect(() => {
    const innFromUrl = searchParams.get('inn');
    if (innFromUrl) {
      setSearchType('simple');
      setSearchQuery(innFromUrl);
      handleAutoSearch(innFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      const data = await getRegions();
      setRegions(data);
    } catch (err) {
      console.error('Error fetching regions:', err);
    }
  };

  const handleAutoSearch = async (inn) => {
    setLoading(true);
    setError('');
    try {
      const data = await searchTaxpayers({ type: 'simple', query: inn });
      setSearchResults(data.results || []);
      
      // Если найден ровно один результат, автоматически выбираем его
      if (data.results && data.results.length === 1) {
        await handleTaxpayerSelect(data.results[0].taxpayer_id);
      }
    } catch (err) {
      setError('Ошибка при выполнении поиска');
      console.error('Auto search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSelectedTaxpayer(null);

    try {
      const params = searchType === 'simple' 
        ? { type: 'simple', query: searchQuery }
        : { type: 'advanced', ...advancedFilters };
      
      const data = await searchTaxpayers(params);
      setSearchResults(data.results || []);
    } catch (err) {
      setError('Ошибка при выполнении поиска');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Мутация для обновления статуса заявления
  const updateStatusMutation = useMutation({
    mutationFn: ({ requestId, statusData }) => updateRequestStatus(requestId, statusData),
    onSuccess: () => {
      queryClient.invalidateQueries(['taxpayerDetail']);
      setShowRequestModal(false);
      setSelectedRequest(null);
      // Перезагружаем детали налогоплательщика
      if (selectedTaxpayer) {
        handleTaxpayerSelect(selectedTaxpayer.taxpayer_id);
      }
    },
  });

  // Функция для открытия заявления
  const handleRequestClick = async (requestId) => {
    try {
      const requestDetail = await getRequestDetail(requestId);
      setSelectedRequest(requestDetail);
      setShowRequestModal(true);
    } catch (err) {
      setError('Ошибка при загрузке деталей заявления');
    }
  };

  // Проверяем, может ли сотрудник изменять статус заявлений
  const canChangeRequestStatus = currentWorker?.can_review_requests || false;

  // Функция для обновления статуса заявления
  const handleRequestStatusUpdate = (requestId, newStatus, comment = '') => {
    updateStatusMutation.mutate({
      requestId,
      statusData: {
        request_status_id: newStatus,
        verdict_comment: comment
      }
    });
  };

  const handleTaxpayerSelect = async (taxpayerId) => {
    setDetailLoading(true);
    try {
      const data = await getTaxpayerDetail(taxpayerId);
      setSelectedTaxpayer(data);
    } catch (err) {
      setError('Ошибка при загрузке детальной информации');
      console.error('Detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAdvancedFilterChange = (field, value) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearSearch = () => {
    setSearchQuery('');
    setAdvancedFilters({
      inn: '',
      fio: '',
      org_name: '',
      region_id: '',
      payer_type_id: '',
      tax_regime_id: '',
      address: ''
    });
    setSearchResults([]);
    setSelectedTaxpayer(null);
    setError('');
  };

  const getRiskScoreColor = (score) => {
    if (score === null || score === undefined) return 'secondary';
    if (score <= 30) return 'success';
    if (score <= 70) return 'warning';
    return 'danger';
  };

  const getRiskScoreText = (score) => {
    if (score === null || score === undefined) return 'Нет данных';
    if (score <= 30) return 'Низкий риск';
    if (score <= 70) return 'Средний риск';
    return 'Высокий риск';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Поиск налогоплательщика</h2>
      </div>

      {/* Переключение типа поиска */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-light">
          <ul className="nav nav-tabs card-header-tabs">
            <li className="nav-item">
              <button
                className={`nav-link ${searchType === 'simple' ? 'active' : ''}`}
                onClick={() => setSearchType('simple')}
              >
                <i className="bi bi-search me-2"></i>
                Простой поиск
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${searchType === 'advanced' ? 'active' : ''}`}
                onClick={() => setSearchType('advanced')}
              >
                <i className="bi bi-sliders me-2"></i>
                Расширенный поиск
              </button>
            </li>
          </ul>
        </div>
        <div className="card-body">
          {/* Простой поиск */}
          {searchType === 'simple' && (
            <form onSubmit={handleSearch}>
              <div className="row">
                <div className="col-md-8">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Введите ИНН, ФИО, название организации, адрес..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      required
                    />
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Поиск...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-search me-2"></i>
                          Найти
                        </>
                      )}
                    </button>
                  </div>
                  <div className="form-text">
                    Поиск по всем полям: ИНН, ФИО, название организации, ОГРН, адрес регистрации
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Расширенный поиск */}
          {searchType === 'advanced' && (
            <form onSubmit={handleSearch}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">ИНН</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Введите ИНН"
                    value={advancedFilters.inn}
                    onChange={(e) => handleAdvancedFilterChange('inn', e.target.value)}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">ФИО (для физлиц)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Введите ФИО"
                    value={advancedFilters.fio}
                    onChange={(e) => handleAdvancedFilterChange('fio', e.target.value)}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Название организации</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Введите название организации"
                    value={advancedFilters.org_name}
                    onChange={(e) => handleAdvancedFilterChange('org_name', e.target.value)}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Регион</label>
                  <select
                    className="form-select"
                    value={advancedFilters.region_id}
                    onChange={(e) => handleAdvancedFilterChange('region_id', e.target.value)}
                  >
                    <option value="">Все регионы</option>
                    {regions.map(region => (
                      <option key={region.region_id} value={region.region_id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Тип налогоплательщика</label>
                  <select
                    className="form-select"
                    value={advancedFilters.payer_type_id}
                    onChange={(e) => handleAdvancedFilterChange('payer_type_id', e.target.value)}
                  >
                    <option value="">Все типы</option>
                    <option value="1">Физическое лицо</option>
                    <option value="2">Индивидуальный предприниматель</option>
                    <option value="3">Юридическое лицо</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Налоговый режим</label>
                  <select
                    className="form-select"
                    value={advancedFilters.tax_regime_id}
                    onChange={(e) => handleAdvancedFilterChange('tax_regime_id', e.target.value)}
                  >
                    <option value="">Все режимы</option>
                    <option value="1">ОСН</option>
                    <option value="2">УСН</option>
                    <option value="3">Патент</option>
                  </select>
                </div>
                <div className="col-12 mb-3">
                  <label className="form-label">Адрес</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Введите адрес регистрации или фактический адрес"
                    value={advancedFilters.address}
                    onChange={(e) => handleAdvancedFilterChange('address', e.target.value)}
                  />
                </div>
                <div className="col-12">
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Поиск...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-search me-2"></i>
                          Найти
                        </>
                      )}
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={clearSearch}>
                      <i className="bi bi-x-circle me-2"></i>
                      Очистить
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Сообщения об ошибках */}
      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      {/* Результаты поиска */}
      {searchResults.length > 0 && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-light">
            <h5 className="card-title mb-0">
              <i className="bi bi-list-ul me-2"></i>
              Результаты поиска ({searchResults.length})
            </h5>
          </div>
          <div className="card-body p-0">
            <div className="list-group list-group-flush">
              {searchResults.map(taxpayer => (
                <button
                  key={taxpayer.taxpayer_id}
                  className="list-group-item list-group-item-action"
                  onClick={() => handleTaxpayerSelect(taxpayer.taxpayer_id)}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 className="mb-1">
                        {taxpayer.fio || taxpayer.full_name || taxpayer.short_name || 'Без названия'}
                        {taxpayer.payer_type_id === 1 && (
                          <span className="badge bg-primary ms-2">Физ. лицо</span>
                        )}
                        {taxpayer.payer_type_id === 2 && (
                          <span className="badge bg-warning ms-2">ИП</span>
                        )}
                        {taxpayer.payer_type_id === 3 && (
                          <span className="badge bg-info ms-2">Юр. лицо</span>
                        )}
                      </h6>
                      <p className="mb-1 text-muted">
                        <strong>ИНН:</strong> {taxpayer.inn}
                        {taxpayer.ogrn && (
                          <> | <strong>ОГРН:</strong> {taxpayer.ogrn}</>
                        )}
                      </p>
                      <p className="mb-1 text-muted small">
                        <strong>Адрес:</strong> {taxpayer.registration_address || 'Не указан'}
                      </p>
                      <p className="mb-0 text-muted small">
                        <strong>Регион:</strong> {taxpayer.region_name} | 
                        <strong> Налоговый режим:</strong> {taxpayer.tax_regime_name}
                      </p>
                    </div>
                    <div className="text-end">
                      <div className={`badge bg-${getRiskScoreColor(taxpayer.risk_score)} mb-2`}>
                        RiskScore: {taxpayer.risk_score ?? 'Нет данных'}
                      </div>
                      <br />
                      <small className="text-muted">
                        {getRiskScoreText(taxpayer.risk_score)}
                      </small>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Детальная информация */}
      {selectedTaxpayer && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-primary text-white">
            <h5 className="card-title mb-0">
              <i className="bi bi-person-badge me-2"></i>
              Детальная информация о налогоплательщике
            </h5>
          </div>
          <div className="card-body">
            {detailLoading ? (
              <Spinner />
            ) : (
              <TaxpayerDetailView 
                taxpayer={selectedTaxpayer} 
                onRequestClick={handleRequestClick}
                canChangeStatus={canChangeRequestStatus}
              />
            )}
          </div>
        </div>
      )}

      {/* Модальное окно для работы с заявлениями */}
      {showRequestModal && selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => {
            setShowRequestModal(false);
            setSelectedRequest(null);
          }}
          onStatusUpdate={handleRequestStatusUpdate}
          isUpdating={updateStatusMutation.isLoading}
          canChangeStatus={canChangeRequestStatus}
        />
      )}
    </div>
  );
};

// Компонент для отображения детальной информации (ВЫНЕСЕН ОТДЕЛЬНО)
const TaxpayerDetailView = ({ taxpayer, onRequestClick, canChangeStatus }) => {
  const [activeTab, setActiveTab] = useState('main');

  // Функция для определения, можно ли кликнуть на заявление
  const canClickRequest = (request) => {
    const statusId = Number(request.request_status_id);
    // Разрешаем клик на ВСЕ заявления, независимо от статуса и прав
    // Но для заявлений не на рассмотрении показываем сообщение
    return true;
  };

  // Функция для определения, можно ли изменять статус заявления
  const canChangeRequestStatus = (request) => {
    const statusId = Number(request.request_status_id);
    // Для заявлений на рассмотрении (статус 1) - разрешаем всем
    // Для рассмотренных заявлений (статусы 2,3) - только старшим инспекторам
    return statusId === 1 || canChangeStatus;
  };

  const getRiskScoreColor = (score) => {
    if (score === null || score === undefined) return 'secondary';
    if (score <= 30) return 'success';
    if (score <= 70) return 'warning';
    return 'danger';
  };

  // Функция для получения цвета статуса заявления
    const getRequestStatusColor = (statusId) => {
      const id = Number(statusId);
      if (id === 1) return 'warning';    // на рассмотрении - желтый
      if (id === 2) return 'success';    // одобрено - зеленый
      if (id === 3) return 'danger';     // отклонено - красный
      return 'secondary';
    };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  return (
    <div>
      {/* Заголовок и RiskScore */}
      <div className="row mb-4">
        <div className="col-md-8">
          <h4>{taxpayer.fio || taxpayer.full_name || taxpayer.short_name || 'Без названия'}</h4>
          <p className="text-muted mb-0">
            <strong>ИНН:</strong> {taxpayer.inn}
            {taxpayer.ogrn && (
              <> | <strong>ОГРН:</strong> {taxpayer.ogrn}</>
            )}
          </p>
        </div>
        <div className="col-md-4 text-end">
          <div className={`display-6 fw-bold text-${getRiskScoreColor(taxpayer.risk_score)}`}>
            {taxpayer.risk_score ?? '—'}
          </div>
          <div className={`badge bg-${getRiskScoreColor(taxpayer.risk_score)} fs-6`}>
            {taxpayer.risk_score === null || taxpayer.risk_score === undefined 
              ? 'Нет данных' 
              : taxpayer.risk_score <= 30 
                ? 'Низкий риск' 
                : taxpayer.risk_score <= 70 
                  ? 'Средний риск' 
                  : 'Высокий риск'}
          </div>
        </div>
      </div>

      {/* Навигация по вкладкам */}
      <nav className="mb-4">
        <div className="nav nav-tabs">
          <button
            className={`nav-link ${activeTab === 'main' ? 'active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Основная информация
          </button>
          <button
            className={`nav-link ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Документы
          </button>
          <button
            className={`nav-link ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            Контакты
          </button>
          <button
            className={`nav-link ${activeTab === 'objects' ? 'active' : ''}`}
            onClick={() => setActiveTab('objects')}
          >
            Объекты
          </button>
          <button
            className={`nav-link ${activeTab === 'declarations' ? 'active' : ''}`}
            onClick={() => setActiveTab('declarations')}
          >
            Декларации
          </button>
          <button
            className={`nav-link ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Заявления
          </button>
          <button
            className={`nav-link ${activeTab === 'inspections' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspections')}
          >
            Проверки
          </button>
        </div>
      </nav>

      {/* Содержимое вкладок */}
      <div className="tab-content">
        {/* Основная информация */}
        {activeTab === 'main' && (
          <div className="row">
            <div className="col-md-6">
              <h6 className="text-muted mb-3">Основные данные</h6>
              <div className="mb-3">
                <strong>Тип налогоплательщика:</strong>{' '}
                <span className="badge bg-primary">{taxpayer.payer_type_name}</span>
              </div>
              <div className="mb-3">
                <strong>Регион:</strong> {taxpayer.region_name}
              </div>
              <div className="mb-3">
                <strong>Налоговый режим:</strong> {taxpayer.tax_regime_name}
              </div>
              {taxpayer.birth_date && (
                <div className="mb-3">
                  <strong>Дата рождения:</strong> {formatDate(taxpayer.birth_date)}
                </div>
              )}
              {taxpayer.registration_date && (
                <div className="mb-3">
                  <strong>Дата регистрации:</strong> {formatDate(taxpayer.registration_date)}
                </div>
              )}
            </div>
            <div className="col-md-6">
              <h6 className="text-muted mb-3">Адреса</h6>
              <div className="mb-3">
                <strong>Адрес регистрации:</strong><br />
                {taxpayer.registration_address || 'Не указан'}
              </div>
              <div className="mb-3">
                <strong>Фактический адрес:</strong><br />
                {taxpayer.fact_address || 'Не указан'}
              </div>
              {taxpayer.executive_list && (
                <div className="mb-3">
                  <strong>Руководители:</strong><br />
                  {taxpayer.executive_list}
                </div>
              )}
              {taxpayer.bank_detals && (
                <div className="mb-3">
                  <strong>Банковские реквизиты:</strong><br />
                  {taxpayer.bank_detals}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Документы */}
        {activeTab === 'documents' && (
          <div>
            {taxpayer.documents && taxpayer.documents.length > 0 ? (
              <div className="row">
                {taxpayer.documents.map(doc => (
                  <div key={doc.document_id} className="col-md-6 mb-3">
                    <div className="card border">
                      <div className="card-header bg-light">
                        <h6 className="mb-0">{doc.document_type_name}</h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-2">
                          <strong>Серия/Номер:</strong> {doc.series} {doc.number}
                        </div>
                        {doc.issued_by && (
                          <div className="mb-2">
                            <strong>Кем выдан:</strong> {doc.issued_by}
                          </div>
                        )}
                        {doc.issued_date && (
                          <div className="mb-2">
                            <strong>Дата выдачи:</strong> {formatDate(doc.issued_date)}
                          </div>
                        )}
                        {doc.expire_date && (
                          <div className="mb-2">
                            <strong>Действителен до:</strong> {formatDate(doc.expire_date)}
                          </div>
                        )}
                        {doc.additional_info && (
                          <div className="mb-0">
                            <strong>Доп. информация:</strong> {doc.additional_info}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className="bi bi-file-earmark-x display-4"></i>
                <p className="mt-2">Документы не найдены</p>
              </div>
            )}
          </div>
        )}

        {/* Контакты */}
        {activeTab === 'contacts' && (
          <div>
            {taxpayer.contacts && taxpayer.contacts.length > 0 ? (
              <div className="row">
                {taxpayer.contacts.map(contact => (
                  <div key={contact.contact_id} className="col-md-6 mb-3">
                    <div className="card border">
                      <div className="card-body">
                        <h6 className="card-title">
                          <i className={`bi ${
                            contact.contact_type_name === 'email' ? 'bi-envelope' : 'bi-telephone'
                          } me-2`}></i>
                          {contact.contact_type_name}
                        </h6>
                        <p className="card-text mb-0">{contact.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className="bi bi-telephone-x display-4"></i>
                <p className="mt-2">Контактные данные не найдены</p>
              </div>
            )}
          </div>
        )}

        {/* Объекты */}
        {activeTab === 'objects' && (
          <div>
            {taxpayer.taxable_objects && taxpayer.taxable_objects.length > 0 ? (
              <div className="row">
                {taxpayer.taxable_objects.map(ownership => {
                  const obj = ownership.object;
                  return (
                    <div key={ownership.ownership_id} className="col-12 mb-3">
                      <div className="card border">
                        <div className="card-header bg-light">
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
          </div>
        )}

        {/* Декларации */}
        {activeTab === 'declarations' && (
          <div>
            {taxpayer.declarations && taxpayer.declarations.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Тип налога</th>
                      <th>Период</th>
                      <th>Дата подачи</th>
                      <th>Сумма налога</th>
                      <th>Тип декларации</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxpayer.declarations.map(declaration => (
                      <tr key={declaration.declaration_id}>
                        <td>{declaration.tax_type_name}</td>
                        <td>{declaration.period_name}</td>
                        <td>{formatDate(declaration.submission_date)}</td>
                        <td>{formatCurrency(declaration.tax_amount)}</td>
                        <td>
                          <span className={`badge ${
                            declaration.declaration_type === '3-НДФЛ' ? 'bg-primary' : 'bg-info'
                          }`}>
                            {declaration.declaration_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className="bi bi-file-earmark-x display-4"></i>
                <p className="mt-2">Декларации не найдены</p>
              </div>
            )}
          </div>
        )}

        {/* Вкладка заявлений */}
        {activeTab === 'requests' && (
          <div>
            {taxpayer.reduce_requests && taxpayer.reduce_requests.length > 0 ? (
              <div className="row">
                {taxpayer.reduce_requests.map(request => (
                  <div 
                    key={request.request_id} 
                    className="col-12 mb-3"
                    onClick={() => canClickRequest(request) && onRequestClick(request.request_id)}
                    style={{ cursor: canClickRequest(request) ? 'pointer' : 'default' }}
                  >
                    <div className={`card border ${canClickRequest(request) ? 'hover-shadow' : ''}`}>
                      <div className="card-header bg-light">
                        <div className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">Заявление #{request.request_id}</h6>
                          <span className={`badge bg-${getRequestStatusColor(request.request_status_id)}`}>
                            {request.request_status_name}
                          </span>
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-2">
                              <strong>Дата подачи:</strong> {formatDate(request.send_date)}
                            </div>
                            <div className="mb-2">
                              <strong>Основание для снижения:</strong> {request.reduce_base_name}
                            </div>
                            <div className="mb-2">
                              <strong>Тип снижения:</strong> {request.reduce_type_name}
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-2">
                              <strong>Запрошенная сумма:</strong> {formatCurrency(request.requested_reduce_amount)}
                            </div>
                            {request.verdict_date && (
                              <div className="mb-2">
                                <strong>Дата решения:</strong> {formatDate(request.verdict_date)}
                              </div>
                            )}
                          </div>
                        </div>
                        {request.full_description && (
                          <div className="mt-3">
                            <strong>Описание:</strong>
                            <p className="mb-0">{request.full_description}</p>
                          </div>
                        )}
                        {request.periods && request.periods.length > 0 && (
                          <div className="mt-3">
                            <strong>Периоды:</strong>
                            <div className="d-flex flex-wrap gap-2 mt-2">
                              {request.periods.map(period => (
                                <span key={period.period_id} className="badge bg-secondary">
                                  {period.period_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-3">
                          <small className="text-muted">
                            <i className="bi bi-hand-index me-1"></i>
                            Нажмите для подробного просмотра
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className="bi bi-file-earmark-x display-4"></i>
                <p className="mt-2">Заявления не найдены</p>
              </div>
            )}
          </div>
        )}

        {/* Проверки */}
        {activeTab === 'inspections' && (
          <div>
            {taxpayer.inspections && taxpayer.inspections.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Дата проверки</th>
                      <th>Тип проверки</th>
                      <th>Причина</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxpayer.inspections.map(inspection => (
                      <tr key={inspection.inspection_id}>
                        <td>{formatDate(inspection.inspection_date)}</td>
                        <td>
                          <span className="badge bg-info">
                            {inspection.inspection_type_id === 1 ? 'Выездная' : 
                             inspection.inspection_type_id === 2 ? 'Камеральная' : 'Документарная'}
                          </span>
                        </td>
                        <td>
                          {inspection.inspection_reason === 1 ? 'Плановая' : 
                           inspection.inspection_reason === 2 ? 'Внеплановая' : 'По заявлению'}
                        </td>
                        <td>
                          <span className={`badge ${
                            inspection.inspection_type_status_id === 1 ? 'bg-warning' :
                            inspection.inspection_type_status_id === 2 ? 'bg-success' : 'bg-secondary'
                          }`}>
                            {inspection.inspection_type_status_id === 1 ? 'Запланирована' :
                             inspection.inspection_type_status_id === 2 ? 'Завершена' : 'Отменена'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className="bi bi-clipboard-x display-4"></i>
                <p className="mt-2">Проверки не найдены</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerTaxpayerSearch;