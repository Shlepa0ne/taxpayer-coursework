import React from 'react';

const SearchResults = ({ searchResults, onTaxpayerSelect, getRiskScoreColor, getRiskScoreText }) => {
  if (searchResults.length === 0) {
    return null;
  }

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-header bg-light">
        <h5 className="card-title mb-0">
          <i className="bi bi-list-ul me-2"></i>
          Результаты поиска ({searchResults.length})
        </h5>
      </div>
      <div className="card-body p-0">
        <div className="list-group list-group-flush">
          {searchResults.map(taxpayer => (
            <button
              key={taxpayer.taxpayer_id}
              className="list-group-item list-group-item-action"
              onClick={() => onTaxpayerSelect(taxpayer.taxpayer_id)}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h6 className="mb-1">
                    {taxpayer.fio || taxpayer.full_name || taxpayer.short_name || 'Без названия'}
                    {taxpayer.payer_type_id === 1 && (
                      <span className="badge bg-primary ms-2">Физ. лицо</span>
                    )}
                    {taxpayer.payer_type_id === 2 && (
                      <span className="badge bg-warning ms-2">ИП</span>
                    )}
                    {taxpayer.payer_type_id === 3 && (
                      <span className="badge bg-info ms-2">Юр. лицо</span>
                    )}
                  </h6>
                  <p className="mb-1 text-muted">
                    <strong>ИНН:</strong> {taxpayer.inn}
                    {taxpayer.ogrn && (
                      <> | <strong>ОГРН:</strong> {taxpayer.ogrn}</>
                    )}
                  </p>
                  <p className="mb-1 text-muted small">
                    <strong>Адрес:</strong> {taxpayer.registration_address || 'Не указан'}
                  </p>
                  <p className="mb-0 text-muted small">
                    <strong>Регион:</strong> {taxpayer.region_name} | 
                    <strong> Налоговый режим:</strong> {taxpayer.tax_regime_name}
                  </p>
                </div>
                <div className="text-end">
                  <div className={`badge bg-${getRiskScoreColor(taxpayer.risk_score)} mb-2`}>
                    RiskScore: {taxpayer.risk_score ?? 'Нет данных'}
                  </div>
                  <br />
                  <small className="text-muted">
                    {getRiskScoreText(taxpayer.risk_score)}
                  </small>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchResults;