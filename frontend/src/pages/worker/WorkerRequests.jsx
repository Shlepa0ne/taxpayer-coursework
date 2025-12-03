// frontend/src/pages/worker/WorkerRequests.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRequestsForReview, updateRequestStatus, getCurrentWorker } from '../../api/workersApi';
import RequestDetailModal from './components/RequestDetailModal';
import Spinner from '../../components/ui/Spinner';

const WorkerRequests = () => {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [page, setPage] = useState(1); // Текущая страница
  const queryClient = useQueryClient();
  
  // Получаем информацию о текущем сотруднике
  const { data: currentWorker } = useQuery({
    queryKey: ['currentWorker'],
    queryFn: getCurrentWorker,
  });

  // Получаем список заявлений для рассмотрения с пагинацией
  const { 
    data: requestsData, 
    isLoading, 
    error,
    refetch
  } = useQuery({
    queryKey: ['requestsForReview', page],
    queryFn: () => getRequestsForReview(page),
  });

  // Извлекаем заявления и информацию о пагинации
  const requests = requestsData?.results || [];
  const totalCount = requestsData?.count || 0;
  const totalPages = requestsData?.total_pages || 1;

  // Мутация для обновления статуса заявления
  const updateStatusMutation = useMutation({
    mutationFn: ({ requestId, statusData }) => {
      console.log('Sending PATCH request for request:', requestId, 'with data:', statusData);
      return updateRequestStatus(requestId, statusData);
    },
    onSuccess: (updatedRequest) => {
      console.log('Update successful:', updatedRequest);
      
      // ОБНОВЛЯЕМ КЭШ - обновляем конкретное заявление в списке
      queryClient.setQueryData(['requestsForReview', page], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          results: oldData.results.map(request => 
            request.request_id === updatedRequest.request_id 
              ? updatedRequest 
              : request
          )
        };
      });
      
      // Закрываем модальное окно
      setSelectedRequest(null);
      
      // Показываем уведомление об успехе
      alert(`Статус заявления успешно обновлен`);
    },
    onError: (error) => {
      console.error('Error updating request status:', error);
      alert('Ошибка при обновлении статуса заявления: ' + error.message);
    }
  });

  const handleStatusUpdate = async (requestId, newStatus, comment) => {
    console.log('handleStatusUpdate called with:', requestId, newStatus);
    updateStatusMutation.mutate({
      requestId,
      statusData: {
        request_status_id: newStatus,
        verdict_comment: comment
      }
    });
  };

  const handleRequestClick = (request) => {
    console.log('Selected request:', request);
    setSelectedRequest(request);
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
  };

  // Обработчики пагинации
  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(prev => prev - 1);
    }
  };

  if (isLoading) return <Spinner />;
  
  if (error) {
    return (
      <div className="alert alert-danger">
        Ошибка при загрузке заявлений: {error.message}
      </div>
    );
  }

  const canChangeStatus = currentWorker?.role_id >= 2; // Старший инспектор (2) или руководитель (3)

  console.log('Current worker:', currentWorker);
  console.log('Can change status:', canChangeStatus);

  const getStatusBadge = (statusId) => {
    console.log('Getting badge for status:', statusId);
    
    // Приводим к числу на случай, если пришла строка
    const status = Number(statusId);
    
    switch (status) {
      case 1:
        return <span className="badge bg-warning">На рассмотрении</span>;
      case 2:
        return <span className="badge bg-success">Одобрено</span>;
      case 3:
        return <span className="badge bg-danger">Отклонено</span>;
      default:
        console.warn('Unknown status ID:', statusId);
        return <span className="badge bg-secondary">Неизвестно ({statusId})</span>;
    }
  };

  // Функция для получения типа плательщика
  const getPayerType = (payerTypeId) => {
    const payerTypes = {
      1: 'Физическое лицо',
      2: 'Индивидуальный предприниматель',
      3: 'Юридическое лицо'
    };
    return payerTypes[payerTypeId] || 'Неизвестно';
  };

  // Функция для получения отображаемого имени налогоплательщика
  const getTaxpayerDisplayName = (taxpayerInfo) => {
    if (!taxpayerInfo) return 'Не указано';
    
    return taxpayerInfo.fio || taxpayerInfo.full_name || taxpayerInfo.short_name || 'Не указано';
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Заявления на снижение налогов</h2>
        <div className="text-muted">
          Всего заявлений: {totalCount} | Страница {page} из {totalPages}
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          Нет заявлений для рассмотрения
        </div>
      ) : (
        <>
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="card-title mb-0">
                Заявления для рассмотрения
              </h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Налогоплательщик</th>
                      <th>Тип плательщика</th>
                      <th>Дата подачи</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr 
                        key={request.request_id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleRequestClick(request)}
                      >
                        <td>
                          <div>
                            <strong>{getTaxpayerDisplayName(request.taxpayer_info)}</strong>
                            <br />
                            <small className="text-muted">ИНН: {request.taxpayer_info?.inn}</small>
                          </div>
                        </td>
                        <td>
                          {request.payer_type_name || getPayerType(request.taxpayer_info?.payer_type_id)}
                        </td>
                        <td>
                          {new Date(request.send_date).toLocaleDateString('ru-RU')}
                        </td>
                        <td>
                          {new Intl.NumberFormat('ru-RU', {
                            style: 'currency',
                            currency: 'RUB'
                          }).format(request.requested_reduce_amount)}
                        </td>
                        <td>
                          {getStatusBadge(request.request_status_id)}
                        </td>
                        <td>
                          <button 
                            className="btn btn-outline-primary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestClick(request);
                            }}
                          >
                            <i className="bi bi-eye me-1"></i>
                            Просмотреть
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Пагинация */}
          <div className="d-flex justify-content-center align-items-center">
            <nav aria-label="Пагинация заявлений">
              <ul className="pagination mb-0">
                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={handlePrevPage}
                    disabled={page === 1}
                  >
                    <i className="bi bi-chevron-left"></i>
                  </button>
                </li>
                
                <li className="page-item active">
                  <span className="page-link">{page}</span>
                </li>
                
                <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                  <button
                    className="page-link"
                    onClick={handleNextPage}
                    disabled={page >= totalPages}
                  >
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
            
            <div className="ms-3 text-muted">
              Показано {requests.length} из {totalCount} заявлений
            </div>
          </div>
        </>
      )}

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={handleCloseModal}
          onStatusUpdate={handleStatusUpdate}
          isUpdating={updateStatusMutation.isLoading}
          canChangeStatus={canChangeStatus}
        />
      )}
    </div>
  );
};

export default WorkerRequests;