import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchWorkers, getWorkerDetail, updateWorkerInfo } from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';
import SearchWorkersForm from './components/SearchWorkersForm';
import SearchWorkersResults from './components/SearchWorkersResults';
import WorkerEditModal from './components/WorkerEditModal';

const WorkerSearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  // Обработка параметра INN из URL
  useEffect(() => {
    const innFromUrl = searchParams.get('inn');
    if (innFromUrl) {
      handleAutoSearch(innFromUrl);
    }
  }, [searchParams]);

  const handleAutoSearch = async (inn) => {
    setLoading(true);
    setError('');
    try {
      const data = await searchWorkers({ type: 'simple', query: inn });
      setSearchResults(data.results || []);
      
      if (data.results && data.results.length === 1) {
        await handleWorkerSelect(data.results[0].tax_officer_id);
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
    setSelectedWorker(null);

    try {
      const data = await searchWorkers(searchParams);
      setSearchResults(data.results || []);
    } catch (err) {
      setError('Ошибка при выполнении поиска');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerSelect = async (workerId) => {
    setDetailLoading(true);
    try {
      const data = await getWorkerDetail(workerId);
      setSelectedWorker(data);
      setShowEditModal(true);
    } catch (err) {
      setError('Ошибка при загрузке детальной информации');
      console.error('Detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleWorkerUpdate = async (workerId, updateData) => {
    try {
      const updatedWorker = await updateWorkerInfo(workerId, updateData);
      
      // Обновляем выбранного сотрудника
      if (selectedWorker && selectedWorker.tax_officer_id === workerId) {
        setSelectedWorker(updatedWorker);
      }
      
      // Обновляем результаты поиска
      setSearchResults(prev => 
        prev.map(worker => 
          worker.tax_officer_id === workerId 
            ? { ...worker, ...updateData, role_name: getRoleName(updateData.role_id) }
            : worker
        )
      );
      
      return updatedWorker;
    } catch (error) {
      console.error('Worker update failed:', error);
      throw error;
    }
  };

  const getRoleName = (roleId) => {
    const roleMap = {
      1: "Инспектор",
      2: "Старший инспектор", 
      3: "Руководитель"
    };
    return roleMap[roleId] || "Неизвестно";
  };

  const clearSearch = () => {
    setSearchResults([]);
    setSelectedWorker(null);
    setError('');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Поиск сотрудников</h2>
        <div className="text-muted">
          <i className="bi bi-person-gear me-1"></i>
          Доступно только для руководителей
        </div>
      </div>

      {/* Форма поиска */}
      <SearchWorkersForm 
        onSearch={handleSearch}
        onClear={clearSearch}
        loading={loading}
      />

      {/* Сообщения об ошибках */}
      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      {/* Результаты поиска */}
      <SearchWorkersResults 
        searchResults={searchResults}
        onWorkerSelect={handleWorkerSelect}
        loading={loading}
      />

      {/* Модальное окно редактирования */}
      {showEditModal && selectedWorker && (
        <WorkerEditModal
          worker={selectedWorker}
          onClose={() => {
            setShowEditModal(false);
            setSelectedWorker(null);
          }}
          onUpdate={handleWorkerUpdate}
          isUpdating={detailLoading}
        />
      )}
    </div>
  );
};

export default WorkerSearchPage;