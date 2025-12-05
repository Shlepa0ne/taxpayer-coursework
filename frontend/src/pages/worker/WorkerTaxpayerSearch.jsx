// frontend/src/pages/worker/WorkerTaxpayerSearch.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  searchTaxpayers, 
  getTaxpayerDetail, 
  getRegions, 
  getRequestDetail, 
  updateRequestStatus, 
  getCurrentWorker,
  updateDeclarationStatus,
  updateTaxAccrual,
  deleteContact,
  deleteDocument,
  deleteTaxableObject
} from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RequestDetailModal from './components/RequestDetailModal';
import DeclarationDetailModal from './components/DeclarationDetailModal';
import InspectionDetailModal from './components/InspectionDetailModal';
import AccrualDetailModal from './components/AccrualDetailModal';
import ContactModal from './components/ContactModal';
import DocumentModal from './components/DocumentModal';
import ObjectModal from './components/ObjectModal';
import TaxpayerDetailView from './components/TaxpayerDetailView';
import SearchForm from './components/SearchForm';
import { getRiskScoreColor, getRiskScoreText, formatCurrency } from '../../utils/formatters';

const WorkerTaxpayerSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchResults, setSearchResults] = useState([]);
  const [expandedTaxpayerId, setExpandedTaxpayerId] = useState(null);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentWorker, setCurrentWorker] = useState(null);
  const [displayCount, setDisplayCount] = useState(10);
  const queryClient = useQueryClient();

  // Состояния для модальных окон
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [selectedAccrual, setSelectedAccrual] = useState(null);
  const [showAccrualModal, setShowAccrualModal] = useState(false);
  
  // Состояния для новых модальных окон
  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedObject, setSelectedObject] = useState(null);
  const [showObjectModal, setShowObjectModal] = useState(false);

  // Добавляем состояние для хранения деталей налогоплательщиков
  const [taxpayerDetails, setTaxpayerDetails] = useState({});

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
      // Сбрасываем счетчик отображения при новом поиске
      setDisplayCount(10);
      // Закрываем все открытые детали
      setExpandedTaxpayerId(null);
      
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

  const handleSearch = async (searchParams) => {
    setLoading(true);
    setError('');
    // Сбрасываем расширенного налогоплательщика при новом поиске
    setExpandedTaxpayerId(null);
    setTaxpayerDetails({});
    // Сбрасываем счетчик отображения
    setDisplayCount(10);

    try {
      const data = await searchTaxpayers(searchParams);
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
      // Обновляем детали текущего налогоплательщика
      if (expandedTaxpayerId) {
        handleTaxpayerSelect(expandedTaxpayerId);
      }
    },
  });

  // Функция для обновления статуса декларации
  const handleDeclarationStatusUpdate = async (declarationId, newStatus, comment = '') => {
    try {
      await updateDeclarationStatus(declarationId, {
        declaration_status_id: newStatus
      });
      
      // Обновляем данные налогоплательщика после изменения
      if (expandedTaxpayerId) {
        const updatedTaxpayer = await getTaxpayerDetail(expandedTaxpayerId);
        setTaxpayerDetails(prev => ({
          ...prev,
          [expandedTaxpayerId]: updatedTaxpayer
        }));
      }
    } catch (error) {
      console.error('WorkerTaxpayerSearch: Update failed', error);
      alert('Ошибка при обновлении статуса декларации: ' + error.message);
    }
  };

  // Функция для обновления проверки
  const handleInspectionUpdate = async (inspectionId, inspectionData) => {
    try {
      // Здесь должен быть API вызов для обновления проверки
      console.log(`Updating inspection ${inspectionId}:`, inspectionData);
      // После успешного обновления закрываем модалку и обновляем данные
      setShowInspectionModal(false);
      setSelectedInspection(null);
      if (expandedTaxpayerId) {
        const updatedTaxpayer = await getTaxpayerDetail(expandedTaxpayerId);
        setTaxpayerDetails(prev => ({
          ...prev,
          [expandedTaxpayerId]: updatedTaxpayer
        }));
      }
    } catch (error) {
      console.error('Ошибка при обновлении проверки:', error);
    }
  };

  // Функция для обновления начисления
  const handleAccrualUpdate = async (accrualId, updateData) => {
    try {
      await updateTaxAccrual(accrualId, updateData);
      
      // Обновляем данные налогоплательщика после изменения
      if (expandedTaxpayerId) {
        const updatedTaxpayer = await getTaxpayerDetail(expandedTaxpayerId);
        setTaxpayerDetails(prev => ({
          ...prev,
          [expandedTaxpayerId]: updatedTaxpayer
        }));
      }
      
      setShowAccrualModal(false);
      setSelectedAccrual(null);
    } catch (error) {
      console.error('WorkerTaxpayerSearch: Update failed', error);
      alert('Ошибка при обновлении начисления: ' + error.message);
      throw error;
    }
  };

  // Функция для удаления контакта
  const handleDeleteContact = async (contactId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот контакт?')) {
      try {
        await deleteContact(contactId);
        if (expandedTaxpayerId) {
          const updatedTaxpayer = await getTaxpayerDetail(expandedTaxpayerId);
          setTaxpayerDetails(prev => ({
            ...prev,
            [expandedTaxpayerId]: updatedTaxpayer
          }));
        }
      } catch (error) {
        console.error('Ошибка при удалении контакта:', error);
        alert('Ошибка при удалении контакта: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  // Функция для удаления документа
  const handleDeleteDocument = async (documentId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот документ?')) {
      try {
        await deleteDocument(documentId);
        if (expandedTaxpayerId) {
          const updatedTaxpayer = await getTaxpayerDetail(expandedTaxpayerId);
          setTaxpayerDetails(prev => ({
            ...prev,
            [expandedTaxpayerId]: updatedTaxpayer
          }));
        }
      } catch (error) {
        console.error('Ошибка при удалении документа:', error);
        alert('Ошибка при удалении документа: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  // Функция для удаления объекта
  const handleDeleteObject = async (objectId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот объект?')) {
      try {
        await deleteTaxableObject(objectId);
        if (expandedTaxpayerId) {
          const updatedTaxpayer = await getTaxpayerDetail(expandedTaxpayerId);
          setTaxpayerDetails(prev => ({
            ...prev,
            [expandedTaxpayerId]: updatedTaxpayer
          }));
        }
      } catch (error) {
        console.error('Ошибка при удалении объекта:', error);
        alert('Ошибка при удалении объекта: ' + (error.response?.data?.error || error.message));
      }
    }
  };

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

  // Функция для клика по декларации
  const handleDeclarationClick = async (declarationId) => {
    if (!expandedTaxpayerId) return;
    
    const taxpayerDetail = taxpayerDetails[expandedTaxpayerId];
    if (!taxpayerDetail) return;
    
    const declaration = taxpayerDetail.declarations?.find(d => d.declaration_id === declarationId);
    if (declaration) {
      setSelectedDeclaration(declaration);
      setShowDeclarationModal(true);
    }
  };

  // Функция для клика по проверке
  const handleInspectionClick = async (inspectionId) => {
    if (!expandedTaxpayerId) return;
    
    const taxpayerDetail = taxpayerDetails[expandedTaxpayerId];
    if (!taxpayerDetail) return;
    
    const inspection = taxpayerDetail.inspections?.find(i => i.inspection_id === inspectionId);
    if (inspection) {
      setSelectedInspection(inspection);
      setShowInspectionModal(true);
    }
  };

  // Функция для клика по начислению
  const handleAccrualClick = async (accrualId) => {
    if (!expandedTaxpayerId) return;
    
    const taxpayerDetail = taxpayerDetails[expandedTaxpayerId];
    if (!taxpayerDetail) return;
    
    const accrual = taxpayerDetail.accruals?.find(a => a.tax_accrual_id === accrualId);
    if (accrual) {
      setSelectedAccrual(accrual);
      setShowAccrualModal(true);
    }
  };

  // Функция для открытия контакта
  const handleContactClick = async (contact = null) => {
    setSelectedContact(contact);
    setShowContactModal(true);
  };

  // Функция для открытия документа
  const handleDocumentClick = async (document = null) => {
    setSelectedDocument(document);
    setShowDocumentModal(true);
  };

  // Функция для открытия объекта
  const handleObjectClick = async (object = null) => {
    setSelectedObject(object);
    setShowObjectModal(true);
  };

  // Функция для сохранения и обновления данных
  const handleItemSave = async () => {
    if (expandedTaxpayerId) {
      const updatedTaxpayer = await getTaxpayerDetail(expandedTaxpayerId);
      setTaxpayerDetails(prev => ({
        ...prev,
        [expandedTaxpayerId]: updatedTaxpayer
      }));
    }
  };

  // Проверяем, может ли сотрудник изменять статус заявлений
  const canChangeRequestStatus = currentWorker?.can_review_requests || false;

  // Проверка является ли сотрудник старшим инспектором
  const isSeniorInspector = currentWorker?.role_id && [2, 3].includes(Number(currentWorker.role_id));

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
    // Если кликаем на уже открытого налогоплательщика, закрываем его
    if (expandedTaxpayerId === taxpayerId) {
      setExpandedTaxpayerId(null);
      return;
    }
    
    setDetailLoading(true);
    setExpandedTaxpayerId(taxpayerId);
    
    try {
      // Проверяем, есть ли детали в кэше
      if (!taxpayerDetails[taxpayerId]) {
        const data = await getTaxpayerDetail(taxpayerId);
        setTaxpayerDetails(prev => ({
          ...prev,
          [taxpayerId]: data
        }));
      }
    } catch (err) {
      setError('Ошибка при загрузке детальной информации');
      console.error('Detail error:', err);
      setExpandedTaxpayerId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTaxpayerUpdate = async (taxpayerId) => {
    if (expandedTaxpayerId === taxpayerId) {
      const updatedTaxpayer = await getTaxpayerDetail(taxpayerId);
      setTaxpayerDetails(prev => ({
        ...prev,
        [taxpayerId]: updatedTaxpayer
      }));
    }
  };

  const clearSearch = () => {
    setSearchResults([]);
    setExpandedTaxpayerId(null);
    setTaxpayerDetails({});
    setDisplayCount(10);
    setError('');
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 10);
  };

  // Получаем отображаемые результаты (первые displayCount)
  const displayedResults = searchResults.slice(0, displayCount);
  const hasMore = searchResults.length > displayCount;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Поиск налогоплательщика</h2>
      </div>

      {/* Форма поиска */}
      <SearchForm 
        onSearch={handleSearch}
        onClear={clearSearch}
        loading={loading}
        regions={regions}
      />

      {/* Сообщения об ошибках */}
      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      {/* Результаты поиска с деталями под строкой */}
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
              {displayedResults.map(taxpayer => (
                <div key={taxpayer.taxpayer_id}>
                  <button
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
                        <div className="mt-2">
                          <i className={`bi bi-chevron-${expandedTaxpayerId === taxpayer.taxpayer_id ? 'up' : 'down'}`}></i>
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Детальная информация показывается прямо под строчкой */}
                  {expandedTaxpayerId === taxpayer.taxpayer_id && (
                    <div className="border-start border-end border-bottom bg-white">
                      <div className="p-3">
                        {detailLoading ? (
                          <div className="text-center py-4">
                            <Spinner />
                            <p className="mt-2">Загрузка деталей...</p>
                          </div>
                        ) : taxpayerDetails[taxpayer.taxpayer_id] ? (
                          <TaxpayerDetailView
                            taxpayer={taxpayerDetails[taxpayer.taxpayer_id]}
                            onRequestClick={handleRequestClick}
                            onDeclarationClick={handleDeclarationClick}
                            onInspectionClick={handleInspectionClick}
                            onAccrualClick={handleAccrualClick}
                            onContactClick={handleContactClick}
                            onDocumentClick={handleDocumentClick}
                            onObjectClick={handleObjectClick}
                            onDeleteContact={handleDeleteContact}
                            onDeleteDocument={handleDeleteDocument}
                            onDeleteObject={handleDeleteObject}
                            canChangeStatus={canChangeRequestStatus}
                            onTaxpayerUpdate={handleTaxpayerUpdate}
                            currentWorker={currentWorker}
                          />
                        ) : (
                          <div className="text-center text-muted py-4">
                            <i className="bi bi-exclamation-triangle display-4"></i>
                            <p className="mt-2">Не удалось загрузить детальную информацию</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Кнопка "Загрузить еще" */}
            {hasMore && (
              <div className="text-center p-3 border-top">
                <button 
                  className="btn btn-outline-primary"
                  onClick={handleLoadMore}
                >
                  <i className="bi bi-arrow-down-circle me-2"></i>
                  Показать еще ({searchResults.length - displayCount})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальные окна */}
      
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
          fromSearch={true}
        />
      )}

      {/* Модальное окно для деклараций */}
      {showDeclarationModal && selectedDeclaration && (
        <DeclarationDetailModal
          declaration={selectedDeclaration}
          onClose={() => {
            setShowDeclarationModal(false);
            setSelectedDeclaration(null);
          }}
          onStatusUpdate={handleDeclarationStatusUpdate}
          isUpdating={false}
          canChangeStatus={canChangeRequestStatus}
          isSeniorInspector={isSeniorInspector}
          fromSearch={true}
        />
      )}

      {/* Модальное окно для проверок */}
      {showInspectionModal && selectedInspection && (
        <InspectionDetailModal
          inspection={selectedInspection}
          onClose={() => {
            setShowInspectionModal(false);
            setSelectedInspection(null);
          }}
          onUpdate={handleInspectionUpdate}
          isUpdating={false}
          canChangeStatus={canChangeRequestStatus}
          isSeniorOrManager={isSeniorInspector}
          fromSearch={true}
        />
      )}

      {/* Модальное окно для начислений */}
      {showAccrualModal && selectedAccrual && (
        <AccrualDetailModal
          accrual={selectedAccrual}
          onClose={() => {
            setShowAccrualModal(false);
            setSelectedAccrual(null);
          }}
          onUpdate={handleAccrualUpdate}
          isUpdating={false}
          canChangeStatus={isSeniorInspector}
          fromSearch={true}
        />
      )}

      {/* Модальное окно для контактов */}
      {showContactModal && expandedTaxpayerId && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ContactModal
            contact={selectedContact}
            taxpayerId={expandedTaxpayerId}
            onClose={() => {
              setShowContactModal(false);
              setSelectedContact(null);
            }}
            onSave={() => {
              setShowContactModal(false);
              setSelectedContact(null);
              handleItemSave();
            }}
          />
        </div>
      )}

      {/* Модальное окно для документов */}
      {showDocumentModal && expandedTaxpayerId && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <DocumentModal
            document={selectedDocument}
            taxpayerId={expandedTaxpayerId}
            onClose={() => {
              setShowDocumentModal(false);
              setSelectedDocument(null);
            }}
            onSave={() => {
              setShowDocumentModal(false);
              setSelectedDocument(null);
              handleItemSave();
            }}
          />
        </div>
      )}

      {/* Модальное окно для объектов */}
      {showObjectModal && expandedTaxpayerId && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ObjectModal
            object={selectedObject}
            taxpayerId={expandedTaxpayerId}
            onClose={() => {
              setShowObjectModal(false);
              setSelectedObject(null);
            }}
            onSave={() => {
              setShowObjectModal(false);
              setSelectedObject(null);
              handleItemSave();
            }}
          />
        </div>
      )}
    </div>
  );
};

export default WorkerTaxpayerSearch;