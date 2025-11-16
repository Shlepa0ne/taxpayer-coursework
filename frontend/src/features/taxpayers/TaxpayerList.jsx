import React from 'react';
import Card from '../../components/ui/Card';

const TaxpayerList = ({ taxpayers }) => {
  if (!taxpayers || taxpayers.length === 0) {
    return <p>Список налогоплательщиков пуст.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {taxpayers.map((tp) => (
        <Card key={tp.taxpayer_id}>
          <h3>{tp.short_name || 'Название не указано'}</h3>
          {tp.full_name && <p><strong>Полное наименование:</strong> {tp.full_name}</p>}
          <p><strong>ИНН:</strong> {tp.inn}</p>
          {}
        </Card>
      ))}
    </div>
  );
};

export default TaxpayerList;