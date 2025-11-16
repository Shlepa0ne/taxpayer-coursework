import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DashboardPage = () => {
  const { logout } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6'
      }}>
        <h1>Личный кабинет налогоплательщика</h1>
        <button onClick={logout} style={{ padding: '8px 16px' }}>
          Выйти
        </button>
      </header>
      <div style={{ display: 'flex', flex: 1 }}>
        <nav style={{
          width: '250px',
          padding: '1rem',
          backgroundColor: '#f1f1f1'
        }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '10px' }}>
              {/* Ссылка на главную страницу кабинета (начисления) */}
              <Link to="/">Мои начисления</Link>
            </li>
            <li style={{ marginBottom: '10px' }}>
              {/* Ссылка на страницу подачи заявления */}
              <Link to="/new-request">Подать заявление</Link>
            </li>
          </ul>
        </nav>
        <main style={{ flex: 1, padding: '1rem' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;