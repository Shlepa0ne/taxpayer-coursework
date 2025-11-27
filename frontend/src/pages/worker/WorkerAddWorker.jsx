// frontend/src/pages/worker/WorkerAddWorker.jsx
import React, { useState, useEffect } from 'react';
import { createWorker, resetWorkerPassword } from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';

const WorkerAddWorker = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    role_id: '',
    inn: '',
    tax_officer_name: '',
    unit: ''
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Состояния для сброса пароля
  const [resetStep, setResetStep] = useState(1); // 1 - ввод ИНН, 2 - подтверждение, 3 - результат
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

  const workerRoles = [
    { id: 1, label: 'Инспектор', description: 'Обычный сотрудник, может просматривать данные и обрабатывать заявления' },
    { id: 2, label: 'Старший инспектор', description: 'Может создавать проверки, редактировать данные, управлять заявлениями' },
    { id: 3, label: 'Руководитель', description: 'Полный доступ ко всем функциям системы' }
  ];

  const handleRoleSelect = (roleId) => {
    setFormData(prev => ({
      ...prev,
      role_id: roleId
    }));
    setStep(2);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep2 = () => {
    if (!formData.inn) {
      setError('Введите ИНН сотрудника');
      return false;
    }

    // Базовая валидация ИНН (12 цифр для физлиц)
    const innRegex = /^\d{12}$/;
    if (!innRegex.test(formData.inn)) {
      setError('ИНН должен содержать 12 цифр');
      return false;
    }

    return true;
  };

  const validateStep3 = () => {
    if (!formData.tax_officer_name.trim()) {
      setError('Введите ФИО сотрудника');
      return false;
    }

    if (!formData.unit.trim()) {
      setError('Введите подразделение');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep3()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createWorker(formData);
      
      setGeneratedPassword(result.password);
      setStep(4);
      
    } catch (err) {
      console.error('Ошибка при создании сотрудника:', err);
      setError(err.response?.data?.error || 'Ошибка при создании сотрудника');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      role_id: '',
      inn: '',
      tax_officer_name: '',
      unit: ''
    });
    setGeneratedPassword('');
    setStep(1);
    setError('');
  };

  // Функции для сброса пароля
  const handleStartReset = () => {
    if (!resetINN) {
      setResetError('Введите ИНН сотрудника');
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
      const result = await resetWorkerPassword(resetINN);
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
                Сброс пароля сотрудника
              </h5>
            </div>
            <div className="card-body">
              {resetStep === 1 && (
                <>
                  <div className="mb-3">
                    <label className="form-label">ИНН сотрудника</label>
                    <input
                      type="text"
                      className="form-control"
                      value={resetINN}
                      onChange={(e) => setResetINN(e.target.value)}
                      placeholder="Введите ИНН для сброса пароля"
                      maxLength={12}
                    />
                    <div className="form-text">
                      Введите ИНН сотрудника, для которого необходимо сгенерировать новый пароль
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
                      Убедитесь, что сотрудник дал согласие на сброс пароля. 
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
                    Передайте новый пароль сотруднику. Рекомендуется сменить пароль при первом входе в систему.
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

  // Шаг 1: Выбор роли сотрудника
  if (step === 1) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">Добавление нового сотрудника</h4>
              </div>
              <div className="card-body">
                <h5 className="mb-4">Выберите роль сотрудника</h5>
                <div className="row">
                  {workerRoles.map(role => (
                    <div key={role.id} className="col-md-4 mb-3">
                      <div 
                        className={`card h-100 border ${formData.role_id == role.id ? 'border-primary' : ''} hover-shadow`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleRoleSelect(role.id)}
                      >
                        <div className="card-body text-center">
                          <h6 className="card-title">{role.label}</h6>
                          <p className="card-text text-muted small">{role.description}</p>
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

  // Шаг 2: Ввод ИНН
  if (step === 2) {
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">Ввод ИНН сотрудника</h4>
              </div>
              <div className="card-body">
                {error && (
                  <div className="alert alert-danger">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                )}

                <div className="mb-4">
                  <label className="form-label">ИНН сотрудника *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.inn}
                    onChange={(e) => handleInputChange('inn', e.target.value)}
                    placeholder="Введите ИНН (12 цифр)"
                    maxLength={12}
                  />
                  <div className="form-text">
                    ИНН используется для входа в систему. Должен содержать 12 цифр.
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
                    onClick={() => {
                      if (validateStep2()) {
                        setStep(3);
                      }
                    }}
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
    return (
      <div className="container mt-4">
        <div className="row justify-content-center">
          <div className="col-md-8">
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
                      <label className="form-label">Роль</label>
                      <input
                        type="text"
                        className="form-control"
                        value={workerRoles.find(r => r.id == formData.role_id)?.label || ''}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-12">
                      <label className="form-label">ФИО сотрудника *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.tax_officer_name}
                        onChange={(e) => handleInputChange('tax_officer_name', e.target.value)}
                        placeholder="Введите полное ФИО"
                        required
                      />
                    </div>
                  </div>

                  <div className="row mb-4">
                    <div className="col-md-12">
                      <label className="form-label">Подразделение *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.unit}
                        onChange={(e) => handleInputChange('unit', e.target.value)}
                        placeholder="Введите название подразделения"
                        required
                      />
                      <div className="form-text">
                        Например: "Отдел камеральных проверок", "Юридический отдел" и т.д.
                      </div>
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
                      {loading ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ms-2">Создание...</span>
                        </>
                      ) : (
                        'Создать сотрудника'
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
                <h4 className="mb-0">Сотрудник успешно создан!</h4>
              </div>
              <div className="card-body text-center">
                <div className="mb-4">
                  <i className="bi bi-check-circle display-1 text-success"></i>
                </div>
                
                <h5 className="mb-3">Данные для входа сотрудника</h5>
                
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
                  Передайте эти данные сотруднику. Рекомендуется сменить пароль при первом входе в систему.
                </p>

                <div className="d-flex justify-content-center gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={resetForm}
                  >
                    Добавить еще одного сотрудника
                  </button>
                  <a href="/worker" className="btn btn-outline-secondary">
                    Перейти к панели управления
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

export default WorkerAddWorker;