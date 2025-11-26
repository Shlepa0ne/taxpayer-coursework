// frontend/src/pages/worker/WorkerAddTaxpayer.jsx
import React, { useState } from 'react';
import { generateINN, createTaxpayer, getRegions, getTaxRegimes } from '../../api/workersApi';
import { formatDateForInput } from '../../utils/formatters';

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
  const [error, setError] = useState('');
  const [regions, setRegions] = useState([]);
  const [taxRegimes, setTaxRegimes] = useState([]);

  // В useEffect для загрузки данных добавляем проверку
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [regionsData, regimesData] = await Promise.all([
          getRegions(),
          getTaxRegimes()
        ]);
        
        console.log('Regions data:', regionsData); // Для отладки
        console.log('Tax regimes data:', regimesData); // Для отладки
        
        setRegions(regionsData);
        setTaxRegimes(regimesData);
        
        // Если регионы загружены, устанавливаем Москву как регион по умолчанию
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

  const handlePayerTypeSelect = (payerTypeId) => {
    setFormData(prev => ({
      ...prev,
      payer_type_id: payerTypeId,
      // Очищаем специфичные поля при смене типа
      fio: '',
      full_name: '',
      short_name: '',
      ogrn: ''
    }));
    setStep(2);
  };

  const handleGenerateINN = async () => {
    if (!formData.payer_type_id) {
      setError('Сначала выберите тип плательщика');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await generateINN(formData.payer_type_id);
      setFormData(prev => ({ ...prev, inn: data.inn }));
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка генерации ИНН');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // В функции handleSubmit добавляем более детальную валидацию
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
      region_key: 77
    });
    setGeneratedPassword('');
    setStep(1);
    setError('');
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
      </div>
    );
  }

  // Шаг 2: Генерация ИНН
  if (step === 2) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">Генерация ИНН</h4>
              </div>
              <div className="card-body">
                <div className="mb-4">
                  <label className="form-label">ИНН</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      value={formData.inn}
                      onChange={(e) => handleInputChange('inn', e.target.value)}
                      placeholder="Будет сгенерирован автоматически"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleGenerateINN}
                      disabled={loading}
                    >
                      {loading ? 'Генерация...' : 'Сгенерировать ИНН'}
                    </button>
                  </div>
                  <div className="form-text">
                    ИНН будет сгенерирован автоматически в соответствии с выбранным типом плательщика
                  </div>
                </div>

                <div className="d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStep(1)}
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
      </div>
    );
  }

  // Шаг 3: Основная информация
  if (step === 3) {
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
                  {formData.payer_type_id == 1 && (
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
                  {(formData.payer_type_id == 2 || formData.payer_type_id == 3) && (
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
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">ОГРН</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formData.ogrn}
                            onChange={(e) => handleInputChange('ogrn', e.target.value)}
                          />
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
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Фактический адрес</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        value={formData.fact_address}
                        onChange={(e) => handleInputChange('fact_address', e.target.value)}
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
                      <label className="form-label">Регион</label>
                      <select
                        className="form-select"
                        value={formData.region_key}
                        onChange={(e) => handleInputChange('region_key', parseInt(e.target.value))}
                      >
                        {regions.map(region => (
                          <option key={region.region_id} value={region.region_id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
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
                      {loading ? 'Создание...' : 'Создать налогоплательщика'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Шаг 4: Успешное создание
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