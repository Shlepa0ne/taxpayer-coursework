// frontend/src/pages/worker/WorkerRequests.jsx
import React, { useState, useEffect } from 'react';
import { getRequestsForReview, updateRequestStatus, getCurrentWorker } from '../../api/workersApi';
import RequestDetailModal from './components/RequestDetailModal';
import Spinner from '../../components/ui/Spinner';

const WorkerRequests = () => {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [canChangeStatus, setCanChangeStatus] = useState(false);

  useEffect(() => {
    fetchRequests();
    checkUserPermissions();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getRequestsForReview();
      console.log('Requests data from API:', data);
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserPermissions = async () => {
    try {
      const workerData = await getCurrentWorker();
      console.log('Worker data:', workerData);
      
      // Старший инспектор (2) или руководитель (3) могут возвращать заявления на рассмотрение
      const canChange = workerData.role_id >= 2;
      setCanChangeStatus(canChange);
    } catch (error) {
      console.error('Error fetching worker data:', error);
      setCanChangeStatus(false);
    }
  };

  const handleStatusUpdate = async (requestId, newStatus, comment) => {
    try {
      setUpdating(true);
      const statusData = {
        request_status_id: newStatus,
        verdict_comment: comment
      };
      
      console.log('Updating request:', requestId, 'to status:', newStatus);
      
      await updateRequestStatus(requestId, statusData);
      
      // Обновляем список заявлений
      await fetchRequests();
      
      // Закрываем модальное окно
      setSelectedRequest(null);
      
      // Показываем уведомление об успехе
      alert(`Статус заявления успешно обновлен`);
      
    } catch (error) {
      console.error('Error updating request status:', error);
      alert('Ошибка при обновлении статуса заявления');
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestClick = (request) => {
    console.log('Selected request:', request);
    setSelectedRequest(request);
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
  };

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

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Заявления на снижение налогов</h2>
      </div>

      {requests.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          Нет заявлений для рассмотрения
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">
              Заявления для рассмотрения ({requests.length})
            </h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Налогоплательщик</th>
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
                      <td>#{request.request_id}</td>
                      <td>
                        <div>
                          <strong>{request.taxpayer_info?.fio || request.taxpayer_info?.full_name || 'Не указано'}</strong>
                          <br />
                          <small className="text-muted">ИНН: {request.taxpayer_info?.inn}</small>
                        </div>
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
      )}

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={handleCloseModal}
          onStatusUpdate={handleStatusUpdate}
          isUpdating={updating}
          canChangeStatus={canChangeStatus}
        />
      )}
    </div>
  );
};

export default WorkerRequests;