import React, { useState } from 'react';

const SearchForm = ({ onSearch, onClear, loading, regions }) => {
  const [searchType, setSearchType] = useState('simple');
  const [searchQuery, setSearchQuery] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState({
    inn: '',
    fio: '',
    org_name: '',
    region_id: '',
    payer_type_id: '',
    tax_regime_id: '',
    address: ''
  });

  const handleSearch = (e) => {
    e.preventDefault();
    const params = searchType === 'simple' 
      ? { type: 'simple', query: searchQuery }
      : { type: 'advanced', ...advancedFilters };
    
    onSearch(params);
  };

  const handleAdvancedFilterChange = (field, value) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearForm = () => {
    setSearchQuery('');
    setAdvancedFilters({
      inn: '',
      fio: '',
      org_name: '',
      region_id: '',
      payer_type_id: '',
      tax_regime_id: '',
      address: ''
    });
    onClear();
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-header bg-light">
        <ul className="nav nav-tabs card-header-tabs">
          <li className="nav-item">
            <button
              className={`nav-link ${searchType === 'simple' ? 'active' : ''}`}
              onClick={() => setSearchType('simple')}
            >
              <i className="bi bi-search me-2"></i>
              Простой поиск
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${searchType === 'advanced' ? 'active' : ''}`}
              onClick={() => setSearchType('advanced')}
            >
              <i className="bi bi-sliders me-2"></i>
              Расширенный поиск
            </button>
          </li>
        </ul>
      </div>
      <div className="card-body">
        {/* Простой поиск */}
        {searchType === 'simple' && (
          <form onSubmit={handleSearch}>
            <div className="row">
              <div className="col-md-8">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Введите ИНН, ФИО, название организации, адрес..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    required
                  />
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Поиск...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-search me-2"></i>
                        Найти
                      </>
                    )}
                  </button>
                </div>
                <div className="form-text">
                  Поиск по всем полям: ИНН, ФИО, название организации, ОГРН, адрес регистрации
                  <br />
                  <small className="text-muted mt-2">Показывается по 10 результатов, нажмите "Показать еще" для загрузки следующих</small>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* Расширенный поиск */}
        {searchType === 'advanced' && (
          <form onSubmit={handleSearch}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">ИНН</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Введите ИНН"
                  value={advancedFilters.inn}
                  onChange={(e) => handleAdvancedFilterChange('inn', e.target.value)}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">ФИО (для физлиц)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Введите ФИО"
                  value={advancedFilters.fio}
                  onChange={(e) => handleAdvancedFilterChange('fio', e.target.value)}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Название организации</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Введите название организации"
                  value={advancedFilters.org_name}
                  onChange={(e) => handleAdvancedFilterChange('org_name', e.target.value)}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Регион</label>
                <select
                  className="form-select"
                  value={advancedFilters.region_id}
                  onChange={(e) => handleAdvancedFilterChange('region_id', e.target.value)}
                >
                  <option value="">Все регионы</option>
                  {regions.map(region => (
                    <option key={region.region_id} value={region.region_id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Тип налогоплательщика</label>
                <select
                  className="form-select"
                  value={advancedFilters.payer_type_id}
                  onChange={(e) => handleAdvancedFilterChange('payer_type_id', e.target.value)}
                >
                  <option value="">Все типы</option>
                  <option value="1">Физическое лицо</option>
                  <option value="2">Индивидуальный предприниматель</option>
                  <option value="3">Юридическое лицо</option>
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Налоговый режим</label>
                <select
                  className="form-select"
                  value={advancedFilters.tax_regime_id}
                  onChange={(e) => handleAdvancedFilterChange('tax_regime_id', e.target.value)}
                >
                  <option value="">Все режимы</option>
                  <option value="1">ОСН</option>
                  <option value="2">УСН</option>
                  <option value="3">Патент</option>
                </select>
              </div>
              <div className="col-12 mb-3">
                <label className="form-label">Адрес</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Введите адрес регистрации или фактический адрес"
                  value={advancedFilters.address}
                  onChange={(e) => handleAdvancedFilterChange('address', e.target.value)}
                />
              </div>
              
              <div className="form-text mb-3">
                    <small className="text-muted">Показывается по 10 результатов, нажмите "Показать еще" для загрузки следующих</small>
              </div>

              <div className="col-12">
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Поиск...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-search me-2"></i>
                        Найти
                      </>
                    )}
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={clearForm}>
                    <i className="bi bi-x-circle me-2"></i>
                    Очистить
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SearchForm;