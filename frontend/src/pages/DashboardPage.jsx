import React from 'react';
import TaxpayerList from '../components/TaxpayerList';

function DashboardPage() {
  return (
    <div>
      <h1>Панель управления: Список налогоплательщиков</h1>
      <TaxpayerList />
    </div>
  );
}

export default DashboardPage;