import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TaxpayerListItem from './TaxpayerListItem';
import './TaxpayerList.css';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
});

const TaxpayerList = () => {
  const [taxpayers, setTaxpayers] = useState([]);
  const [listError, setListError] = useState(null);
  const [loadingScoreId, setLoadingScoreId] = useState(null);

  useEffect(() => {
    apiClient.get('/taxpayers/')
      .then(response => {
        setTaxpayers(response.data);
      })
      .catch(err => {
        console.error("Ошибка при загрузке списка налогоплательщиков:", err);
        setListError("Не удалось загрузить данные. Проверьте консоль и доступность API.");
      });
  }, []);

  const handleCalculateScore = async (taxpayerId) => {
    setLoadingScoreId(taxpayerId);

    // Перед новым запросом очищаем старые результаты и ошибки для этого элемента.
    setTaxpayers(current => current.map(tp => 
      tp.taxpayer_id === taxpayerId ? { ...tp, riskScore: undefined, error: undefined } : tp
    ));

    try {
      const response = await apiClient.post('/calculate-risk-score/', {
        taxpayer_id: taxpayerId,
      });
      const { risk_score } = response.data;

      // Обновляем состояние, добавляя risk_score к нужному элементу.
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
      
      // Обновляем состояние, добавляя сообщение об ошибке к нужному элементу.
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
