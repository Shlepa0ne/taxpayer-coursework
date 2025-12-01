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
  deleteContact, // ДОБАВЛЕНО
  deleteDocument, // ДОБАВЛЕНО
  deleteTaxableObject // ДОБАВЛЕНО
} from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RequestDetailModal from './components/RequestDetailModal';
import DeclarationDetailModal from './components/DeclarationDetailModal';
import InspectionDetailModal from './components/InspectionDetailModal';
import AccrualDetailModal from './components/AccrualDetailModal';
import ContactModal from './components/ContactModal'; // ДОБАВЛЕНО
import DocumentModal from './components/DocumentModal'; // ДОБАВЛЕНО
import ObjectModal from './components/ObjectModal'; // ДОБАВЛЕНО
import TaxpayerDetailView from './components/TaxpayerDetailView';
import SearchForm from './components/SearchForm';
import SearchResults from './components/SearchResults';
import { getRiskScoreColor, getRiskScoreText, formatCurrency } from '../../utils/formatters';

const WorkerTaxpayerSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTaxpayer, setSelectedTaxpayer] = useState(null);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentWorker, setCurrentWorker] = useState(null);
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
  
  // ДОБАВЛЕНО: Состояния для новых модальных окон
  const [selectedContact, setSelectedContact] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedObject, setSelectedObject] = useState(null);
  const [showObjectModal, setShowObjectModal] = useState(false);

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
    setSelectedTaxpayer(null);

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
      if (selectedTaxpayer) {
        handleTaxpayerSelect(selectedTaxpayer.taxpayer_id);
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
      if (selectedTaxpayer) {
        const updatedTaxpayer = await getTaxpayerDetail(selectedTaxpayer.taxpayer_id);
        setSelectedTaxpayer(updatedTaxpayer);
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
      if (selectedTaxpayer) {
        const updatedTaxpayer = await getTaxpayerDetail(selectedTaxpayer.taxpayer_id);
        setSelectedTaxpayer(updatedTaxpayer);
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
      if (selectedTaxpayer) {
        const updatedTaxpayer = await getTaxpayerDetail(selectedTaxpayer.taxpayer_id);
        setSelectedTaxpayer(updatedTaxpayer);
      }
      
      setShowAccrualModal(false);
      setSelectedAccrual(null);
    } catch (error) {
      console.error('WorkerTaxpayerSearch: Update failed', error);
      alert('Ошибка при обновлении начисления: ' + error.message);
      throw error;
    }
  };

  // ДОБАВЛЕНО: Функция для удаления контакта
  const handleDeleteContact = async (contactId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот контакт?')) {
      try {
        await deleteContact(contactId);
        if (selectedTaxpayer) {
          const updatedTaxpayer = await getTaxpayerDetail(selectedTaxpayer.taxpayer_id);
          setSelectedTaxpayer(updatedTaxpayer);
        }
      } catch (error) {
        console.error('Ошибка при удалении контакта:', error);
        alert('Ошибка при удалении контакта: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  // ДОБАВЛЕНО: Функция для удаления документа
  const handleDeleteDocument = async (documentId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот документ?')) {
      try {
        await deleteDocument(documentId);
        if (selectedTaxpayer) {
          const updatedTaxpayer = await getTaxpayerDetail(selectedTaxpayer.taxpayer_id);
          setSelectedTaxpayer(updatedTaxpayer);
        }
      } catch (error) {
        console.error('Ошибка при удалении документа:', error);
        alert('Ошибка при удалении документа: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  // ДОБАВЛЕНО: Функция для удаления объекта
  const handleDeleteObject = async (objectId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот объект?')) {
      try {
        await deleteTaxableObject(objectId);
        if (selectedTaxpayer) {
          const updatedTaxpayer = await getTaxpayerDetail(selectedTaxpayer.taxpayer_id);
          setSelectedTaxpayer(updatedTaxpayer);
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
    if (!selectedTaxpayer) return;
    
    const declaration = selectedTaxpayer.declarations.find(d => d.declaration_id === declarationId);
    if (declaration) {
      setSelectedDeclaration(declaration);
      setShowDeclarationModal(true);
    }
  };

  // Функция для клика по проверке
  const handleInspectionClick = async (inspectionId) => {
    if (!selectedTaxpayer) return;
    
    const inspection = selectedTaxpayer.inspections.find(i => i.inspection_id === inspectionId);
    if (inspection) {
      setSelectedInspection(inspection);
      setShowInspectionModal(true);
    }
  };

  // Функция для клика по начислению
  const handleAccrualClick = async (accrualId) => {
    if (!selectedTaxpayer) return;
    
    const accrual = selectedTaxpayer.accruals?.find(a => a.tax_accrual_id === accrualId);
    if (accrual) {
      setSelectedAccrual(accrual);
      setShowAccrualModal(true);
    }
  };

  // ДОБАВЛЕНО: Функция для открытия контакта
  const handleContactClick = async (contact = null) => {
    setSelectedContact(contact);
    setShowContactModal(true);
  };

  // ДОБАВЛЕНО: Функция для открытия документа
  const handleDocumentClick = async (document = null) => {
    setSelectedDocument(document);
    setShowDocumentModal(true);
  };

  // ДОБАВЛЕНО: Функция для открытия объекта
  const handleObjectClick = async (object = null) => {
    setSelectedObject(object);
    setShowObjectModal(true);
  };

  // ДОБАВЛЕНО: Функция для сохранения и обновления данных
  const handleItemSave = async () => {
    if (selectedTaxpayer) {
      const updatedTaxpayer = await getTaxpayerDetail(selectedTaxpayer.taxpayer_id);
      setSelectedTaxpayer(updatedTaxpayer);
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

  const clearSearch = () => {
    setSearchResults([]);
    setSelectedTaxpayer(null);
    setError('');
  };

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

      {/* Результаты поиска */}
      <SearchResults 
        searchResults={searchResults}
        onTaxpayerSelect={handleTaxpayerSelect}
        getRiskScoreColor={getRiskScoreColor}
        getRiskScoreText={getRiskScoreText}
      />

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
                onDeclarationClick={handleDeclarationClick}
                onInspectionClick={handleInspectionClick}
                onAccrualClick={handleAccrualClick}
                onContactClick={handleContactClick} // ДОБАВЛЕНО
                onDocumentClick={handleDocumentClick} // ДОБАВЛЕНО
                onObjectClick={handleObjectClick} // ДОБАВЛЕНО
                onDeleteContact={handleDeleteContact} // ДОБАВЛЕНО
                onDeleteDocument={handleDeleteDocument} // ДОБАВЛЕНО
                onDeleteObject={handleDeleteObject} // ДОБАВЛЕНО
                canChangeStatus={canChangeRequestStatus}
                onTaxpayerUpdate={handleTaxpayerSelect}
                currentWorker={currentWorker}
              />
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

      {/* ДОБАВЛЕНО: Модальное окно для контактов */}
      {showContactModal && selectedTaxpayer && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ContactModal
            contact={selectedContact}
            taxpayerId={selectedTaxpayer.taxpayer_id}
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

      {/* ДОБАВЛЕНО: Модальное окно для документов */}
      {showDocumentModal && selectedTaxpayer && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <DocumentModal
            document={selectedDocument}
            taxpayerId={selectedTaxpayer.taxpayer_id}
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

      {/* ДОБАВЛЕНО: Модальное окно для объектов */}
      {showObjectModal && selectedTaxpayer && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ObjectModal
            object={selectedObject}
            taxpayerId={selectedTaxpayer.taxpayer_id}
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