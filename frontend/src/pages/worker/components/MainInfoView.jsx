import React from 'react';
import { formatDate } from '../../../utils/formatters';

// Добавим функцию для получения цвета статуса
const getPayerStatusColor = (statusId) => {
  const statusColors = {
    1: 'success', // активный - зеленый
    2: 'secondary', // неактивный - серый
    3: 'danger' // имеет задолженность - красный
  };
  return statusColors[statusId] || 'secondary';
};

// Добавим функцию для получения текста статуса
const getPayerStatusText = (statusId) => {
  const statusTexts = {
    1: 'активный',
    2: 'неактивный', 
    3: 'имеет задолженность'
  };
  return statusTexts[statusId] || 'неизвестно';
};

const MainInfoView = ({ taxpayer }) => (
  <div className="row">
    <div className="col-md-6">
      <h6 className="text-muted mb-3">Основные данные</h6>
      <div className="mb-3">
        <strong>Тип налогоплательщика:</strong>{' '}
        <span className="badge bg-primary">{taxpayer.payer_type_name}</span>
      </div>
      <div className="mb-3">
        <strong>Статус плательщика:</strong>{' '}
        <span className={`badge bg-${getPayerStatusColor(taxpayer.payer_status_id)}`}>
          {getPayerStatusText(taxpayer.payer_status_id)}
        </span>
      </div>
      <div className="mb-3">
        <strong>Регион:</strong> {taxpayer.region_name}
      </div>
      <div className="mb-3">
        <strong>Налоговый режим:</strong> {taxpayer.tax_regime_name}
      </div>
      {taxpayer.birth_date && (
        <div className="mb-3">
          <strong>Дата рождения:</strong> {formatDate(taxpayer.birth_date)}
        </div>
      )}
      {taxpayer.registration_date && (
        <div className="mb-3">
          <strong>Дата регистрации:</strong> {formatDate(taxpayer.registration_date)}
        </div>
      )}
    </div>
    <div className="col-md-6">
      <h6 className="text-muted mb-3">Адреса</h6>
      <div className="mb-3">
        <strong>Адрес регистрации:</strong><br />
        {taxpayer.registration_address || 'Не указан'}
      </div>
      <div className="mb-3">
        <strong>Фактический адрес:</strong><br />
        {taxpayer.fact_address || 'Не указан'}
      </div>
      {taxpayer.executive_list && (
        <div className="mb-3">
          <strong>Руководители:</strong><br />
          {taxpayer.executive_list}
        </div>
      )}
      {taxpayer.bank_detals && (
        <div className="mb-3">
          <strong>Банковские реквизиты:</strong><br />
          {taxpayer.bank_detals}
        </div>
      )}
    </div>
  </div>
);

export default MainInfoView;