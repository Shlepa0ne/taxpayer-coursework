// frontend/src/pages/worker/WorkerDeclarations.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeclarationsForReview, updateDeclarationStatus, getCurrentWorker } from '../../api/workersApi';
import DeclarationDetailModal from './components/DeclarationDetailModal';
import Spinner from '../../components/ui/Spinner';

const WorkerDeclarations = () => {
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const queryClient = useQueryClient();
  
  // Получаем информацию о текущем сотруднике
  const { data: currentWorker } = useQuery({
    queryKey: ['currentWorker'],
    queryFn: getCurrentWorker,
  });

  // Получаем список деклараций для рассмотрения
  const { 
    data: declarations = [], 
    isLoading, 
    error,
    refetch // Добавляем refetch для принудительного обновления
  } = useQuery({
    queryKey: ['declarationsForReview'],
    queryFn: getDeclarationsForReview,
  });

  // Мутация для обновления статуса декларации
  const updateStatusMutation = useMutation({
    mutationFn: ({ declarationId, statusData }) => {
      console.log('Sending PATCH request for declaration:', declarationId, 'with data:', statusData);
      return updateDeclarationStatus(declarationId, statusData);
    },
    onSuccess: (updatedDeclaration) => {
      console.log('Update successful:', updatedDeclaration);
      
      // ОБНОВЛЯЕМ КЭШ - обновляем конкретную декларацию в списке
      queryClient.setQueryData(['declarationsForReview'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(declaration => 
          declaration.declaration_id === updatedDeclaration.declaration_id 
            ? updatedDeclaration 
            : declaration
        );
      });
      
      // Закрываем модальное окно
      setShowDetailModal(false);
      setSelectedDeclaration(null);
    },
    onError: (error) => {
      console.error('Error updating declaration status:', error);
      alert('Ошибка при обновлении статуса декларации: ' + error.message);
    }
  });

  const handleDeclarationClick = (declaration) => {
    console.log('Selected declaration:', declaration);
    setSelectedDeclaration(declaration);
    setShowDetailModal(true);
  };

  const handleStatusUpdate = (declarationId, newStatus) => {
    console.log('handleStatusUpdate called with:', declarationId, newStatus);
    updateStatusMutation.mutate({
      declarationId,
      statusData: { declaration_status_id: newStatus }
    });
  };

  const handleCloseModal = () => {
    // При закрытии модального окна принудительно обновляем данные
    queryClient.invalidateQueries(['declarationsForReview']);
    setShowDetailModal(false);
    setSelectedDeclaration(null);
  };

  if (isLoading) return <Spinner />;
  
  if (error) {
    return (
      <div className="alert alert-danger">
        Ошибка при загрузке деклараций: {error.message}
      </div>
    );
  }

  const canChangeStatus = currentWorker?.can_review_requests || false;
  const isSeniorInspector = currentWorker?.role_id >= 2;

  console.log('Rendering WorkerDeclarations with declarations:', declarations);
  console.log('Current worker:', currentWorker);
  console.log('Can change status:', canChangeStatus);
  console.log('Is senior inspector:', isSeniorInspector);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Декларации для рассмотрения</h2>
        <div className="text-muted">
          Найдено деклараций: {declarations.length}
        </div>
      </div>

      {declarations.length === 0 ? (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          Нет деклараций для рассмотрения
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    {/* УБРАН СТОЛБЕЦ ID */}
                    <th>Налогоплательщик</th>
                    <th>Тип налога</th>
                    <th>Сумма налога</th>
                    <th>Дата подачи</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {declarations.map((declaration) => (
                    <tr key={declaration.declaration_id}>
                      {/* УБРАНА ЯЧЕЙКА С ID */}
                      <td>
                        <div>
                          <strong>
                            {declaration.taxpayer_fio || 
                             declaration.taxpayer_full_name || 
                             declaration.taxpayer_short_name || 
                             'Не указано'}
                          </strong>
                        </div>
                        <small className="text-muted">
                          ИНН: {declaration.taxpayer_inn}
                        </small>
                        {declaration.declaration_type === '6-НДФЛ' && (
                          <div>
                            <small className="text-primary">
                              Подана за: {declaration.target_taxpayer_name}
                            </small>
                          </div>
                        )}
                      </td>
                      <td>
                        <div>{declaration.tax_type_name}</div>
                        <small className="text-muted">
                          {declaration.declaration_type}
                        </small>
                      </td>
                      <td>
                        {new Intl.NumberFormat('ru-RU', {
                          style: 'currency',
                          currency: 'RUB'
                        }).format(declaration.tax_amount)}
                      </td>
                      <td>
                        {new Date(declaration.submission_date).toLocaleDateString('ru-RU')}
                      </td>
                      <td>
                        <span className={`badge ${
                          declaration.declaration_status_id === 2 ? 'bg-warning' :
                          declaration.declaration_status_id === 3 ? 'bg-success' :
                          declaration.declaration_status_id === 4 ? 'bg-danger' :
                          'bg-secondary'
                        }`}>
                          {declaration.declaration_status_id === 2 ? 'подана' :
                           declaration.declaration_status_id === 3 ? 'принята' :
                           declaration.declaration_status_id === 4 ? 'отклонена' :
                           'черновик'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => handleDeclarationClick(declaration)}
                        >
                          <i className="bi bi-eye me-1"></i>
                          Просмотр
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

      {/* Модальное окно деталей декларации */}
      {showDetailModal && selectedDeclaration && (
        <DeclarationDetailModal
          declaration={selectedDeclaration}
          onClose={handleCloseModal}
          onStatusUpdate={handleStatusUpdate}
          isUpdating={updateStatusMutation.isLoading}
          canChangeStatus={canChangeStatus}
          isSeniorInspector={isSeniorInspector}
        />
      )}
    </div>
  );
};

export default WorkerDeclarations;