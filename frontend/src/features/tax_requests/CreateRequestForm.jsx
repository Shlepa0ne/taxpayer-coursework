import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTaxReduceRequest, getReduceBases, getTaxTypes } from '../../api/taxpayersApi';
import Spinner from '../../components/ui/Spinner';
import "./CreateRequestForm.css"
import { useContext } from 'react';
import { FormContext } from '../../pages/DashboardPage';

const CreateRequestForm = () => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedReduceTypeId, setSelectedReduceTypeId] = useState('');
  const [selectedTaxTypes, setSelectedTaxTypes] = useState([]);
  const [periods, setPeriods] = useState([{ start_date: '', end_date: '' }]);
  
  // ИСПРАВЛЕНО: используем оба значения из контекста
  const { isFormDirty, setIsFormDirty } = useContext(FormContext);
  
  // Добавляем состояние для ошибок
  const [validationErrors, setValidationErrors] = useState({});
  
  const formRef = useRef(null);

  // Добавлен useQueryClient
  const queryClient = useQueryClient();

  const { data: reduceBases, isLoading: basesLoading, isError: isBasesError } = useQuery({
    queryKey: ['reduceBases'],
    queryFn: getReduceBases,
  });

  const { data: taxTypes, isLoading: taxTypesLoading } = useQuery({
    queryKey: ['taxTypes'],
    queryFn: getTaxTypes,
  });

  // Сбрасываем состояние формы при монтировании компонента
  useEffect(() => {
    setIsFormDirty(false);
  }, [setIsFormDirty]);

  // Функция проверки даты (в пределах ±5 лет от текущей)
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    
    const date = new Date(dateString);
    const now = new Date();
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(now.getFullYear() - 5);
    const fiveYearsFromNow = new Date();
    fiveYearsFromNow.setFullYear(now.getFullYear() + 5);
    
    return date >= fiveYearsAgo && date <= fiveYearsFromNow;
  };

  // Функция проверки периода (начало < окончание)
  const isValidPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return false;
    return new Date(startDate) < new Date(endDate);
  };

  // Проверка всей формы
  const validateForm = () => {
    const errors = {};
    
    // Проверка типа снижения
    if (!selectedReduceTypeId) {
      errors.reduceType = 'Выберите тип снижения';
    }
    
    // Проверка основания
    if (!selectedBaseId) {
      errors.base = 'Выберите основание для снижения';
    }
    
    // Проверка типов налогов
    if (selectedTaxTypes.length === 0) {
      errors.taxTypes = 'Выберите хотя бы один вид налога';
    }
    
    // Проверка периодов
    periods.forEach((period, index) => {
      if (!period.start_date) {
        errors[`period_start_${index}`] = 'Укажите дату начала периода';
      } else if (!isValidDate(period.start_date)) {
        errors[`period_start_${index}`] = 'Дата должна быть в пределах ±5 лет от текущей';
      }
      
      if (!period.end_date) {
        errors[`period_end_${index}`] = 'Укажите дату окончания периода';
      } else if (!isValidDate(period.end_date)) {
        errors[`period_end_${index}`] = 'Дата должна быть в пределах ±5 лет от текущей';
      }
      
      if (period.start_date && period.end_date && !isValidPeriod(period.start_date, period.end_date)) {
        errors[`period_range_${index}`] = 'Дата начала должна быть раньше даты окончания';
      }
    });
    
    // Проверка суммы
    if (!amount) {
      errors.amount = 'Укажите запрашиваемую сумму снижения';
    } else if (parseFloat(amount) <= 0) {
      errors.amount = 'Сумма должна быть положительной';
    }
    
    // Проверка описания
    if (!description.trim()) {
      errors.description = 'Заполните подробное обоснование';
    } else if (description.trim().length < 20) {
      errors.description = 'Обоснование должно быть не менее 20 символов';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Общая функция для установки isFormDirty
  const setFormDirty = () => {
    if (!isFormDirty) {
      setIsFormDirty(true);
    }
  };

  // Отслеживаем изменения формы для isFormDirty
  const handleFieldChange = (setter, value) => {
    setFormDirty();
    setter(value);
  };

  const mutation = useMutation({
    mutationFn: createTaxReduceRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      setAmount('');
      setDescription('');
      setSelectedBaseId('');
      setSelectedReduceTypeId('');
      setSelectedTaxTypes([]);
      setPeriods([{ start_date: '', end_date: '' }]);
      setValidationErrors({});
      setIsFormDirty(false);
      alert('Заявление успешно отправлено на рассмотрение!');
    },
    onError: (error) => {
      console.error('Ошибка при отправке заявления:', error);
      alert('Произошла ошибка при отправке заявления');
    }
  });

  const handleTaxTypeChange = (taxTypeId) => {
    setFormDirty();
    setSelectedTaxTypes(prev => 
      prev.includes(taxTypeId) 
        ? prev.filter(id => id !== taxTypeId)
        : [...prev, taxTypeId]
    );
  };

  const addPeriod = () => {
    setFormDirty();
    setPeriods([...periods, { start_date: '', end_date: '' }]);
  };

  const removePeriod = (index) => {
    if (periods.length > 1) {
      setFormDirty();
      const newPeriods = periods.filter((_, i) => i !== index);
      setPeriods(newPeriods);
    }
  };

  const updatePeriod = (index, field, value) => {
    setFormDirty();
    const newPeriods = periods.map((period, i) => 
      i === index ? { ...period, [field]: value } : period
    );
    setPeriods(newPeriods);
  };

  // Генерация дат для удобства пользователя
  const setQuarterPeriod = (quarter, year = new Date().getFullYear()) => {
    setFormDirty();
    const quarters = {
      1: { start: `${year}-01-01`, end: `${year}-03-31` },
      2: { start: `${year}-04-01`, end: `${year}-06-30` },
      3: { start: `${year}-07-01`, end: `${year}-09-30` },
      4: { start: `${year}-10-01`, end: `${year}-12-31` }
    };
    
    if (quarters[quarter]) {
      setPeriods([{ start_date: quarters[quarter].start, end_date: quarters[quarter].end }]);
    }
  };

  const setYearPeriod = (year = new Date().getFullYear()) => {
    setFormDirty();
    setPeriods([{ start_date: `${year}-01-01`, end_date: `${year}-12-31` }]);
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

    mutation.mutate({ 
      requested_reduce_amount: parseFloat(amount), 
      full_description: description,
      reduce_base: parseInt(selectedBaseId),
      reduce_type: parseInt(selectedReduceTypeId),
      tax_types: selectedTaxTypes.map(id => parseInt(id)),
      periods: periods
    });
  };

  const isLoading = basesLoading || taxTypesLoading;

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
      <div className="col-lg-10">
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

            <form ref={formRef} onSubmit={handleSubmit}>
              {/* Тип снижения */}
              <div className="mb-4" data-error="reduceType">
                <label htmlFor="reduceType" className="form-label fw-semibold">
                  Тип снижения <span className="text-danger">*</span>
                </label>
                <select
                  id="reduceType"
                  className={`form-select form-select-lg ${validationErrors.reduceType ? 'is-invalid' : ''}`}
                  value={selectedReduceTypeId}
                  onChange={(e) => handleFieldChange(setSelectedReduceTypeId, e.target.value)}
                  disabled={mutation.isPending}
                  required
                >
                  <option value="">-- Выберите тип снижения --</option>
                  <option value="1">Полное освобождение</option>
                  <option value="2">Частичное снижение</option>
                </select>
                {validationErrors.reduceType && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.reduceType}
                  </div>
                )}
                <div className="form-text">
                  Выберите тип снижения налоговой нагрузки
                </div>
              </div>

              {/* Основание для снижения */}
              <div className="mb-4" data-error="base">
                <label htmlFor="reduceBase" className="form-label fw-semibold">
                  Основание для снижения налога <span className="text-danger">*</span>
                </label>
                <select
                  id="reduceBase"
                  className={`form-select form-select-lg ${validationErrors.base ? 'is-invalid' : ''}`}
                  value={selectedBaseId}
                  onChange={(e) => handleFieldChange(setSelectedBaseId, e.target.value)}
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
                {validationErrors.base && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.base}
                  </div>
                )}
                <div className="form-text">
                  Выберите подходящее основание для снижения налога из выпадающего списка
                </div>
              </div>

              {/* Типы налогов */}
              <div className="mb-4" data-error="taxTypes">
                <label className="form-label fw-semibold">
                  Типы налогов для снижения <span className="text-danger">*</span>
                </label>
                <div className={`border rounded p-3 ${validationErrors.taxTypes ? 'border-danger' : ''}`}>
                  {taxTypes?.map(taxType => (
                    <div key={taxType.tax_type_id} className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`taxType-${taxType.tax_type_id}`}
                        checked={selectedTaxTypes.includes(taxType.tax_type_id)}
                        onChange={() => handleTaxTypeChange(taxType.tax_type_id)}
                        disabled={mutation.isPending}
                      />
                      <label className="form-check-label" htmlFor={`taxType-${taxType.tax_type_id}`}>
                        {taxType.tax_type_name}
                      </label>
                    </div>
                  ))}
                </div>
                {validationErrors.taxTypes && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.taxTypes}
                  </div>
                )}
                <div className="form-text">
                  Выберите типы налогов, для которых запрашивается снижение
                </div>
              </div>

              {/* Периоды */}
              <div className="mb-4">
                <label className="form-label fw-semibold">
                  Налоговые периоды <span className="text-danger">*</span>
                </label>
                
                {/* Быстрый выбор периода */}
                <div className="mb-3">
                  <label className="form-label small text-muted">
                    Быстрый выбор периода (применится к первому периоду):
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

                {periods.map((period, index) => (
                  <div key={index} className="border rounded p-3 mb-3 position-relative">
                    {periods.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger position-absolute top-0 end-0 m-2"
                        onClick={() => removePeriod(index)}
                        disabled={mutation.isPending}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                    
                    <h6 className="text-primary mb-3">
                      Период {index + 1}
                    </h6>
                    
                    <div className="row">
                      <div className="col-md-6" data-error={`period_start_${index}`}>
                        <label htmlFor={`periodStart-${index}`} className="form-label">
                          Дата начала периода <span className="text-danger">*</span>
                        </label>
                        <input
                          id={`periodStart-${index}`}
                          type="date"
                          className={`form-control ${validationErrors[`period_start_${index}`] || validationErrors[`period_range_${index}`] ? 'is-invalid' : ''}`}
                          value={period.start_date}
                          onChange={(e) => updatePeriod(index, 'start_date', e.target.value)}
                          disabled={mutation.isPending}
                          required
                          max={new Date(new Date().getFullYear() + 5, 11, 31).toISOString().split('T')[0]}
                          min={new Date(new Date().getFullYear() - 5, 0, 1).toISOString().split('T')[0]}
                        />
                        {validationErrors[`period_start_${index}`] && (
                          <div className="invalid-feedback d-block">
                            <i className="bi bi-exclamation-circle me-1"></i>
                            {validationErrors[`period_start_${index}`]}
                          </div>
                        )}
                      </div>
                      <div className="col-md-6" data-error={`period_end_${index}`}>
                        <label htmlFor={`periodEnd-${index}`} className="form-label">
                          Дата окончания периода <span className="text-danger">*</span>
                        </label>
                        <input
                          id={`periodEnd-${index}`}
                          type="date"
                          className={`form-control ${validationErrors[`period_end_${index}`] || validationErrors[`period_range_${index}`] ? 'is-invalid' : ''}`}
                          value={period.end_date}
                          onChange={(e) => updatePeriod(index, 'end_date', e.target.value)}
                          disabled={mutation.isPending}
                          required
                          max={new Date(new Date().getFullYear() + 5, 11, 31).toISOString().split('T')[0]}
                          min={new Date(new Date().getFullYear() - 5, 0, 1).toISOString().split('T')[0]}
                        />
                        {validationErrors[`period_end_${index}`] && (
                          <div className="invalid-feedback d-block">
                            <i className="bi bi-exclamation-circle me-1"></i>
                            {validationErrors[`period_end_${index}`]}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {validationErrors[`period_range_${index}`] && (
                      <div className="invalid-feedback d-block mt-2">
                        <i className="bi bi-exclamation-circle me-1"></i>
                        {validationErrors[`period_range_${index}`]}
                      </div>
                    )}
                    
                    {period.start_date && period.end_date && !validationErrors[`period_range_${index}`] && (
                      <div className="mt-2">
                        <small className="text-muted">
                          Длительность: {Math.ceil((new Date(period.end_date) - new Date(period.start_date)) / (1000 * 60 * 60 * 24))} дней
                        </small>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={addPeriod}
                  disabled={mutation.isPending}
                >
                  <i className="bi bi-plus-circle me-1"></i>
                  Добавить еще один период
                </button>
                
                <div className="form-text">
                  Добавьте все налоговые периоды, к которым применяется снижение. Можно указать несколько периодов.
                </div>
              </div>

              {/* Запрашиваемая сумма */}
              <div className="mb-4" data-error="amount">
                <label htmlFor="amount" className="form-label fw-semibold">
                  Запрашиваемая сумма снижения (руб.) <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <input
                    id="amount"
                    type="number"
                    className={`form-control ${validationErrors.amount ? 'is-invalid' : ''}`}
                    value={amount}
                    onChange={(e) => handleFieldChange(setAmount, e.target.value)}
                    disabled={mutation.isPending}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <span className="input-group-text">₽</span>
                </div>
                {validationErrors.amount && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.amount}
                  </div>
                )}
                <div className="form-text">
                  Укажите сумму, на которую вы хотите снизить налоговые обязательства
                </div>
              </div>

              {/* Обоснование */}
              <div className="mb-4" data-error="description">
                <label htmlFor="description" className="form-label fw-semibold">
                  Подробное обоснование <span className="text-danger">*</span>
                </label>
                <textarea
                  id="description"
                  className={`form-control ${validationErrors.description ? 'is-invalid' : ''}`}
                  value={description}
                  onChange={(e) => handleFieldChange(setDescription, e.target.value)}
                  disabled={mutation.isPending}
                  required
                  rows="6"
                  placeholder="Опишите подробно причины для снижения налога, предоставьте необходимые обоснования и дополнительную информацию..."
                />
                {validationErrors.description && (
                  <div className="invalid-feedback d-block">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {validationErrors.description}
                  </div>
                )}
                <div className="form-text">
                  Максимально подробно опишите ситуацию, требующую снижения налоговой нагрузки
                </div>
                <div className="form-text text-end">
                  {description.length} символов
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