import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createTaxReduceRequest, getReduceBases } from '../../api/taxpayersApi';
import Spinner from '../../components/ui/Spinner';

const CreateRequestForm = () => {
  // Локальное состояние для полей формы.
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState('');

  // Запрашиваем с сервера список оснований для выпадающего списка.
  const { data: reduceBases, isLoading, isError: isBasesError } = useQuery({
    queryKey: ['reduceBases'],
    queryFn: getReduceBases,
  });

  // Мутация для отправки данных формы на сервер.
  const mutation = useMutation({
    mutationFn: createTaxReduceRequest,
    onSuccess: () => {
      alert('Заявление успешно отправлено!');
      setAmount('');
      setDescription('');
      setSelectedBaseId('');
    },
  });

  // Обработчик отправки формы.
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedBaseId) {
      alert('Пожалуйста, выберите основание для снижения налога.');
      return;
    }
    mutation.mutate({ 
      requested_reduce_amount: parseFloat(amount), 
      full_description: description,
      // Отправляем ID выбранного основания.
      reduce_base: parseInt(selectedBaseId)
    });
  };

  // Пока загружается список оснований, показываем спиннер.
  if (isLoading) return <Spinner />;
  // Если не удалось загрузить список.
  if (isBasesError) return <p style={{ color: 'red' }}>Не удалось загрузить список оснований.</p>;

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '20px 0' }}>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="reduceBase">Основание для снижения:</label>
        <select
          id="reduceBase"
          value={selectedBaseId}
          onChange={(e) => setSelectedBaseId(e.target.value)}
          disabled={mutation.isPending}
          required
          style={{ width: '100%', padding: '8px', marginTop: '4px' }}
        >
          <option value="">-- Выберите основание --</option>
          {reduceBases.map(base => (
            <option key={base.reduce_base_id} value={base.reduce_base_id}>
              {base.reduce_base_name}
            </option>
          ))}
        </select>
      </div>

      {/* Остальные поля формы */}
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="amount">Запрашиваемая сумма снижения:</label>
        <input
          id="amount" type="number" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={mutation.isPending} required
          style={{ width: '100%', padding: '8px', marginTop: '4px' }}
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="description">Подробное обоснование:</label>
        <textarea
          id="description" value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={mutation.isPending} required rows="5"
          style={{ width: '100%', padding: '8px', marginTop: '4px' }}
        />
      </div>

      <button type="submit" disabled={mutation.isPending} style={{ width: '100%', padding: '10px' }}>
        {mutation.isPending ? 'Отправка...' : 'Отправить заявление'}
      </button>

      {mutation.isError && (
        <p style={{ color: 'red', marginTop: '1rem' }}>
          Не удалось отправить заявление: {mutation.error.response?.data?.[0] || mutation.error.message}
        </p>
      )}
    </form>
  );
};

export default CreateRequestForm;