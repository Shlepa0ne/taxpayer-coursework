import React, { useState, useEffect } from 'react';
import { getTaxRegimes, getPayerStatuses } from '../../../api/workersApi';

const EditMainInfoForm = ({ data, onChange, onSave, onCancel, taxpayerType, currentTaxpayer }) => {
  const [taxRegimes, setTaxRegimes] = useState([]);
  const [payerStatuses, setPayerStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  // УДАЛИТЬ локальное состояние formData и использовать напрямую data из props
  // const [formData, setFormData] = useState({...});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regimesData, statusesData] = await Promise.all([
          getTaxRegimes(),
          getPayerStatuses()
        ]);
        setTaxRegimes(regimesData);
        setPayerStatuses(statusesData);
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        // Заглушки на случай ошибки
        setTaxRegimes([
          { regime_id: 1, name: 'ОСН' },
          { regime_id: 2, name: 'УСН' },
          { regime_id: 3, name: 'Патент' }
        ]);
        setPayerStatuses([
          { payer_status_id: 1, name: 'активный' },
          { payer_status_id: 2, name: 'неактивный' },
          { payer_status_id: 3, name: 'имеет задолженность' }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Используем useCallback для стабильной функции
  const handleChange = React.useCallback((field, value) => {
    // Вместо обновления локального состояния, сразу вызываем onChange
    const updatedData = { 
      ...data, 
      [field]: value 
    };
    
    // Фильтруем данные для отправки в родительский компонент
    const dataToSend = { ...updatedData };
    
    // Для физических лиц удаляем поля, которые им не положены
    if (taxpayerType === 1) {
      delete dataToSend.ogrn;
      delete dataToSend.full_name;
      delete dataToSend.short_name;
      delete dataToSend.executive_list;
    }
    // Для ИП и Юрлиц удаляем ФИО
    else if (taxpayerType === 2 || taxpayerType === 3) {
      delete dataToSend.fio;
    }
    
    // Передаем изменения в родительский компонент
    if (onChange) {
      onChange(dataToSend);
    }
  }, [data, taxpayerType, onChange]);

  const handleSave = React.useCallback(() => {
    console.log('Saving form data:', data);
    
    // Проверяем обязательные поля перед сохранением
    if (!data.tax_regime_id || !data.payer_status_id) {
      alert('Пожалуйста, заполните обязательные поля: Налоговый режим и Статус плательщика');
      return;
    }

    // Если Физлицо - проверяем ФИО
    if (taxpayerType === 1 && !data.fio) {
      alert('Пожалуйста, заполните ФИО');
      return;
    }

    // Если ИП или Юрлицо - проверяем полное наименование
    if ((taxpayerType === 2 || taxpayerType === 3) && !data.full_name) {
      alert('Пожалуйста, заполните полное наименование');
      return;
    }

    onSave();
  }, [data, taxpayerType, onSave]);

  if (loading) {
    return <div className="text-center py-4">Загрузка данных...</div>;
  }

  return (
    <div className="row">
      <div className="col-md-6">
        <h6 className="text-muted mb-3">Основные данные</h6>
        
        {taxpayerType === 1 && ( // Физическое лицо
          <div className="mb-3">
            <label className="form-label">ФИО *</label>
            <input
              type="text"
              className="form-control"
              value={data.fio || ''}
              onChange={(e) => handleChange('fio', e.target.value)}
              required
            />
          </div>
        )}

        {(taxpayerType === 2 || taxpayerType === 3) && ( // ИП или Юрлицо
          <>
            <div className="mb-3">
              <label className="form-label">Полное наименование *</label>
              <input
                type="text"
                className="form-control"
                value={data.full_name || ''}
                onChange={(e) => handleChange('full_name', e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Сокращенное наименование</label>
              <input
                type="text"
                className="form-control"
                value={data.short_name || ''}
                onChange={(e) => handleChange('short_name', e.target.value)}
              />
            </div>
          </>
        )}

        <div className="mb-3">
          <label className="form-label">Дата рождения/регистрации</label>
          <input
            type="date"
            className="form-control"
            value={data.birth_date || ''}
            onChange={(e) => handleChange('birth_date', e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Налоговый режим *</label>
          <select
            className="form-select"
            value={data.tax_regime_id || ''}
            onChange={(e) => handleChange('tax_regime_id', parseInt(e.target.value) || '')}
            required
          >
            <option value="">Выберите режим</option>
            {taxRegimes.map(regime => (
              <option key={regime.regime_id} value={regime.regime_id}>
                {regime.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Статус плательщика *</label>
          <select
            className="form-select"
            value={data.payer_status_id || ''}
            onChange={(e) => handleChange('payer_status_id', parseInt(e.target.value) || '')}
            required
          >
            <option value="">Выберите статус</option>
            {payerStatuses.map(status => (
              <option key={status.payer_status_id} value={status.payer_status_id}>
                {status.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="col-md-6">
        <h6 className="text-muted mb-3">Адреса и реквизиты</h6>
        
        <div className="mb-3">
          <label className="form-label">Адрес регистрации</label>
          <textarea
            className="form-control"
            rows="2"
            value={data.registration_address || ''}
            onChange={(e) => handleChange('registration_address', e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Фактический адрес</label>
          <textarea
            className="form-control"
            rows="2"
            value={data.fact_address || ''}
            onChange={(e) => handleChange('fact_address', e.target.value)}
          />
        </div>

        {/* ОГРН только для ИП и Юрлиц */}
        {(taxpayerType === 2 || taxpayerType === 3) && (
          <div className="mb-3">
            <label className="form-label">ОГРН</label>
            <input
              type="text"
              className="form-control"
              value={data.ogrn || ''}
              onChange={(e) => handleChange('ogrn', e.target.value)}
            />
          </div>
        )}

        <div className="mb-3">
          <label className="form-label">Банковские реквизиты</label>
          <textarea
            className="form-control"
            rows="2"
            value={data.bank_detals || ''}
            onChange={(e) => handleChange('bank_detals', e.target.value)}
          />
        </div>

        {(taxpayerType === 2 || taxpayerType === 3) && (
          <div className="mb-3">
            <label className="form-label">Руководители</label>
            <textarea
              className="form-control"
              rows="2"
              value={data.executive_list || ''}
              onChange={(e) => handleChange('executive_list', e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="col-12 mt-4">
        <div className="d-flex gap-2">
          <button className="btn btn-success" onClick={handleSave}>
            <i className="bi bi-check-circle me-2"></i>
            Сохранить
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            <i className="bi bi-x-circle me-2"></i>
            Отмена
          </button>
        </div>
        <div className="text-muted small mt-2">
          <i className="bi bi-info-circle me-1"></i>
          Поля, отмеченные *, обязательны для заполнения
        </div>
      </div>
    </div>
  );
};

export default React.memo(EditMainInfoForm);