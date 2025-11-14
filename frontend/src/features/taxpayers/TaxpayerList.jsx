import React from 'react';
import Card from '../../components/ui/Card';

const TaxpayerList = ({ taxpayers }) => {
  if (!taxpayers || taxpayers.length === 0) {
    return <p>Список пуст.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {taxpayers.map((tp) => (
        <Card key={tp.id}>
          <h3>{tp.full_name || tp.short_name}</h3>
          <p>ИНН: {tp.inn}</p>
          <p>КПП: {tp.kpp}</p>
          {/* Здесь позже добавим кнопку расчета риска */}
        </Card>
      ))}
    </div>
  );
};

export default TaxpayerList;