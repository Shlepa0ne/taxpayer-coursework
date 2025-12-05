// frontend/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginTaxpayer } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [inn, setInn] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth(); // Получаем функцию login из контекста

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const data = await loginTaxpayer({ inn, password });
      
      // Вызываем login в контексте для немедленного обновления состояния
      login({
        access: data.access,
        refresh: data.refresh,
        role: 'taxpayer' // Добавляем роль, так как в ответе от taxpayer login может не быть role
      });
      
      // После успешного входа — перенаправляем на главную страницу
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Ошибка входа');
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <div className="card shadow-sm" style={{ width: '420px' }}>
        <div className="card-body p-4">
          <h3 className="card-title mb-3 text-center">Вход — налогоплательщик</h3>
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="mb-3">
              <label className="form-label">ИНН</label>
              <input
                type="text"
                value={inn}
                onChange={(e) => setInn(e.target.value)}
                className="form-control"
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-control"
                required
              />
            </div>

            <div className="d-grid gap-2">
              <button type="submit" className="btn btn-primary">Войти</button>
            </div>
          </form>

          <hr />

          <div className="text-center">
            <button
              className="btn btn-outline-secondary"
              onClick={() => navigate('/login-workers')}
            >
              Вход для сотрудников
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;