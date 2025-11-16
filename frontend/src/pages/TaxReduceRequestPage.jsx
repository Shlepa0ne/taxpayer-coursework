import React from 'react';
import CreateRequestForm from '../features/tax_requests/CreateRequestForm';

const TaxReduceRequestPage = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Подача заявления на снижение налога</h2>
      <p>Пожалуйста, заполните все поля ниже, чтобы отправить ваше заявление на рассмотрение.</p>
      <CreateRequestForm />
    </div>
  );
};

export default TaxReduceRequestPage;