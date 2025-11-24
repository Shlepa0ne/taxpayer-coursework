// frontend/src/features/declarations/DeclarationForm.jsx
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createDeclaration, getTaxTypes } from '../../api/taxpayersApi';
import Spinner from '../../components/ui/Spinner';

const DeclarationForm = () => {
  const [declarationType, setDeclarationType] = useState('3-НДФЛ');
  const [targetInn, setTargetInn] = useState('');
  const [taxTypeId, setTaxTypeId] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [totalIncome, setTotalIncome] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  // Получаем типы налогов
  const { data: taxTypes, isLoading: taxTypesLoading } = useQuery({
    queryKey: ['taxTypes'],
    queryFn: getTaxTypes,
  });

  const mutation = useMutation({
    mutationFn: createDeclaration,
    onSuccess: () => {
      // Сброс формы после успешной отправки
      setDeclarationType('3-NDFL');
      setTargetInn('');
      setTaxTypeId('');
      setTaxAmount('');
      setTotalIncome('');
      setPeriodStart('');
      setPeriodEnd('');
      alert('Декларация успешно подана!');
    },
    onError: (error) => {
      alert('Произошла ошибка при подаче декларации');
    }
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    
    if (!taxTypeId) {
      alert('Пожалуйста, выберите вид налога');
      return;
    }

    if (!periodStart || !periodEnd) {
      alert('Пожалуйста, укажите период');
      return;
    }

    if (new Date(periodStart) >= new Date(periodEnd)) {
      alert('Дата начала периода должна быть раньше даты окончания');
      return;
    }

    const declarationData = {
      declaration_type: declarationType,
      target_inn: declarationType === '6-NDFL' ? targetInn : '',
      tax_type_id: parseInt(taxTypeId),
      tax_amount: parseFloat(taxAmount),
      total_income: parseFloat(totalIncome),
      period_start: periodStart,
      period_end: periodEnd
    };

    mutation.mutate(declarationData);
  };

  // Валидация ИНН
  const validateInn = (inn) => {
    if (!inn) return true;
    const innRegex = /^\d{10}$|^\d{12}$/;
    return innRegex.test(inn);
  };

  // Генерация дат для удобства пользователя
  const setQuarterPeriod = (quarter, year = new Date().getFullYear()) => {
    const quarters = {
      1: { start: `${year}-01-01`, end: `${year}-03-31` },
      2: { start: `${year}-04-01`, end: `${year}-06-30` },
      3: { start: `${year}-07-01`, end: `${year}-09-30` },
      4: { start: `${year}-10-01`, end: `${year}-12-31` }
    };
    
    if (quarters[quarter]) {
      setPeriodStart(quarters[quarter].start);
      setPeriodEnd(quarters[quarter].end);
    }
  };

  const setYearPeriod = (year = new Date().getFullYear()) => {
    setPeriodStart(`${year}-01-01`);
    setPeriodEnd(`${year}-12-31`);
  };

  if (taxTypesLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-primary text-white">
            <h4 className="card-title mb-0">
              <i className="bi bi-file-earmark-pdf me-2"></i>
              Форма подачи налоговой декларации
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
                Заполните все поля формы для подачи налоговой декларации. 
                Дата подачи будет установлена автоматически.
              </p>
              <p className="mb-0 small">
                <strong>Обязательные поля отмечены звёздочкой (*)</strong>
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Тип декларации */}
              <div className="mb-4">
                <label className="form-label fw-semibold">
                  Тип декларации <span className="text-danger">*</span>
                </label>
                <div className="row">
                  <div className="col-md-6">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="declarationType"
                        id="3-NDFL"
                        value="3-NDFL"
                        checked={declarationType === '3-NDFL'}
                        onChange={(e) => setDeclarationType(e.target.value)}
                        disabled={mutation.isPending}
                      />
                      <label className="form-check-label fw-normal" htmlFor="3-NDFL">
                        3-НДФЛ (Декларация по налогу на доходы ФЛ)
                      </label>
                      <div className="form-text text-muted small">
                        Подается за себя
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="declarationType"
                        id="6-NDFL"
                        value="6-NDFL"
                        checked={declarationType === '6-NDFL'}
                        onChange={(e) => setDeclarationType(e.target.value)}
                        disabled={mutation.isPending}
                      />
                      <label className="form-check-label fw-normal" htmlFor="6-NDFL">
                        6-НДФЛ (Расчет сумм налога на доходы ФЛ)
                      </label>
                      <div className="form-text text-muted small">
                        Подается за другого налогоплательщика
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Поле ИНН для 6-НДФЛ */}
              {declarationType === '6-NDFL' && (
                <div className="mb-4">
                  <label htmlFor="targetInn" className="form-label fw-semibold">
                    ИНН налогоплательщика <span className="text-danger">*</span>
                  </label>
                  <input
                    id="targetInn"
                    type="text"
                    className={`form-control form-control-lg ${
                      targetInn && !validateInn(targetInn) ? 'is-invalid' : ''
                    }`}
                    value={targetInn}
                    onChange={(e) => setTargetInn(e.target.value)}
                    disabled={mutation.isPending}
                    required={declarationType === '6-NDFL'}
                    placeholder="Введите ИНН (10 или 12 цифр)"
                    maxLength="12"
                  />
                  {targetInn && !validateInn(targetInn) && (
                    <div className="invalid-feedback">
                      ИНН должен содержать 10 или 12 цифр
                    </div>
                  )}
                  <div className="form-text">
                    Укажите ИНН налогоплательщика, за которого подается декларация
                  </div>
                </div>
              )}

              {/* Вид налога */}
              <div className="mb-4">
                <label htmlFor="taxType" className="form-label fw-semibold">
                  Вид налога <span className="text-danger">*</span>
                </label>
                <select
                  id="taxType"
                  className="form-select form-select-lg"
                  value={taxTypeId}
                  onChange={(e) => setTaxTypeId(e.target.value)}
                  disabled={mutation.isPending}
                  required
                >
                  <option value="">-- Выберите вид налога --</option>
                  {taxTypes?.map(taxType => (
                    <option key={taxType.tax_type_id} value={taxType.tax_type_id}>
                      {taxType.tax_type_name}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  Выберите вид налога, по которому подается декларация
                </div>
              </div>

              {/* Начисленная сумма налога */}
              <div className="mb-4">
                <label htmlFor="taxAmount" className="form-label fw-semibold">
                  Начисленная сумма налога (руб.) <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <input
                    id="taxAmount"
                    type="number"
                    className="form-control"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    disabled={mutation.isPending}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <span className="input-group-text">₽</span>
                </div>
                <div className="form-text">
                  Укажите сумму начисленного налога по декларации
                </div>
              </div>

              {/* Общий доход */}
              <div className="mb-4">
                <label htmlFor="totalIncome" className="form-label fw-semibold">
                  Общий доход (руб.) <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <input
                    id="totalIncome"
                    type="number"
                    className="form-control"
                    value={totalIncome}
                    onChange={(e) => setTotalIncome(e.target.value)}
                    disabled={mutation.isPending}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <span className="input-group-text">₽</span>
                </div>
                <div className="form-text">
                  Укажите общую сумму дохода за отчетный период
                </div>
              </div>

              {/* Период */}
              <div className="mb-4">
                <label className="form-label fw-semibold">
                  Отчетный период <span className="text-danger">*</span>
                </label>
                
                {/* Быстрый выбор периода */}
                <div className="mb-3">
                  <label className="form-label small text-muted">
                    Быстрый выбор периода:
                  </label>
                  <div className="d-flex flex-wrap gap-2">
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setYearPeriod()}
                    >
                      Текущий год
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setQuarterPeriod(1)}
                    >
                      1 квартал
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setQuarterPeriod(2)}
                    >
                      2 квартал
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setQuarterPeriod(3)}
                    >
                      3 квартал
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setQuarterPeriod(4)}
                    >
                      4 квартал
                    </button>
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6">
                    <label htmlFor="periodStart" className="form-label">
                      Дата начала периода
                    </label>
                    <input
                      id="periodStart"
                      type="date"
                      className="form-control"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      disabled={mutation.isPending}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="periodEnd" className="form-label">
                      Дата окончания периода
                    </label>
                    <input
                      id="periodEnd"
                      type="date"
                      className="form-control"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      disabled={mutation.isPending}
                      required
                    />
                  </div>
                </div>
                <div className="form-text">
                  Укажите начальную и конечную даты отчетного периода
                </div>
              </div>

              {/* Сообщения об ошибках */}
              {mutation.isError && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-octagon me-2"></i>
                  <strong>Ошибка при подаче декларации:</strong><br />
                  {mutation.error.response?.data?.error || mutation.error.response?.data?.[0] || mutation.error.message || 'Неизвестная ошибка'}
                </div>
              )}

              {/* Кнопка отправки */}
              <div className="d-grid">
                <button 
                  type="submit" 
                  className="btn btn-success btn-lg"
                  disabled={mutation.isPending || (declarationType === '6-NDFL' && !validateInn(targetInn))}
                >
                  {mutation.isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Отправка декларации...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-check me-2"></i>
                      Подать декларацию
                    </>
                  )}
                </button>
              </div>

              {/* Дополнительная информация */}
              <div className="mt-4 p-3 bg-light rounded">
                <h6 className="text-primary mb-2">
                  <i className="bi bi-clock-history me-1"></i>
                  Сроки подачи
                </h6>
                <p className="small text-muted mb-2">
                  Декларация 3-НДФЛ подается до 30 апреля года, следующего за отчетным.
                </p>
                <p className="small text-muted mb-0">
                  Декларация 6-НДФЛ подается ежеквартально до конца месяца, следующего за отчетным кварталом.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeclarationForm;