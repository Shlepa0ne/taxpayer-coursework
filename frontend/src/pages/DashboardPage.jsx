import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTaxpayers } from '../api/taxpayersApi';
import TaxpayerList from '../features/taxpayers/TaxpayerList';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext'; // Импортируем хук

const DashboardPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['taxpayers'],
    queryFn: getTaxpayers,
  });
  
  const { logout } = useAuth(); // Получаем функцию logout

  if (isLoading) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <div style={{ color: 'red', padding: '20px' }}>
        Ошибка загрузки данных: {error.message}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Список налогоплательщиков</h1>
        <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Выйти
        </button>
      </header>
      <main>
        <TaxpayerList taxpayers={data} />
      </main>
    </div>
  );
};

export default DashboardPage;