import React, { useState, useEffect } from 'react';
import { getMyAccruals } from '../api/taxpayersApi';
import Spinner from '../components/ui/Spinner';

const MyTaxesPage = () => {
  const [accruals, setAccruals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAccruals = async () => {
      try {
        setLoading(true);
        const data = await getMyAccruals();
        setAccruals(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAccruals();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <div className="alert alert-danger">Ошибка: {error}</div>;

  return (
    <div>
      <h2>Мои налоговые начисления</h2>
      {accruals.length === 0 ? (
        <p>Нет данных о начислениях</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Дата начисления</th>
              <th>Сумма</th>
              <th>Срок оплаты</th>
            </tr>
          </thead>
          <tbody>
            {accruals.map(accrual => (
              <tr key={accrual.tax_accrual_id}>
                <td>{new Date(accrual.accrual_date).toLocaleDateString()}</td>
                <td>{accrual.accrual_amount} руб.</td>
                <td>{new Date(accrual.due_date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MyTaxesPage;