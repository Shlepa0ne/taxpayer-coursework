// frontend/src/pages/worker/WorkerProfile.jsx
import React, { useState, useEffect } from 'react';
import { getCurrentWorker } from '../../api/workersApi';
import { changePassword } from '../../api/taxpayersApi';
import Spinner from '../../components/ui/Spinner';

const WorkerProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
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
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await getCurrentWorker();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching worker profile:', err);
      setError('Ошибка загрузки профиля сотрудника');
    } finally {
      setLoading(false);
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

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('Новые пароли не совпадают');
      setPasswordLoading(false);
      return;
    }

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

  const getPositionName = (roleId) => {
    const positions = {
      1: 'Инспектор',
      2: 'Старший инспектор',
      3: 'Руководитель'
    };
    return positions[roleId] || 'Сотрудник';
  };

  const getPositionColor = (roleId) => {
    const colors = {
      1: 'primary',
      2: 'warning',
      3: 'danger'
    };
    return colors[roleId] || 'secondary';
  };

  if (loading) return <Spinner />;

  return (
    <div className="row">
      <div className="col-lg-8">
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-primary text-white">
            <h5 className="card-title mb-0">
              <i className="bi bi-person-gear me-2"></i>
              Профиль сотрудника
            </h5>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}
            
            {profile ? (
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label text-muted small mb-1">
                    ФИО сотрудника
                  </label>
                  <div className="form-control bg-light border-0">
                    {profile.tax_officer_name || 'Не указано'}
                  </div>
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label text-muted small mb-1">
                    Должность
                  </label>
                  <div className="form-control bg-light border-0">
                    <span className={`badge bg-${getPositionColor(profile.role_id)} me-2`}>
                      {getPositionName(profile.role_id)}
                    </span>
                  </div>
                </div>

                <div className="col-12 mb-3">
                  <label className="form-label text-muted small mb-1">
                    Подразделение
                  </label>
                  <div className="form-control bg-light border-0">
                    {profile.unit || 'Не указано'}
                  </div>
                </div>

                <div className="col-12 mt-3">
                  <div className="card border">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">
                        <i className="bi bi-shield-check me-2"></i>
                        Права доступа
                      </h6>
                    </div>
                    <div className="card-body">
                      {profile.role_id === 1 && (
                        <ul className="list-unstyled mb-0">
                          <li><i className="bi bi-check-circle text-success me-2"></i>Просмотр данных о налогоплательщиках</li>
                          <li><i className="bi bi-check-circle text-success me-2"></i>Одобрение заявлений на снижение налогов</li>
                          <li><i className="bi bi-check-circle text-success me-2"></i>Проверка и одобрение налоговых деклараций</li>
                        </ul>
                      )}
                      {profile.role_id === 2 && (
                        <ul className="list-unstyled mb-0">
                          <li><i className="bi bi-check-circle text-success me-2"></i>Все права инспектора</li>
                          <li><i className="bi bi-check-circle text-success me-2"></i>Изменение данных о налогоплательщиках</li>
                          <li><i className="bi bi-check-circle text-success me-2"></i>Добавление новых налогоплательщиков</li>
                          <li><i className="bi bi-check-circle text-success me-2"></i>Создание налоговых проверок</li>
                        </ul>
                      )}
                      {profile.role_id === 3 && (
                        <ul className="list-unstyled mb-0">
                          <li><i className="bi bi-check-circle text-success me-2"></i>Все права старшего инспектора</li>
                          <li><i className="bi bi-check-circle text-success me-2"></i>Создание новых сотрудников налоговой</li>
                          <li><i className="bi bi-check-circle text-success me-2"></i>Редактирование данных сотрудников</li>
                          <li><i className="bi bi-check-circle text-success me-2"></i>Формирование отчётов по работе всей налоговой</li>
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert alert-warning">
                Не удалось загрузить данные профиля сотрудника
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
              О профиле сотрудника
            </h6>
            <p className="small text-muted mb-2">
              Для изменения личных данных (ФИО, должность, подразделение) обратитесь к руководителю вашего подразделения.
            </p>
            <p className="small text-muted mb-0">
              Смена пароля влияет только на доступ к системе и не изменяет другие данные вашей учетной записи.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerProfile;