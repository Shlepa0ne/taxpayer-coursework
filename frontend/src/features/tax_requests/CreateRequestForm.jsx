// frontend/src/features/tax_requests/CreateRequestForm.jsx
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createTaxReduceRequest, getReduceBases } from '../../api/taxpayersApi';
import Spinner from '../../components/ui/Spinner';
import "./CreateRequestForm.css"

const CreateRequestForm = () => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState('');

  const { data: reduceBases, isLoading, isError: isBasesError } = useQuery({
    queryKey: ['reduceBases'],
    queryFn: getReduceBases,
  });

  const mutation = useMutation({
    mutationFn: createTaxReduceRequest,
    onSuccess: () => {
      // Инвалидируем кэш запросов для обновления списка заявлений
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      setAmount('');
      setDescription('');
      setSelectedBaseId('');
      alert('Заявление успешно отправлено на рассмотрение!');
    },
    onError: (error) => {
      console.error('Ошибка при отправке заявления:', error);
    }
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedBaseId) {
      alert('Пожалуйста, выберите основание для снижения налога.');
      return;
    }
    mutation.mutate({ 
      requested_reduce_amount: parseFloat(amount), 
      full_description: description,
      reduce_base: parseInt(selectedBaseId)
    });
  };

  if (isLoading) return (
    <div className="d-flex justify-content-center py-5">
      <Spinner />
    </div>
  );

  if (isBasesError) return (
    <div className="alert alert-danger">
      <i className="bi bi-exclamation-triangle me-2"></i>
      Не удалось загрузить список оснований для снижения налога.
    </div>
  );

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-primary text-white">
            <h4 className="card-title mb-0">
              <i className="bi bi-file-earmark-text me-2"></i>
              Форма заявления на снижение налога
            </h4>
          </div>
          <div className="card-body p-4">
            {/* Информационный блок */}
            <div className="alert alert-info mb-4">
              <h6 className="alert-heading">
                <i className="bi bi-info-circle me-2"></i>
                Важная информация
              </h6>
              <p className="mb-2 small">
                Заполните все поля формы для подачи заявления на снижение налоговой нагрузки. 
                После отправки заявление будет рассмотрено налоговым инспектором в течение 30 дней.
              </p>
              <p className="mb-0 small">
                <strong>Обязательные поля отмечены звёздочкой (*)</strong>
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Основание для снижения */}
              <div className="mb-4">
                <label htmlFor="reduceBase" className="form-label fw-semibold">
                  Основание для снижения налога <span className="text-danger">*</span>
                </label>
                <select
                  id="reduceBase"
                  className="form-select form-select-lg"
                  value={selectedBaseId}
                  onChange={(e) => setSelectedBaseId(e.target.value)}
                  disabled={mutation.isPending}
                  required
                >
                  <option value="">-- Выберите основание из списка --</option>
                  {reduceBases.map(base => (
                    <option key={base.reduce_base_id} value={base.reduce_base_id}>
                      {base.reduce_base_name}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  Выберите подходящее основание для снижения налога из выпадающего списка
                </div>
              </div>

              {/* Запрашиваемая сумма */}
              <div className="mb-4">
                <label htmlFor="amount" className="form-label fw-semibold">
                  Запрашиваемая сумма снижения (руб.) <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <input
                    id="amount"
                    type="number"
                    className="form-control"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={mutation.isPending}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <span className="input-group-text">₽</span>
                </div>
                <div className="form-text">
                  Укажите сумму, на которую вы хотите снизить налоговые обязательства
                </div>
              </div>

              {/* Обоснование */}
              <div className="mb-4">
                <label htmlFor="description" className="form-label fw-semibold">
                  Подробное обоснование <span className="text-danger">*</span>
                </label>
                <textarea
                  id="description"
                  className="form-control"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={mutation.isPending}
                  required
                  rows="6"
                  placeholder="Опишите подробно причины для снижения налога, предоставьте необходимые обоснования и дополнительную информацию..."
                />
                <div className="form-text">
                  Максимально подробно опишите ситуацию, требующую снижения налоговой нагрузки
                </div>
              </div>

              {/* Сообщения об ошибках */}
              {mutation.isError && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-octagon me-2"></i>
                  <strong>Ошибка при отправке заявления:</strong><br />
                  {mutation.error.response?.data?.[0] || mutation.error.message || 'Неизвестная ошибка'}
                </div>
              )}

              {/* Кнопка отправки */}
              <div className="d-grid">
                <button 
                  type="submit" 
                  className="btn btn-success btn-lg"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Отправка заявления...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-check me-2"></i>
                      Отправить заявление на рассмотрение
                    </>
                  )}
                </button>
              </div>

              {/* Дополнительная информация */}
              <div className="mt-4 p-3 bg-light rounded">
                <h6 className="text-primary mb-2">
                  <i className="bi bi-clock-history me-1"></i>
                  Сроки рассмотрения
                </h6>
                <p className="small text-muted mb-2">
                  Стандартный срок рассмотрения заявления - 30 календарных дней с момента подачи.
                </p>
                <p className="small text-muted mb-0">
                  Статус рассмотрения можно будет отслеживать в разделе "Мои заявления".
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRequestForm;