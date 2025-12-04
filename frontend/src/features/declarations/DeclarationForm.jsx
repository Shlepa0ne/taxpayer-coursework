// frontend/src/features/declarations/DeclarationForm.jsx
import React, { useState, useContext, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createDeclaration, getTaxTypes } from '../../api/taxpayersApi';
import Spinner from '../../components/ui/Spinner';
import { FormContext } from '../../pages/DashboardPage';

const DeclarationForm = () => {
  // Исправлено: используем '3-NDFL' вместо '3-НДФЛ'
  const [declarationType, setDeclarationType] = useState('3-NDFL');
  const [targetInn, setTargetInn] = useState('');
  const [taxTypeId, setTaxTypeId] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [totalIncome, setTotalIncome] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  
  // Используем контекст для отслеживания dirty состояния
  const { isFormDirty, setIsFormDirty } = useContext(FormContext);
  
  // Состояние для ошибок валидации
  const [validationErrors, setValidationErrors] = useState({});

  // Получаем текущий год и даты
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 5; // 5 лет назад
  const maxDate = `${currentYear}-12-31`; // 31 декабря текущего года
  const minDate = `${minYear}-01-01`; // 1 января 5 лет назад

  // Получаем типы налогов
  const { data: taxTypes, isLoading: taxTypesLoading } = useQuery({
    queryKey: ['taxTypes'],
    queryFn: getTaxTypes,
  });

  // Сбрасываем состояние формы при монтировании
  useEffect(() => {
    setIsFormDirty(false);
  }, [setIsFormDirty]);

  // Обработка beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isFormDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isFormDirty]);

  // Общая функция для установки isFormDirty
  const setFormDirty = () => {
    if (!isFormDirty) {
      setIsFormDirty(true);
    }
  };

  // Обновленные обработчики с установкой isFormDirty
  const handleDeclarationTypeChange = (value) => {
    setFormDirty();
    setDeclarationType(value);
    // Очищаем ошибки при изменении
    const newErrors = { ...validationErrors };
    delete newErrors.targetInn;
    setValidationErrors(newErrors);
  };

  const handleTargetInnChange = (value) => {
    setFormDirty();
    setTargetInn(value);
    // Очищаем ошибки при изменении
    const newErrors = { ...validationErrors };
    delete newErrors.targetInn;
    setValidationErrors(newErrors);
  };

  const handleTaxTypeChange = (value) => {
    setFormDirty();
    setTaxTypeId(value);
    // Очищаем ошибки при изменении
    const newErrors = { ...validationErrors };
    delete newErrors.taxTypeId;
    setValidationErrors(newErrors);
  };

  const handleTaxAmountChange = (value) => {
    setFormDirty();
    setTaxAmount(value);
    // Очищаем ошибки при изменении
    const newErrors = { ...validationErrors };
    delete newErrors.taxAmount;
    delete newErrors.amountComparison;
    setValidationErrors(newErrors);
  };

  const handleTotalIncomeChange = (value) => {
    setFormDirty();
    setTotalIncome(value);
    // Очищаем ошибки при изменении
    const newErrors = { ...validationErrors };
    delete newErrors.totalIncome;
    delete newErrors.amountComparison;
    setValidationErrors(newErrors);
  };

  const handlePeriodStartChange = (value) => {
    setFormDirty();
    setPeriodStart(value);
    // Очищаем ошибки при изменении
    const newErrors = { ...validationErrors };
    delete newErrors.periodStart;
    delete newErrors.periodRange;
    delete newErrors.periodDates;
    setValidationErrors(newErrors);
  };

  const handlePeriodEndChange = (value) => {
    setFormDirty();
    setPeriodEnd(value);
    // Очищаем ошибки при изменении
    const newErrors = { ...validationErrors };
    delete newErrors.periodEnd;
    delete newErrors.periodRange;
    delete newErrors.periodDates;
    setValidationErrors(newErrors);
  };

  // Функция проверки даты (в пределах текущего года и 5 лет назад)
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    
    return year >= minYear && year <= currentYear;
  };

  // Функция проверки периода (начало < окончание)
  const isValidPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    return new Date(startDate) <= new Date(endDate);
  };

  // Валидация всей формы
  const validateForm = () => {
    const errors = {};
    
    // Валидация ИНН для 6-НДФЛ
    if (declarationType === '6-NDFL') {
      if (!targetInn) {
        errors.targetInn = 'Укажите ИНН налогоплательщика';
      } else if (!validateInn(targetInn)) {
        errors.targetInn = 'ИНН должен содержать 10 или 12 цифр';
      }
    }
    
    // Валидация вида налога
    if (!taxTypeId) {
      errors.taxTypeId = 'Выберите вид налога';
    }
    
    // Валидация суммы налога
    if (!taxAmount) {
      errors.taxAmount = 'Укажите начисленную сумму налога';
    } else if (parseFloat(taxAmount) < 0) {
      errors.taxAmount = 'Сумма налога не может быть отрицательной';
    }
    
    // Валидация общего дохода
    if (!totalIncome) {
      errors.totalIncome = 'Укажите общий доход';
    } else if (parseFloat(totalIncome) < 0) {
      errors.totalIncome = 'Общий доход не может быть отрицательным';
    }
    
    // Проверка что сумма налога не больше общего дохода
    if (taxAmount && totalIncome) {
      const tax = parseFloat(taxAmount);
      const income = parseFloat(totalIncome);
      if (tax > income) {
        errors.amountComparison = 'Сумма налога не может быть больше общего дохода';
      }
    }
    
    // Валидация периода
    if (!periodStart) {
      errors.periodStart = 'Укажите дату начала периода';
    } else if (!isValidDate(periodStart)) {
      errors.periodStart = `Год начала периода должен быть в пределах ${minYear}-${currentYear}`;
    }
    
    if (!periodEnd) {
      errors.periodEnd = 'Укажите дату окончания периода';
    } else if (!isValidDate(periodEnd)) {
      errors.periodEnd = `Год окончания периода должен быть в пределах ${minYear}-${currentYear}`;
    }
    
    if (periodStart && periodEnd && !isValidPeriod(periodStart, periodEnd)) {
      errors.periodRange = 'Дата начала должна быть раньше или равна дате окончания';
    }
    
    // Дополнительная проверка диапазона лет
    if (periodStart && periodEnd) {
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      
      if (startYear < minYear || endYear < minYear) {
        errors.periodDates = `Нельзя подавать декларацию за период раньше ${minYear} года`;
      }
      
      if (startYear > currentYear || endYear > currentYear) {
        errors.periodDates = `Нельзя подавать декларацию за период позже ${currentYear} года`;
      }
      
      // Проверка что период не превышает 5 лет
      if (endYear - startYear > 5) {
        errors.periodDates = 'Период не может превышать 5 лет';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
      setValidationErrors({});
      setIsFormDirty(false);
      alert('Декларация успешно подана!');
    },
    onError: (error) => {
      alert('Произошла ошибка при подаче декларации');
    }
  });

  // Валидация ИНН
  const validateInn = (inn) => {
    if (!inn) return true;
    const innRegex = /^\d{10}$|^\d{12}$/;
    return innRegex.test(inn);
  };

  // Генерация дат для удобства пользователя
  const setQuarterPeriod = (quarter, year = currentYear) => {
    setFormDirty();
    // Ограничиваем год текущим годом
    const selectedYear = Math.min(year, currentYear);
    
    const quarters = {
      1: { start: `${selectedYear}-01-01`, end: `${selectedYear}-03-31` },
      2: { start: `${selectedYear}-04-01`, end: `${selectedYear}-06-30` },
      3: { start: `${selectedYear}-07-01`, end: `${selectedYear}-09-30` },
      4: { start: `${selectedYear}-10-01`, end: `${selectedYear}-12-31` }
    };
    
    if (quarters[quarter]) {
      handlePeriodStartChange(quarters[quarter].start);
      handlePeriodEndChange(quarters[quarter].end);
    }
  };

  const setYearPeriod = (year = currentYear) => {
    setFormDirty();
    // Ограничиваем год текущим годом
    const selectedYear = Math.min(year, currentYear);
    handlePeriodStartChange(`${selectedYear}-01-01`);
    handlePeriodEndChange(`${selectedYear}-12-31`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    
    // Валидация формы
    if (!validateForm()) {
      // Прокрутка к первой ошибке
      const firstErrorKey = Object.keys(validationErrors)[0];
      const firstErrorElement = document.querySelector(`[data-error="${firstErrorKey}"]`);
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorElement.focus();
      }
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
                        onChange={(e) => handleDeclarationTypeChange(e.target.value)}
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
                        onChange={(e) => handleDeclarationTypeChange(e.target.value)}
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
                <div className="mb-4" data-error="targetInn">
                  <label htmlFor="targetInn" className="form-label fw-semibold">
                    ИНН налогоплательщика <span className="text-danger">*</span>
                  </label>
                  <input
                    id="targetInn"
                    type="text"
                    className={`form-control form-control-lg ${
                      validationErrors.targetInn ? 'is-invalid' : ''
                    }`}
                    value={targetInn}
                    onChange={(e) => handleTargetInnChange(e.target.value)}
                    disabled={mutation.isPending}
                    required={declarationType === '6-NDFL'}
                    placeholder="Введите ИНН (10 или 12 цифр)"
                    maxLength="12"
                  />
                  {validationErrors.targetInn && (
                    <div className="invalid-feedback d-block">
                      <i className="bi bi-exclamation-circle me-1"></i>
                      {validationErrors.targetInn}
                    </div>
                  )}
                  <div className="form-text">
                    Укажите ИНН налогоплательщика, за которого подается декларация
                  </div>
                </div>
              )}

              {/* Вид налога */}
              <div className="mb-4" data-error="taxTypeId">
                <label htmlFor="taxType" className="form-label fw-semibold">
                  Вид налога <span className="text-danger">*</span>
                </label>
                <select
                  id="taxType"
                  className={`form-select form-select-lg ${
                    validationErrors.taxTypeId ? 'is-invalid' : ''
                  }`}
                  value={taxTypeId}
                  onChange={(e) => handleTaxTypeChange(e.target.value)}
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
                {validationErrors.taxTypeId && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.taxTypeId}
                  </div>
                )}
                <div className="form-text">
                  Выберите вид налога, по которому подается декларация
                </div>
              </div>

              {/* Начисленная сумма налога */}
              <div className="mb-4" data-error="taxAmount">
                <label htmlFor="taxAmount" className="form-label fw-semibold">
                  Начисленная сумма налога (руб.) <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <input
                    id="taxAmount"
                    type="number"
                    className={`form-control ${
                      validationErrors.taxAmount || validationErrors.amountComparison ? 'is-invalid' : ''
                    }`}
                    value={taxAmount}
                    onChange={(e) => handleTaxAmountChange(e.target.value)}
                    disabled={mutation.isPending}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <span className="input-group-text">₽</span>
                </div>
                {validationErrors.taxAmount && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.taxAmount}
                  </div>
                )}
                <div className="form-text">
                  Укажите сумму начисленного налога по декларации
                </div>
              </div>

              {/* Общий доход */}
              <div className="mb-4" data-error="totalIncome">
                <label htmlFor="totalIncome" className="form-label fw-semibold">
                  Общий доход (руб.) <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <input
                    id="totalIncome"
                    type="number"
                    className={`form-control ${
                      validationErrors.totalIncome || validationErrors.amountComparison ? 'is-invalid' : ''
                    }`}
                    value={totalIncome}
                    onChange={(e) => handleTotalIncomeChange(e.target.value)}
                    disabled={mutation.isPending}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <span className="input-group-text">₽</span>
                </div>
                {validationErrors.totalIncome && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.totalIncome}
                  </div>
                )}
                {validationErrors.amountComparison && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.amountComparison}
                  </div>
                )}
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
                      Текущий год ({currentYear})
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setQuarterPeriod(1)}
                    >
                      1 квартал {currentYear}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setQuarterPeriod(2)}
                    >
                      2 квартал {currentYear}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setQuarterPeriod(3)}
                    >
                      3 квартал {currentYear}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setQuarterPeriod(4)}
                    >
                      4 квартал {currentYear}
                    </button>
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6" data-error="periodStart">
                    <label htmlFor="periodStart" className="form-label">
                      Дата начала периода
                    </label>
                    <input
                      id="periodStart"
                      type="date"
                      className={`form-control ${
                        validationErrors.periodStart || validationErrors.periodRange || validationErrors.periodDates ? 'is-invalid' : ''
                      }`}
                      value={periodStart}
                      onChange={(e) => handlePeriodStartChange(e.target.value)}
                      disabled={mutation.isPending}
                      required
                      max={maxDate}
                      min={minDate}
                    />
                    {validationErrors.periodStart && (
                      <div className="invalid-feedback d-block">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {validationErrors.periodStart}
                      </div>
                    )}
                  </div>
                  <div className="col-md-6" data-error="periodEnd">
                    <label htmlFor="periodEnd" className="form-label">
                      Дата окончания периода
                    </label>
                    <input
                      id="periodEnd"
                      type="date"
                      className={`form-control ${
                        validationErrors.periodEnd || validationErrors.periodRange || validationErrors.periodDates ? 'is-invalid' : ''
                      }`}
                      value={periodEnd}
                      onChange={(e) => handlePeriodEndChange(e.target.value)}
                      disabled={mutation.isPending}
                      required
                      max={maxDate}
                      min={minDate}
                    />
                    {validationErrors.periodEnd && (
                      <div className="invalid-feedback d-block">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {validationErrors.periodEnd}
                      </div>
                    )}
                  </div>
                </div>
                
                {validationErrors.periodRange && (
                  <div className="invalid-feedback d-block mt-2">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.periodRange}
                  </div>
                )}
                
                {validationErrors.periodDates && (
                  <div className="invalid-feedback d-block mt-2">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.periodDates}
                  </div>
                )}
                
                <div className="form-text mt-2">
                  <i className="bi bi-info-circle me-1 text-primary"></i>
                  Можно подавать декларации за период с {minYear} по {currentYear} год включительно.
                  Максимальная дата окончания: 31 декабря {currentYear} года.
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