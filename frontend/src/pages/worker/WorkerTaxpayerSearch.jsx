import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  searchTaxpayers, 
  getTaxpayerDetail, 
  getRegions, 
  getRequestDetail, 
  updateRequestStatus, 
  getCurrentWorker,
  updateDeclarationStatus // ДОБАВИТЬ этот импорт
} from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RequestDetailModal from './components/RequestDetailModal';
import DeclarationDetailModal from './components/DeclarationDetailModal'; // ДОБАВИТЬ
import InspectionDetailModal from './components/InspectionDetailModal'; // ДОБАВИТЬ
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
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  
  // ДОБАВИТЬ: состояния для модальных окон
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  
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

  // ДОБАВИТЬ: функция для обновления статуса декларации
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

  // ДОБАВИТЬ: функция для обновления проверки
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

  // ДОБАВИТЬ: функция для клика по декларации
  const handleDeclarationClick = async (declarationId) => {
    if (!selectedTaxpayer) return;
    
    const declaration = selectedTaxpayer.declarations.find(d => d.declaration_id === declarationId);
    if (declaration) {
      setSelectedDeclaration(declaration);
      setShowDeclarationModal(true);
    }
  };

  // ДОБАВИТЬ: функция для клика по проверке
  const handleInspectionClick = async (inspectionId) => {
    if (!selectedTaxpayer) return;
    
    const inspection = selectedTaxpayer.inspections.find(i => i.inspection_id === inspectionId);
    if (inspection) {
      setSelectedInspection(inspection);
      setShowInspectionModal(true);
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

  // Проверяем, может ли сотрудник изменять статус заявлений
  const canChangeRequestStatus = currentWorker?.can_review_requests || false;

  // ДОБАВИТЬ: проверка является ли сотрудник старшим инспектором
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
                onDeclarationClick={handleDeclarationClick} // ДОБАВИТЬ
                onInspectionClick={handleInspectionClick} // ДОБАВИТЬ
                canChangeStatus={canChangeRequestStatus}
                onTaxpayerUpdate={handleTaxpayerSelect}
                currentWorker={currentWorker}
              />
            )}
          </div>
        </div>
      )}

      {/* Модальные окна ВЫНЕСЕНЫ НА ВЕРХНИЙ УРОВЕНЬ */}
      
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
    </div>
  );
};

export default WorkerTaxpayerSearch;