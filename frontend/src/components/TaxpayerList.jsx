import React, { useState, useEffect } from 'react';
// Импортируем наши функции из единого, общего сервиса
import { getTaxpayers, calculateRiskScore } from '../api/apiService';
import TaxpayerListItem from './TaxpayerListItem';
import './TaxpayerList.css';

const TaxpayerList = () => {
  const [taxpayers, setTaxpayers] = useState([]);
  const [listError, setListError] = useState(null);
  const [loadingScoreId, setLoadingScoreId] = useState(null);

  useEffect(() => {
    // Вызываем функцию, которая использует наш настроенный apiClient с перехватчиком
    getTaxpayers()
      .then(response => {
        setTaxpayers(response);
      })
      .catch(err => {
        console.error("Ошибка при загрузке списка налогоплательщиков:", err);
        setListError("Не удалось загрузить данные. Проверьте консоль и доступность API.");
      });
  }, []);

  const handleCalculateScore = async (taxpayerId) => {
    setLoadingScoreId(taxpayerId);

    setTaxpayers(current => current.map(tp => 
      tp.taxpayer_id === taxpayerId ? { ...tp, riskScore: undefined, error: undefined } : tp
    ));

    try {
      const data = await calculateRiskScore(taxpayerId);
      const { risk_score } = data;

      setTaxpayers(current =>
        current.map(tp =>
          tp.taxpayer_id === taxpayerId
            ? { ...tp, riskScore: risk_score }
            : tp
        )
      );
    } catch (err) {
      console.error(`Ошибка при расчете RiskScore для ID ${taxpayerId}:`, err);
      const errorMessage = err.response?.data?.error || "Произошла сетевая ошибка.";
      
      setTaxpayers(current =>
        current.map(tp =>
          tp.taxpayer_id === taxpayerId
            ? { ...tp, error: errorMessage }
            : tp
        )
      );
    } finally {
      setLoadingScoreId(null);
    }
  };

  if (listError) {
    return <div className="error-message">{listError}</div>;
  }

  return (
    <div className="taxpayer-list-container">
      <h1>Список Налогоплательщиков</h1>
      <ul className="taxpayer-list">
        {taxpayers.map(taxpayer => (
          <TaxpayerListItem
            key={taxpayer.taxpayer_id}
            taxpayer={taxpayer}
            isLoading={loadingScoreId === taxpayer.taxpayer_id}
            onCalculate={handleCalculateScore}
          />
        ))}
      </ul>
    </div>
  );
};

export default TaxpayerList;