// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { getProfile, changePassword, getMyTaxableObjects } from '../api/taxpayersApi';
import Spinner from '../components/ui/Spinner';

const ProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [taxableObjects, setTaxableObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [objectsLoading, setObjectsLoading] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchProfile();
    fetchTaxableObjects();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxableObjects = async () => {
    try {
      const data = await getMyTaxableObjects();
      setTaxableObjects(data);
    } catch (err) {
      console.error('Error fetching taxable objects:', err);
    } finally {
      setObjectsLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setMessage('');
    setError('');

    try {
      await changePassword(passwordForm);
      setMessage('Пароль успешно изменен');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка при смене пароля');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Функция для форматирования даты
  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  };

  // Функция для форматирования суммы
  const formatCurrency = (amount) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  // Функция для отображения информации в зависимости от типа налогоплательщика
  const renderProfileInfo = () => {
    if (!profile) return [];

    const payerType = profile.payer_type_id;

    // Общие поля для всех типов
    const commonFields = [
      { label: 'ИНН', value: profile.inn || 'Не указан' },
      { label: 'Адрес регистрации', value: profile.registration_address || 'Не указан' },
      { label: 'Фактический адрес', value: profile.fact_address || 'Не указан' },
    ];

    // Поля для физических лиц (1)
    if (payerType === 1) {
      return [
        { label: 'ФИО', value: profile.fio || 'Не указано' },
        { label: 'Дата рождения', value: formatDate(profile.birth_date) },
        ...commonFields
      ];
    }

    // Поля для ИП (2)
    if (payerType === 2) {
      return [
        { label: 'ФИО', value: profile.fio || 'Не указано' },
        { label: 'ОГРНИП', value: profile.ogrn || 'Не указан' },
        { label: 'Дата регистрации в ЕГРИП', value: formatDate(profile.registration_date) },
        ...commonFields
      ];
    }

    // Поля для юридических лиц (3)
    if (payerType === 3) {
      return [
        { label: 'Полное название', value: profile.full_name || 'Не указано' },
        { label: 'Краткое название', value: profile.short_name || 'Не указано' },
        { label: 'ОГРН', value: profile.ogrn || 'Не указан' },
        { label: 'Дата регистрации в ЕГРЮЛ', value: formatDate(profile.registration_date) },
        { label: 'Руководители', value: profile.executive_list || 'Не указаны' },
        ...commonFields
      ];
    }

    return commonFields;
  };

  // Функция для отображения характеристик объекта в зависимости от типа
  const getObjectCharacteristics = (obj) => {
    switch (obj.object_type_name) {
      case 'транспорт':
        return [
          { label: 'VIN', value: obj.transport_vin },
          { label: 'Госномер', value: obj.registration_plate },
          { label: 'Модель', value: obj.transport_model },
          { label: 'Мощность двигателя', value: obj.engine_power ? `${obj.engine_power} л.с.` : null },
          { label: 'Стоимость', value: formatCurrency(obj.extra_value) }
        ];
      case 'недвижимость':
        return [
          { label: 'Кадастровый номер', value: obj.cadastral_number },
          { label: 'Тип недвижимости', value: obj.real_estate_type_name },
          { label: 'Кадастровая стоимость', value: formatCurrency(obj.cadastral_value) }
        ];
      case 'земельный участок':
        return [
          { label: 'Кадастровый номер', value: obj.cadastral_number },
          { label: 'Кадастровая стоимость', value: formatCurrency(obj.cadastral_value) }
        ];
      default:
        return [];
    }
  };

  if (loading) return <Spinner />;

  const profileFields = renderProfileInfo();

  return (
    <div className="row">
      <div className="col-lg-8">
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="card-title mb-0">
              <i className="bi bi-person-vcard me-2"></i>
              Информация о профиле
            </h5>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}
            
            {profile ? (
              <div className="row">
                {profileFields.map((field, index) => (
                  <div key={index} className="col-md-6 mb-3">
                    <label className="form-label text-muted small mb-1">
                      {field.label}
                    </label>
                    <div className="form-control bg-light border-0">
                      {field.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert alert-warning">
                Не удалось загрузить данные профиля
              </div>
            )}
          </div>
        </div>

        {/* Налогооблагаемые объекты */}
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-info text-white">
            <h5 className="card-title mb-0">
              <i className="bi bi-house me-2"></i>
              Налогооблагаемые объекты
            </h5>
          </div>
          <div className="card-body">
            {objectsLoading ? (
              <Spinner />
            ) : taxableObjects.length > 0 ? (
              <div className="row">
                {taxableObjects.map((ownership) => {
                  const obj = ownership.object;
                  const characteristics = getObjectCharacteristics(obj);
                  
                  return (
                    <div key={ownership.ownership_id} className="col-12 mb-4">
                      <div className="card border">
                        <div className="card-header bg-light">
                          <h6 className="mb-0">
                            <i className={`bi ${
                              obj.object_type_name === 'транспорт' ? 'bi-car-front' :
                              obj.object_type_name === 'недвижимость' ? 'bi-building' :
                              'bi-geo-alt'
                            } me-2`}></i>
                            {obj.object_name || 'Без названия'}
                            <span className="badge bg-secondary ms-2">
                              {obj.object_type_name}
                            </span>
                          </h6>
                        </div>
                        <div className="card-body">
                          <div className="row">
                            <div className="col-md-6">
                              <h6 className="text-muted small mb-2">Основная информация</h6>
                              {obj.object_address && (
                                <div className="mb-2">
                                  <strong>Адрес:</strong> {obj.object_address}
                                </div>
                              )}
                              <div className="mb-2">
                                <strong>Период владения:</strong>{' '}
                                {formatDate(ownership.ownership_start_date)} -{' '}
                                {ownership.ownership_end_date 
                                  ? formatDate(ownership.ownership_end_date)
                                  : 'по настоящее время'
                                }
                              </div>
                            </div>
                            <div className="col-md-6">
                              <h6 className="text-muted small mb-2">Характеристики</h6>
                              {characteristics.map((char, index) => (
                                char.value && (
                                  <div key={index} className="mb-1">
                                    <strong>{char.label}:</strong> {char.value}
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted py-4">
                <i className="bi bi-inbox display-4"></i>
                <p className="mt-2">Налогооблагаемые объекты отсутствуют</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-4">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-warning text-dark">
            <h5 className="card-title mb-0">
              <i className="bi bi-shield-lock me-2"></i>
              Смена пароля
            </h5>
          </div>
          <div className="card-body">
            {message && <div className="alert alert-success">{message}</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-3">
                <label htmlFor="current_password" className="form-label">
                  Текущий пароль
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="current_password"
                  name="current_password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="new_password" className="form-label">
                  Новый пароль
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="new_password"
                  name="new_password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  minLength="6"
                  required
                />
                <div className="form-text">Минимум 6 символов</div>
              </div>

              <div className="mb-3">
                <label htmlFor="confirm_password" className="form-label">
                  Подтверждение пароля
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="confirm_password"
                  name="confirm_password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-warning w-100"
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Смена пароля...
                  </>
                ) : (
                  'Сменить пароль'
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-sm mt-4">
          <div className="card-body">
            <h6 className="text-primary mb-3">
              <i className="bi bi-info-circle me-1"></i>
              О профиле
            </h6>
            <p className="small text-muted mb-2">
              Для изменения данных профиля обратитесь в налоговый орган по месту регистрации.
            </p>
            <p className="small text-muted mb-0">
              Смена пароля влияет только на доступ к личному кабинету.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;