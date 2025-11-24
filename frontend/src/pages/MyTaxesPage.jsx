// frontend/src/pages/MyTaxesPage.jsx
import React, { useState, useEffect } from 'react';
import { getMyAccrualsWithPayments, createTaxPayment } from '../api/taxpayersApi';
import Spinner from '../components/ui/Spinner';

const MyTaxesPage = () => {
  const [accruals, setAccruals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAccrual, setSelectedAccrual] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    fetchAccruals();
  }, []);

  const fetchAccruals = async () => {
    try {
      setLoading(true);
      const data = await getMyAccrualsWithPayments();
      
      // Сортируем начисления в нужном порядке
      const sortedData = sortAccruals(data);
      setAccruals(sortedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Функция для сортировки начислений
  const sortAccruals = (accruals) => {
    return accruals.sort((a, b) => {
      // Приоритеты:
      // 1. Просроченные (is_overdue = true и remaining_amount > 0)
      // 2. Неоплаченные (remaining_amount = accrual_amount)
      // 3. Частично оплаченные (0 < remaining_amount < accrual_amount)
      // 4. Полностью оплаченные (remaining_amount = 0)

      const getPriority = (accrual) => {
        if (accrual.is_overdue && accrual.remaining_amount > 0) return 1;
        if (accrual.remaining_amount === accrual.accrual_amount) return 2;
        if (accrual.remaining_amount > 0 && accrual.remaining_amount < accrual.accrual_amount) return 3;
        return 4; // Полностью оплаченные
      };

      const priorityA = getPriority(a);
      const priorityB = getPriority(b);

      // Сначала сортируем по приоритету
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Если приоритет одинаковый, сортируем по дате начисления (новые сверху)
      return new Date(b.accrual_date) - new Date(a.accrual_date);
    });
  };

  const handlePaymentClick = (accrual) => {
    setSelectedAccrual(accrual);
    setPaymentAmount(accrual.remaining_amount.toString());
    setPaymentMessage('');
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAccrual) return;

    setPaymentLoading(true);
    setPaymentMessage('');

    try {
      await createTaxPayment({
        tax_accrual_id: selectedAccrual.tax_accrual_id,
        payment_amount: parseFloat(paymentAmount),
        payment_method: paymentMethod
      });

      setPaymentMessage('Платеж успешно создан!');
      setTimeout(() => {
        setShowPaymentModal(false);
        fetchAccruals(); // Обновляем список начислений
      }, 2000);
    } catch (err) {
      setPaymentMessage(err.response?.data?.error || 'Ошибка при создании платежа');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Функция для форматирования даты
  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  // Функция для форматирования суммы
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  // Функция для получения цвета статуса
  const getStatusColor = (accrual) => {
    if (accrual.remaining_amount === 0) return 'success';
    if (accrual.is_overdue) return 'danger';
    if (accrual.remaining_amount < accrual.accrual_amount) return 'warning';
    return 'secondary';
  };

  // Функция для получения текста статуса
  const getStatusText = (accrual) => {
    if (accrual.remaining_amount === 0) return 'Оплачено';
    if (accrual.is_overdue) return 'Просрочено';
    if (accrual.remaining_amount < accrual.accrual_amount) return 'Частично оплачено';
    return 'Ожидает оплаты';
  };

  // Функция для получения иконки статуса
  const getStatusIcon = (accrual) => {
    if (accrual.remaining_amount === 0) return 'bi-check-circle';
    if (accrual.is_overdue) return 'bi-exclamation-triangle';
    if (accrual.remaining_amount < accrual.accrual_amount) return 'bi-clock';
    return 'bi-calendar';
  };

  // Функция для получения иконки типа объекта
  const getObjectIcon = (accrual) => {
    if (accrual.object_name) {
      if (accrual.tax_type_name?.includes('Транспортный')) return 'bi-car-front';
      if (accrual.tax_type_name?.includes('имущество')) return 'bi-house';
      if (accrual.tax_type_name?.includes('земельный')) return 'bi-geo-alt';
      return 'bi-box';
    }
    if (accrual.tax_type_name?.includes('НДФЛ')) return 'bi-person-badge';
    if (accrual.tax_type_name?.includes('НДС')) return 'bi-calculator';
    return 'bi-file-earmark-text';
  };

  // Функция для получения цвета типа объекта
  const getObjectColor = (accrual) => {
    if (accrual.object_name) {
      if (accrual.tax_type_name?.includes('Транспортный')) return 'info';
      if (accrual.tax_type_name?.includes('имущество')) return 'primary';
      if (accrual.tax_type_name?.includes('земельный')) return 'success';
      return 'secondary';
    }
    if (accrual.tax_type_name?.includes('НДФЛ')) return 'warning';
    if (accrual.tax_type_name?.includes('НДС')) return 'danger';
    return 'secondary';
  };

  if (loading) return <Spinner />;

  return (
    <div className="container-fluid py-4">
      {/* Заголовок */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex align-items-center mb-3">
            <div className="bg-primary rounded-circle p-3 me-3 d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
              <i className="bi bi-cash-coin text-white fs-2"></i>
            </div>
            <div>
              <h1 className="h3 mb-1">Мои налоговые начисления</h1>
              <p className="text-muted mb-0">
                Просмотр начислений и оплата налоговых обязательств
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Ошибка при загрузке данных: {error}
        </div>
      )}

      {/* Карточки начислений */}
      <div className="row">
        {accruals.length === 0 ? (
          <div className="col-12">
            <div className="card border-0 text-center py-5">
              <div className="card-body">
                <i className="bi bi-receipt display-1 text-muted mb-3"></i>
                <h3 className="text-muted">Нет данных о начислениях</h3>
                <p className="text-muted">
                  У вас пока нет налоговых начислений
                </p>
              </div>
            </div>
          </div>
        ) : (
          accruals.map(accrual => (
            <div key={accrual.tax_accrual_id} className="col-xl-4 col-md-6 mb-4">
              <div className={`card border-0 shadow-sm h-100 ${
                accrual.is_overdue ? 'border-danger' : ''
              }`}>
                <div className="card-header bg-transparent border-0 pb-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className={`badge bg-${getStatusColor(accrual)}`}>
                      <i className={`bi ${getStatusIcon(accrual)} me-1`}></i>
                      {getStatusText(accrual)}
                    </span>
                    {accrual.is_overdue && (
                      <i className="bi bi-exclamation-triangle text-danger fs-5" 
                         title="Просрочено"></i>
                    )}
                  </div>
                </div>
                
                <div className="card-body">
                  {/* Основание начисления */}
                  <div className="mb-3">
                    <small className="text-muted">Основание начисления</small>
                    <div className="fw-semibold">
                      <i className={`bi ${getObjectIcon(accrual)} me-2 text-${getObjectColor(accrual)}`}></i>
                      {accrual.accrual_reason}
                    </div>
                    {accrual.object_name && (
                      <div className="small text-muted mt-1">
                        {accrual.object_address || accrual.object_name}
                      </div>
                    )}
                    {accrual.tax_type_name && (
                      <div className="small text-muted mt-1">
                        {accrual.tax_type_name}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <small className="text-muted">Дата начисления</small>
                    <div className="fw-semibold">
                      <i className="bi bi-calendar-event me-2 text-primary"></i>
                      {formatDate(accrual.accrual_date)}
                    </div>
                  </div>

                  <div className="mb-3">
                    <small className="text-muted">Сумма начисления</small>
                    <div className="fw-bold fs-5 text-dark">
                      {formatCurrency(accrual.accrual_amount)}
                    </div>
                  </div>

                  <div className="mb-3">
                    <small className="text-muted">Срок оплаты</small>
                    <div className={`fw-semibold ${
                      accrual.is_overdue ? 'text-danger' : 'text-dark'
                    }`}>
                      <i className="bi bi-clock me-2"></i>
                      {formatDate(accrual.due_date)}
                    </div>
                  </div>

                  <div className="row text-center mb-3">
                    <div className="col-6">
                      <small className="text-muted d-block">Оплачено</small>
                      <span className="fw-semibold text-success">
                        {formatCurrency(accrual.paid_amount)}
                      </span>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">Остаток</small>
                      <span className="fw-semibold text-dark">
                        {formatCurrency(accrual.remaining_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Прогресс-бар оплаты */}
                  {accrual.accrual_amount > 0 && (
                    <div className="mb-3">
                      <div className="progress" style={{ height: '8px' }}>
                        <div 
                          className={`progress-bar ${
                            accrual.remaining_amount === 0 ? 'bg-success' :
                            accrual.is_overdue ? 'bg-danger' : 'bg-primary'
                          }`}
                          style={{ 
                            width: `${(accrual.paid_amount / accrual.accrual_amount) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <small className="text-muted">
                        {((accrual.paid_amount / accrual.accrual_amount) * 100).toFixed(1)}% оплачено
                      </small>
                    </div>
                  )}
                </div>

                <div className="card-footer bg-transparent border-0 pt-0">
                  {accrual.remaining_amount > 0 && (
                    <button
                      className="btn btn-primary w-100"
                      onClick={() => handlePaymentClick(accrual)}
                      disabled={paymentLoading}
                    >
                      <i className="bi bi-credit-card me-2"></i>
                      Оплатить
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Модальное окно оплаты */}
      {showPaymentModal && selectedAccrual && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-credit-card me-2"></i>
                  Оплата налогового начисления
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={paymentLoading}
                ></button>
              </div>
              
              <form onSubmit={handlePaymentSubmit}>
                <div className="modal-body">
                  {/* Информация о начислении */}
                  <div className="card border-0 bg-light mb-3">
                    <div className="card-body">
                      <h6 className="card-title text-primary mb-3">
                        <i className="bi bi-info-circle me-1"></i>
                        Информация о начислении
                      </h6>
                      
                      {/* Основание начисления в модальном окне */}
                      <div className="mb-3">
                        <div className="text-muted small">Основание:</div>
                        <div className="fw-bold">
                          <i className={`bi ${getObjectIcon(selectedAccrual)} me-2 text-${getObjectColor(selectedAccrual)}`}></i>
                          {selectedAccrual.accrual_reason}
                        </div>
                        {selectedAccrual.object_name && (
                          <div className="small text-muted mt-1">
                            {selectedAccrual.object_address || selectedAccrual.object_name}
                          </div>
                        )}
                        {selectedAccrual.tax_type_name && (
                          <div className="small text-muted mt-1">
                            {selectedAccrual.tax_type_name}
                          </div>
                        )}
                      </div>

                      <div className="row small">
                        <div className="col-6">
                          <div className="text-muted">Дата начисления:</div>
                          <div className="fw-semibold">{formatDate(selectedAccrual.accrual_date)}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted">Срок оплаты:</div>
                          <div className={`fw-semibold ${
                            selectedAccrual.is_overdue ? 'text-danger' : ''
                          }`}>
                            {formatDate(selectedAccrual.due_date)}
                          </div>
                        </div>
                      </div>
                      <div className="row small mt-2">
                        <div className="col-6">
                          <div className="text-muted">Общая сумма:</div>
                          <div className="fw-bold">{formatCurrency(selectedAccrual.accrual_amount)}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted">Остаток к оплате:</div>
                          <div className="fw-bold text-success">{formatCurrency(selectedAccrual.remaining_amount)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Форма оплаты */}
                  <div className="mb-3">
                    <label htmlFor="paymentAmount" className="form-label fw-semibold">
                      Сумма оплаты <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        id="paymentAmount"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        min="0.01"
                        max={selectedAccrual.remaining_amount}
                        step="0.01"
                        required
                        disabled={paymentLoading}
                      />
                      <span className="input-group-text">₽</span>
                    </div>
                    <div className="form-text">
                      Максимальная сумма: {formatCurrency(selectedAccrual.remaining_amount)}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Способ оплаты</label>
                    <div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="paymentMethod"
                          value="card"
                          checked={paymentMethod === 'card'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          disabled={paymentLoading}
                        />
                        <label className="form-check-label">
                          <i className="bi bi-credit-card me-2 text-primary"></i>
                          Банковская карта
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="paymentMethod"
                          value="SPB"
                          checked={paymentMethod === 'SPB'}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          disabled={paymentLoading}
                        />
                        <label className="form-check-label">
                          <i className="bi bi-phone me-2 text-success"></i>
                          Система быстрых платежей (СБП)
                        </label>
                      </div>
                    </div>
                  </div>

                  {paymentMessage && (
                    <div className={`alert ${
                      paymentMessage.includes('успешно') ? 'alert-success' : 'alert-danger'
                    }`}>
                      <i className={`bi ${
                        paymentMessage.includes('успешно') ? 'bi-check-circle' : 'bi-exclamation-triangle'
                      } me-2`}></i>
                      {paymentMessage}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowPaymentModal(false)}
                    disabled={paymentLoading}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={paymentLoading || !paymentAmount}
                  >
                    {paymentLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Обработка...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-bag-check me-2"></i>
                        Оплатить
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Информационный блок */}
      <div className="row mt-5">
        <div className="col-12">
          <div className="card border-0 bg-light">
            <div className="card-body">
              <h5 className="card-title text-primary">
                <i className="bi bi-info-circle me-2"></i>
                Важная информация
              </h5>
              <div className="row">
                <div className="col-md-4 mb-3 mt-3">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-clock-history text-warning fs-4 me-3"></i>
                    <div>
                      <h6 className="mb-1">Сроки оплаты</h6>
                      <p className="small text-muted mb-0">
                        Оплатите налоги до указанной даты, чтобы избежать пеней
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4 mb-3 mt-3">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-shield-check text-success fs-4 me-3"></i>
                    <div>
                      <h6 className="mb-1">Безопасность</h6>
                      <p className="small text-muted mb-0">
                        Все платежи защищены и проходят через безопасное соединение
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4 mb-3 mt-3">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-telephone text-primary fs-4 me-3"></i>
                    <div>
                      <h6 className="mb-1">Поддержка</h6>
                      <p className="small text-muted mb-0">
                        При возникновении вопросов обращайтесь в службу поддержки
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTaxesPage;