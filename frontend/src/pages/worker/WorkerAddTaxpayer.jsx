// frontend/src/pages/worker/WorkerAddTaxpayer.jsx
import React, { useState, useEffect } from 'react';
import { 
  generateINN, 
  createTaxpayer, 
  getRegions, 
  getTaxRegimes, 
  resetTaxpayerPassword,
  generateOGRN, // НОВАЯ ФУНКЦИЯ
  generateOGRNIP // НОВАЯ ФУНКЦИЯ
} from '../../api/workersApi';

const WorkerAddTaxpayer = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    payer_type_id: '',
    inn: '',
    fio: '',
    full_name: '',
    short_name: '',
    birth_date: '',
    registration_address: '',
    fact_address: '',
    ogrn: '',
    registration_date: '',
    executive_list: '',
    bank_detals: '',
    tax_regime_id: 1,
    region_key: 3
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingINN, setLoadingINN] = useState(false);
  const [loadingOGRN, setLoadingOGRN] = useState(false);
  const [error, setError] = useState('');
  const [regions, setRegions] = useState([]);
  const [taxRegimes, setTaxRegimes] = useState([]);

  // Состояния для сброса пароля
  const [resetStep, setResetStep] = useState(1);
  const [resetINN, setResetINN] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [countdown, setCountdown] = useState(10);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [isResetButtonDisabled, setIsResetButtonDisabled] = useState(true);

  // Таймер для кнопки "Принять"
  useEffect(() => {
    let timer;
    if (resetStep === 2 && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (resetStep === 2 && countdown === 0) {
      setIsResetButtonDisabled(false);
    }
    return () => clearTimeout(timer);
  }, [resetStep, countdown]);

  // Загрузка справочников
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regionsData, regimesData] = await Promise.all([
          getRegions(),
          getTaxRegimes()
        ]);
        
        console.log('Regions data:', regionsData);
        console.log('Tax regimes data:', regimesData);
        
        setRegions(regionsData);
        setTaxRegimes(regimesData);
        
        const moscowRegion = regionsData.find(region => region.code === '777');
        if (moscowRegion) {
          setFormData(prev => ({ ...prev, region_key: moscowRegion.region_id }));
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Ошибка загрузки справочников');
      }
    };
    fetchData();
  }, []);

  const payerTypes = [
    { id: 1, label: 'Физическое лицо', description: 'Гражданин РФ' },
    { id: 2, label: 'Индивидуальный предприниматель (ИП)', description: 'Индивидуальный предприниматель' },
    { id: 3, label: 'Юридическое лицо', description: 'Организация' }
  ];

  // Функции для добавления налогоплательщика
  const handlePayerTypeSelect = (payerTypeId) => {
    setFormData(prev => ({
      ...prev,
      payer_type_id: payerTypeId,
      inn: '', // Сбрасываем ИНН при выборе типа
      ogrn: '', // Сбрасываем ОГРН при выборе типа
      fio: '',
      full_name: '',
      short_name: '',
    }));
    setStep(2);
  };

  const handleGenerateINN = async () => {
    if (!formData.payer_type_id) {
      setError('Сначала выберите тип плательщика');
      return;
    }

    setLoadingINN(true);
    setError('');
    try {
      const data = await generateINN(formData.payer_type_id);
      setFormData(prev => ({ ...prev, inn: data.inn }));
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка генерации ИНН');
    } finally {
      setLoadingINN(false);
    }
  };

  // НОВАЯ ФУНКЦИЯ: Генерация ОГРН/ОГРНИП
  const handleGenerateOGRN = async () => {
    if (!formData.payer_type_id) {
      setError('Сначала выберите тип плательщика');
      return;
    }

    if (formData.payer_type_id == 1) {
      setError('Физические лица не имеют ОГРН/ОГРНИП');
      return;
    }

    if (!formData.region_key) {
      setError('Выберите регион для генерации ОГРН/ОГРНИП');
      return;
    }

    setLoadingOGRN(true);
    setError('');
    try {
      let data;
      if (formData.payer_type_id == 2) { // ИП
        data = await generateOGRNIP(formData.region_key);
      } else if (formData.payer_type_id == 3) { // Юрлицо
        data = await generateOGRN(formData.region_key);
      }
      
      if (data && data.ogrn) {
        setFormData(prev => ({ ...prev, ogrn: data.ogrn }));
      } else {
        setError('Не удалось сгенерировать ОГРН/ОГРНИП');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка генерации ОГРН/ОГРНИП');
    } finally {
      setLoadingOGRN(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Валидация в зависимости от типа плательщика
      if (formData.payer_type_id == 1) {
        if (!formData.fio) {
          throw new Error('Для физического лица обязательно указать ФИО');
        }
      } else if (formData.payer_type_id == 2 || formData.payer_type_id == 3) {
        if (!formData.full_name) {
          throw new Error('Для ИП и юридических лиц обязательно указать полное наименование');
        }
      }

      if (!formData.inn) {
        throw new Error('ИНН обязателен для заполнения');
      }

      // Проверяем длину ИНН в зависимости от типа плательщика
      if (formData.payer_type_id == 3 && formData.inn.length !== 10) {
        throw new Error('ИНН юридического лица должен состоять из 10 цифр');
      } else if ((formData.payer_type_id == 1 || formData.payer_type_id == 2) && formData.inn.length !== 12) {
        throw new Error('ИНН физического лица или ИП должен состоять из 12 цифр');
      }

      // Проверяем длину ОГРН/ОГРНИП если указано
      if (formData.ogrn) {
        if (formData.payer_type_id == 2 && formData.ogrn.length !== 15) {
          throw new Error('ОГРНИП должен состоять из 15 цифр');
        } else if (formData.payer_type_id == 3 && formData.ogrn.length !== 13) {
          throw new Error('ОГРН должен состоять из 13 цифр');
        }
      }

      const result = await createTaxpayer(formData);
      setGeneratedPassword(result.password);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ошибка при создании налогоплательщика');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      payer_type_id: '',
      inn: '',
      fio: '',
      full_name: '',
      short_name: '',
      birth_date: '',
      registration_address: '',
      fact_address: '',
      ogrn: '',
      registration_date: '',
      executive_list: '',
      bank_detals: '',
      tax_regime_id: 1,
      region_key: 3
    });
    setGeneratedPassword('');
    setStep(1);
    setError('');
  };

  // Функции для сброса пароля (остаются без изменений)
  const handleStartReset = () => {
    if (!resetINN) {
      setResetError('Введите ИНН налогоплательщика');
      return;
    }

    setResetError('');
    setResetStep(2);
    setIsResetButtonDisabled(true);
    setCountdown(10);
  };

  const handleConfirmReset = async () => {
    setResetLoading(true);
    try {
      const result = await resetTaxpayerPassword(resetINN);
      setNewPassword(result.new_password);
      setResetStep(3);
    } catch (err) {
      setResetError(err.response?.data?.error || 'Ошибка при сбросе пароля');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCancelReset = () => {
    setResetStep(1);
    setResetINN('');
    setResetError('');
    setNewPassword('');
    setCountdown(10);
    setIsResetButtonDisabled(true);
  };

  const resetPasswordForm = () => {
    return (
      <div className="row mt-5">
        <div className="col-md-8 mx-auto">
          <div className="card border-warning">
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">
                <i className="bi bi-key me-2"></i>
                Сброс пароля налогоплательщика
              </h5>
            </div>
            <div className="card-body">
              {resetStep === 1 && (
                <>
                  <div className="mb-3">
                    <label className="form-label">ИНН налогоплательщика</label>
                    <input
                      type="text"
                      className="form-control"
                      value={resetINN}
                      onChange={(e) => setResetINN(e.target.value)}
                      placeholder="Введите ИНН для сброса пароля"
                      maxLength={12}
                    />
                    <div className="form-text">
                      Введите ИНН налогоплательщика, для которого необходимо сгенерировать новый пароль
                    </div>
                  </div>
                  {resetError && (
                    <div className="alert alert-danger">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {resetError}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={handleStartReset}
                    disabled={!resetINN}
                  >
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Сбросить пароль
                  </button>
                </>
              )}

              {resetStep === 2 && (
                <div className="text-center">
                  <div className="mb-3">
                    <i className="bi bi-shield-lock display-4 text-warning"></i>
                  </div>
                  <h5>Подтверждение сброса пароля</h5>
                  
                  <div className="alert alert-warning">
                    <h6 className="alert-heading">Внимание!</h6>
                    <p className="mb-0">
                      Убедитесь, что налогоплательщик дал согласие на сброс пароля. 
                      Это действие нельзя отменить.
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <strong>ИНН:</strong> {resetINN}
                  </div>

                  <div className="d-flex justify-content-center gap-3">
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleConfirmReset}
                      disabled={isResetButtonDisabled || resetLoading}
                    >
                      {resetLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Обработка...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Принять {isResetButtonDisabled && `(${countdown} сек)`}
                        </>
                      )}
                    </button>
                    
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelReset}
                      disabled={resetLoading}
                    >
                      <i className="bi bi-x-circle me-2"></i>
                      Отменить
                    </button>
                  </div>

                  {isResetButtonDisabled && (
                    <div className="mt-3 text-muted small">
                      Кнопка станет активной через {countdown} секунд
                    </div>
                  )}
                </div>
              )}

              {resetStep === 3 && (
                <div className="text-center">
                  <div className="mb-3">
                    <i className="bi bi-check-circle display-4 text-success"></i>
                  </div>
                  <h5>Пароль успешно сброшен!</h5>
                  
                  <div className="alert alert-success">
                    <h6 className="alert-heading">Новые данные для входа</h6>
                    <div className="mb-2">
                      <strong>ИНН:</strong> {resetINN}
                    </div>
                    <div>
                      <strong>Новый пароль:</strong> 
                      <span className="fw-bold text-primary fs-5 ms-2">{newPassword}</span>
                    </div>
                  </div>

                  <p className="text-muted mb-4">
                    Передайте новый пароль налогоплательщику. Рекомендуется сменить пароль при первом входе в систему.
                  </p>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCancelReset}
                  >
                    <i className="bi bi-arrow-repeat me-2"></i>
                    Сбросить еще один пароль
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Шаг 1: Выбор типа плательщика
  if (step === 1) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">Добавление нового налогоплательщика</h4>
              </div>
              <div className="card-body">
                <h5 className="mb-4">Выберите тип налогоплательщика</h5>
                <div className="row">
                  {payerTypes.map(type => (
                    <div key={type.id} className="col-md-4 mb-3">
                      <div 
                        className={`card h-100 border ${formData.payer_type_id == type.id ? 'border-primary' : ''} hover-shadow`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handlePayerTypeSelect(type.id)}
                      >
                        <div className="card-body text-center">
                          <h6 className="card-title">{type.label}</h6>
                          <p className="card-text text-muted small">{type.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        {resetPasswordForm()}
      </div>
    );
  }

  // Шаг 2: Ввод/генерация ИНН
  if (step === 2) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">Ввод ИНН</h4>
              </div>
              <div className="card-body">
                <div className="mb-4">
                  <label className="form-label">ИНН *</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      value={formData.inn}
                      onChange={(e) => handleInputChange('inn', e.target.value)}
                      placeholder={
                        formData.payer_type_id == 3 
                          ? "Введите 10-значный ИНН или сгенерируйте автоматически" 
                          : "Введите 12-значный ИНН или сгенерируйте автоматически"
                      }
                      maxLength={formData.payer_type_id == 3 ? 10 : 12}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleGenerateINN}
                      disabled={loadingINN}
                    >
                      {loadingINN ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Генерация...
                        </>
                      ) : (
                        'Сгенерировать'
                      )}
                    </button>
                  </div>
                  <div className="form-text">
                    {formData.payer_type_id == 3 
                      ? "Вы можете ввести 10-значный ИНН вручную или сгенерировать автоматически"
                      : "Вы можете ввести 12-значный ИНН вручную или сгенерировать автоматически"
                    }
                  </div>
                </div>

                <div className="d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, inn: '' })); // Сбрасываем ИНН
                      setStep(1);
                    }}
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setStep(3)}
                    disabled={!formData.inn}
                  >
                    Далее
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {resetPasswordForm()}
      </div>
    );
  }

  // Шаг 3: Основная информация
  if (step === 3) {
    const isIndividual = formData.payer_type_id == 1;
    const isIP = formData.payer_type_id == 2;
    const isLegalEntity = formData.payer_type_id == 3;

    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-10">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">Основная информация</h4>
              </div>
              <div className="card-body">
                {error && (
                  <div className="alert alert-danger">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {/* Общие поля */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">ИНН *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.inn}
                        readOnly
                      />
                      <div className="form-text">
                        {isLegalEntity 
                          ? "10-значный ИНН юридического лица"
                          : "12-значный ИНН физического лица/ИП"
                        }
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Тип плательщика</label>
                      <input
                        type="text"
                        className="form-control"
                        value={payerTypes.find(t => t.id == formData.payer_type_id)?.label || ''}
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Поля для физлица */}
                  {isIndividual && (
                    <>
                      <div className="row mb-3">
                        <div className="col-md-12">
                          <label className="form-label">ФИО *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.fio}
                            onChange={(e) => handleInputChange('fio', e.target.value)}
                            required
                            placeholder="Фамилия Имя Отчество"
                          />
                        </div>
                      </div>
                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label">Дата рождения</label>
                          <input
                            type="date"
                            className="form-control"
                            value={formData.birth_date}
                            onChange={(e) => handleInputChange('birth_date', e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Поля для ИП и Юрлиц */}
                  {(isIP || isLegalEntity) && (
                    <>
                      <div className="row mb-3">
                        <div className="col-md-12">
                          <label className="form-label">Полное наименование *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.full_name}
                            onChange={(e) => handleInputChange('full_name', e.target.value)}
                            required
                            placeholder="Полное официальное наименование"
                          />
                        </div>
                      </div>
                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label">Сокращенное наименование</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.short_name}
                            onChange={(e) => handleInputChange('short_name', e.target.value)}
                            placeholder="Краткое наименование (если есть)"
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            {isIP ? 'ОГРНИП' : 'ОГРН'}
                          </label>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              value={formData.ogrn}
                              onChange={(e) => handleInputChange('ogrn', e.target.value)}
                              placeholder={isIP ? "15 цифр" : "13 цифр"}
                              maxLength={isIP ? 15 : 13}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={handleGenerateOGRN}
                              disabled={loadingOGRN || !formData.region_key}
                            >
                              {loadingOGRN ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2"></span>
                                  Генерация...
                                </>
                              ) : (
                                'Сгенерировать'
                              )}
                            </button>
                          </div>
                          <div className="form-text">
                            {isIP 
                              ? "Вы можете ввести 15-значный ОГРНИП вручную или сгенерировать автоматически"
                              : "Вы можете ввести 13-значный ОГРН вручную или сгенерировать автоматически"
                            }
                          </div>
                        </div>
                      </div>
                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="form-label">Дата регистрации</label>
                          <input
                            type="date"
                            className="form-control"
                            value={formData.registration_date}
                            onChange={(e) => handleInputChange('registration_date', e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Руководители</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.executive_list}
                            onChange={(e) => handleInputChange('executive_list', e.target.value)}
                            placeholder="ФИО руководителя(ей)"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Общие поля для всех типов */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Адрес регистрации</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.registration_address}
                        onChange={(e) => handleInputChange('registration_address', e.target.value)}
                        placeholder="Юридический/регистрационный адрес"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Фактический адрес</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.fact_address}
                        onChange={(e) => handleInputChange('fact_address', e.target.value)}
                        placeholder="Фактический адрес (если отличается от регистрационного)"
                      />
                    </div>
                  </div>

                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label">Налоговый режим</label>
                      <select
                        className="form-select"
                        value={formData.tax_regime_id}
                        onChange={(e) => handleInputChange('tax_regime_id', parseInt(e.target.value))}
                      >
                        {taxRegimes.map(regime => (
                          <option key={regime.regime_id} value={regime.regime_id}>
                            {regime.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Регион *</label>
                      <select
                        className="form-select"
                        value={formData.region_key}
                        onChange={(e) => handleInputChange('region_key', parseInt(e.target.value))}
                        required
                      >
                        {regions.map(region => (
                          <option key={region.region_id} value={region.region_id}>
                            {region.name} ({region.code})
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        Выбор региона влияет на генерацию ОГРН/ОГРНИП
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label">Банковские реквизиты</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={formData.bank_detals}
                      onChange={(e) => handleInputChange('bank_detals', e.target.value)}
                      placeholder="Расчетный счет, БИК, банк"
                    />
                  </div>

                  <div className="d-flex justify-content-between">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setStep(2)}
                    >
                      Назад
                    </button>
                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Создание...
                        </>
                      ) : (
                        'Создать налогоплательщика'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
        {resetPasswordForm()}
      </div>
    );
  }

  // Шаг 4: Успешное создание (не показываем форму сброса пароля)
  if (step === 4) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h4 className="mb-0">Налогоплательщик успешно создан!</h4>
              </div>
              <div className="card-body text-center">
                <div className="mb-4">
                  <i className="bi bi-check-circle display-1 text-success"></i>
                </div>
                
                <h5 className="mb-3">Данные для входа налогоплательщика</h5>
                
                <div className="alert alert-warning">
                  <h6 className="alert-heading">Внимание! Сохраните эти данные</h6>
                  <div className="mb-2">
                    <strong>ИНН:</strong> {formData.inn}
                  </div>
                  <div>
                    <strong>Пароль:</strong> 
                    <span className="fw-bold text-primary fs-5 ms-2">{generatedPassword}</span>
                  </div>
                </div>

                <p className="text-muted mb-4">
                  Передайте эти данные налогоплательщику. Рекомендуется сменить пароль при первом входе в систему.
                </p>

                <div className="d-flex justify-content-center gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={resetForm}
                  >
                    Добавить еще одного налогоплательщика
                  </button>
                  <a href="/worker/search" className="btn btn-outline-secondary">
                    Перейти к поиску
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default WorkerAddTaxpayer;