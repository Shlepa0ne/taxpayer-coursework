import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Импортируем хук для навигации
import { useAuth } from '../context/AuthContext'; // Импортируем наш кастомный хук

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const { login } = useAuth(); // Получаем функцию login из контекста
  const navigate = useNavigate(); // Получаем функцию для перенаправления

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await login(username, password); // Вызываем login из контекста
      navigate('/'); // В случае успеха - перенаправляем на главную страницу
    } catch (err) {
      setError('Неверное имя пользователя или пароль.');
      console.error('Ошибка входа:', err);
    }
  };

  return (
    <div>
      <h1>Страница входа</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Имя пользователя:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Пароль:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Войти</button>
      </form>
    </div>
  );
}

export default LoginPage;