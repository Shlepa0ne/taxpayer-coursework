import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMutation } from '@tanstack/react-query';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (credentials) => login(credentials.username, credentials.password),
    onSuccess: () => {
      // При успешном логине переходим на главную страницу.
      navigate('/');
    },
    // Состояние ошибки (`isError`) будет использовано для отображения сообщения.
  });

  // Обработчик отправки формы.
  const handleSubmit = (event) => {    
    event.preventDefault();    
    mutation.mutate({ username, password });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>Страница входа</h1>      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="username">Имя пользователя:</label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={mutation.isPending} // Блокируем ввод во время запроса
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password">Пароль:</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={mutation.isPending} // Блокируем ввод во время запроса
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        {mutation.isError && (
          <p style={{ color: 'red' }}>
            Неверные учетные данные. Пожалуйста, попробуйте снова.
          </p>
        )}

        <button type="submit" disabled={mutation.isPending} style={{ width: '100%', padding: '10px' }}>
          {mutation.isPending ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;