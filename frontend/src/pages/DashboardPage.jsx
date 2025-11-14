import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTaxpayers } from '../api/taxpayersApi';
import TaxpayerList from '../features/taxpayers/TaxpayerList';
import Spinner from '../components/ui/Spinner';

const DashboardPage = () => {
  // Запрос данных через React Query
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['taxpayers'],
    queryFn: getTaxpayers,
    // Можно добавить retry: 1, чтобы не спамить запросами при ошибке
  });

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
      <h1>Список налогоплательщиков</h1>
      <TaxpayerList taxpayers={data} />
    </div>
  );
};

export default DashboardPage;