import React, { useState } from 'react';

const SearchWorkersForm = ({ onSearch, onClear, loading }) => {
  const [searchType, setSearchType] = useState('simple');
  const [searchQuery, setSearchQuery] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState({
    tax_officer_name: '',
    unit: '',
    role_id: ''
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
      tax_officer_name: '',
      unit: '',
      role_id: ''
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
                    placeholder="Введите ФИО, подразделение..."
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
                  Поиск по ФИО и подразделению сотрудников
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
                <label className="form-label">ФИО сотрудника</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Введите ФИО"
                  value={advancedFilters.tax_officer_name}
                  onChange={(e) => handleAdvancedFilterChange('tax_officer_name', e.target.value)}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Подразделение</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Введите подразделение"
                  value={advancedFilters.unit}
                  onChange={(e) => handleAdvancedFilterChange('unit', e.target.value)}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Должность</label>
                <select
                  className="form-select"
                  value={advancedFilters.role_id}
                  onChange={(e) => handleAdvancedFilterChange('role_id', e.target.value)}
                >
                  <option value="">Все должности</option>
                  <option value="1">Инспектор</option>
                  <option value="2">Старший инспектор</option>
                  <option value="3">Руководитель</option>
                </select>
              </div>
              {/* УБРАНО: поле ИНН */}
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

export default SearchWorkersForm;