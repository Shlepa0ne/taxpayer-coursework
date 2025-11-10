import React from 'react';

const TaxpayerListItem = ({ taxpayer, isLoading, onCalculate }) => {
  return (
    <li className="taxpayer-item">
      <div className="taxpayer-info">
        <p><strong>ФИО:</strong> {taxpayer.fio}</p>
        <p><strong>ИНН:</strong> {taxpayer.inn}</p>
      </div>
      <div className="taxpayer-actions">
        {/* Условный рендеринг результата или ошибки */}
        {taxpayer.riskScore !== undefined && (
          <p className="risk-score"><strong>Risk Score:</strong> {taxpayer.riskScore}</p>
        )}
        {taxpayer.error && (
          <p className="error-message">{taxpayer.error}</p>
        )}
        <button
          onClick={() => onCalculate(taxpayer.taxpayer_id)}
          disabled={isLoading}
        >
          {isLoading ? 'Расчет...' : 'Рассчитать Risk Score'}
        </button>
      </div>
    </li>
  );
};

export default TaxpayerListItem;