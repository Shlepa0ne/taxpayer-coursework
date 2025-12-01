// frontend/src/pages/worker/WorkerReports.jsx
import React, { useState, useEffect } from 'react';
import { generateReport, getRegions, getTaxRegimes } from '../../api/workersApi';
import Spinner from '../../components/ui/Spinner';

const WorkerReports = () => {
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [taxRegimes, setTaxRegimes] = useState([]);
  const [reportType, setReportType] = useState('general'); // 'general' или 'filtered'
  
  const [reportParams, setReportParams] = useState({
    regions: [],
    payerTypes: [],
    taxRegimes: [],
    riskScoreRange: { min: 0, max: 100 },
    sections: {
      basicInfo: true,
      financialSummary: true,
      riskAnalysis: true,
      inspections: true,
      declarations: true,
      accruals: true
    }
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [regionsData, regimesData] = await Promise.all([
          getRegions(),
          getTaxRegimes()
        ]);
        setRegions(regionsData);
        setTaxRegimes(regimesData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  const handleParamChange = (key, value) => {
    setReportParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSectionToggle = (section) => {
    setReportParams(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: !prev.sections[section]
      }
    }));
  };

  const handleGenerateReport = async () => {
    if (Object.values(reportParams.sections).every(section => !section)) {
      alert('Выберите хотя бы один раздел для включения в отчет');
      return;
    }

    setLoading(true);
    try {
      // Для общего отчета очищаем фильтры
      const finalParams = reportType === 'general' 
        ? { ...reportParams, regions: [], payerTypes: [], taxRegimes: [], riskScoreRange: { min: 0, max: 100 } }
        : reportParams;

      const response = await generateReport(finalParams);
      
      // Создаем blob для скачивания
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tax_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      alert('Отчет успешно сгенерирован и скачивается');
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Ошибка при генерации отчета: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const payerTypes = [
    { id: 1, name: 'Физические лица' },
    { id: 2, name: 'Индивидуальные предприниматели' },
    { id: 3, name: 'Юридические лица' }
  ];

  const handleResetFilters = () => {
    setReportParams({
      regions: [],
      payerTypes: [],
      taxRegimes: [],
      riskScoreRange: { min: 0, max: 100 },
      sections: {
        basicInfo: true,
        financialSummary: true,
        riskAnalysis: true,
        inspections: true,
        declarations: true,
        accruals: true
      }
    });
  };

  const handleSelectAllSections = () => {
    setReportParams(prev => ({
      ...prev,
      sections: Object.keys(prev.sections).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {})
    }));
  };

  const handleClearAllSections = () => {
    setReportParams(prev => ({
      ...prev,
      sections: Object.keys(prev.sections).reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {})
    }));
  };

  if (loading) return <Spinner />;

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2>Генерация аналитических отчетов</h2>
              <p className="text-muted mb-0">Создание отчетов по налогоплательщикам</p>
            </div>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-outline-secondary"
                onClick={handleResetFilters}
              >
                <i className="bi bi-arrow-clockwise me-2"></i>
                Сбросить
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleGenerateReport}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Генерация...
                  </>
                ) : (
                  <>
                    <i className="bi bi-file-pdf me-2"></i>
                    Сгенерировать PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Выбор типа отчета */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-light">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-gear me-2"></i>
                    Тип отчета
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="reportType"
                          id="generalReport"
                          value="general"
                          checked={reportType === 'general'}
                          onChange={(e) => setReportType(e.target.value)}
                        />
                        <label className="form-check-label fw-bold" htmlFor="generalReport">
                          <i className="bi bi-graph-up me-2 text-primary"></i>
                          Общий отчет
                        </label>
                        <small className="text-muted d-block mt-1">
                          Статистика по всем налогоплательщикам без фильтрации
                        </small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="reportType"
                          id="filteredReport"
                          value="filtered"
                          checked={reportType === 'filtered'}
                          onChange={(e) => setReportType(e.target.value)}
                        />
                        <label className="form-check-label fw-bold" htmlFor="filteredReport">
                          <i className="bi bi-funnel me-2 text-success"></i>
                          Отчет по фильтрам
                        </label>
                        <small className="text-muted d-block mt-1">
                          Детальный анализ с применением фильтров
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            {/* Левая колонка - фильтры (только для отчета по фильтрам) */}
            {reportType === 'filtered' && (
              <div className="col-md-4">
                <div className="card border-0 shadow-sm mb-4">
                  <div className="card-header bg-primary text-white">
                    <h5 className="card-title mb-0">
                      <i className="bi bi-funnel me-2"></i>
                      Фильтры данных
                    </h5>
                  </div>
                  <div className="card-body">
                    {/* Регионы */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">Регионы</label>
                      <select 
                        className="form-select"
                        multiple
                        size="4"
                        value={reportParams.regions}
                        onChange={(e) => handleParamChange('regions', 
                          Array.from(e.target.selectedOptions, option => option.value)
                        )}
                      >
                        {regions.map(region => (
                          <option key={region.region_id} value={region.region_id}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                      <small className="text-muted">Удерживайте Ctrl для множественного выбора</small>
                    </div>

                    {/* Типы плательщиков */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">Типы плательщиков</label>
                      <select 
                        className="form-select"
                        multiple
                        size="3"
                        value={reportParams.payerTypes}
                        onChange={(e) => handleParamChange('payerTypes', 
                          Array.from(e.target.selectedOptions, option => parseInt(option.value))
                        )}
                      >
                        {payerTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Налоговые режимы */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">Налоговые режимы</label>
                      <select 
                        className="form-select"
                        multiple
                        size="3"
                        value={reportParams.taxRegimes}
                        onChange={(e) => handleParamChange('taxRegimes', 
                          Array.from(e.target.selectedOptions, option => parseInt(option.value))
                        )}
                      >
                        {taxRegimes.map(regime => (
                          <option key={regime.regime_id} value={regime.regime_id}>
                            {regime.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Диапазон RiskScore */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">Диапазон RiskScore</label>
                      <div className="row g-2">
                        <div className="col-6">
                          <input 
                            type="number" 
                            className="form-control"
                            placeholder="От"
                            min="0"
                            max="100"
                            value={reportParams.riskScoreRange.min}
                            onChange={(e) => handleParamChange('riskScoreRange', {
                              ...reportParams.riskScoreRange,
                              min: parseInt(e.target.value) || 0
                            })}
                          />
                        </div>
                        <div className="col-6">
                          <input 
                            type="number" 
                            className="form-control"
                            placeholder="До"
                            min="0"
                            max="100"
                            value={reportParams.riskScoreRange.max}
                            onChange={(e) => handleParamChange('riskScoreRange', {
                              ...reportParams.riskScoreRange,
                              max: parseInt(e.target.value) || 100
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Правая колонка - разделы отчета */}
            <div className={reportType === 'filtered' ? 'col-md-8' : 'col-12'}>
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-success text-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="card-title mb-0">
                      <i className="bi bi-list-check me-2"></i>
                      Разделы отчета
                    </h5>
                    <div className="btn-group btn-group-sm" role="group">
                      <button 
                        type="button" 
                        className="btn btn-light"
                        onClick={handleSelectAllSections}
                      >
                        Все
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-light"
                        onClick={handleClearAllSections}
                      >
                        Ничего
                      </button>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    {[
                      { key: 'basicInfo', icon: 'bar-chart', color: 'primary', title: 'Основные показатели', desc: 'Общее количество, распределение по типам, регионам и режимам' },
                      { key: 'financialSummary', icon: 'currency-dollar', color: 'success', title: 'Финансовая сводка', desc: 'Начисленные и уплаченные налоги, задолженности, процент оплаты' },
                      { key: 'riskAnalysis', icon: 'exclamation-triangle', color: 'warning', title: 'Анализ рисков', desc: 'RiskScore, распределение по группам риска, топ рисковых плательщиков' },
                      { key: 'inspections', icon: 'clipboard-check', color: 'info', title: 'Проверочная деятельность', desc: 'Количество проверок, нарушения, суммы доначислений' },
                      { key: 'declarations', icon: 'file-earmark-spreadsheet', color: 'secondary', title: 'Декларационная работа', desc: 'Статистика по декларациям, процент одобрения' },
                      { key: 'accruals', icon: 'receipt', color: 'danger', title: 'Заявления на снижение', desc: 'Статистика заявлений, процент одобрения, суммы' }
                    ].map(section => (
                      <div key={section.key} className="col-md-6">
                        <div className={`form-check p-3 border rounded h-100 ${reportParams.sections[section.key] ? 'border-primary bg-light' : ''}`}>
                          <input 
                            className="form-check-input"
                            type="checkbox"
                            checked={reportParams.sections[section.key]}
                            onChange={() => handleSectionToggle(section.key)}
                          />
                          <label className="form-check-label fw-bold w-100">
                            <i className={`bi bi-${section.icon} me-2 text-${section.color}`}></i>
                            {section.title}
                          </label>
                          <small className="text-muted d-block mt-1">
                            {section.desc}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Информация */}
              <div className="row mt-4">
                <div className="col-12">
                  <div className="card border-info">
                    <div className="card-header bg-info text-white">
                      <h6 className="card-title mb-0">
                        <i className="bi bi-info-circle me-2"></i>
                        Рекомендации по анализу
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          <ul className="mb-0 small">
                            <li>Для полного анализа используйте все основные разделы</li>
                            <li>Плательщики с RiskScore > 70 требуют особого внимания</li>
                          </ul>
                        </div>
                        <div className="col-md-6">
                          <ul className="mb-0 small">
                            <li>Сравнивайте показатели по регионам и типам плательщиков</li>
                            <li>Анализируйте эффективность налоговых режимов</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerReports;