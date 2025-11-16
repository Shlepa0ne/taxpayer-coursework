import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyAccruals } from '../api/taxpayersApi';
import Spinner from '../components/ui/Spinner';

const MyTaxesPage = () => {
  // Хук useQuery от TanStack Query для управления серверным состоянием.
  const { data: accruals, isLoading, isError, error } = useQuery({
    // 'myAccruals' - уникальный ключ для кэширования этого запроса.
    queryKey: ['myAccruals'],
    // Функция, которая будет вызвана для получения данных.
    queryFn: getMyAccruals,
  });

  // Пока данные загружаются, показываем спиннер.
  if (isLoading) {
    return <Spinner />;
  }

  // Если произошла ошибка при загрузке, отображаем сообщение.
  if (isError) {
    return <div style={{ color: 'red', padding: '20px' }}>Ошибка загрузки данных: {error.message}</div>;
  }

  // Если загрузка прошла успешно, отображаем данные.
  return (
    <div style={{ padding: '20px' }}>
      <h2>Мои начисления</h2>
      {accruals.length === 0 ? (
        <p>На данный момент у вас нет активных начислений.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {/* Проходим по массиву начислений и рендерим элемент списка для каждого */}
          {accruals.map((accrual) => (
            <li key={accrual.tax_accrual_id} style={{ border: '1px solid #ccc', padding: '10px', marginBottom: '10px' }}>
              <div><strong>Сумма к уплате:</strong> {accrual.accrual_amount} руб.</div>
              <div><strong>Срок уплаты:</strong> {new Date(accrual.due_date).toLocaleDateString()}</div>
              <div><strong>Дата начисления:</strong> {new Date(accrual.accrual_date).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyTaxesPage;