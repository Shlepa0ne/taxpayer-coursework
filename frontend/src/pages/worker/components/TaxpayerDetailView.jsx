import React, { useState, useEffect, useCallback } from 'react';
import { updateTaxpayerInfo } from '../../../api/workersApi';
import { formatDate, getRiskScoreColor, getRiskScoreText, getRequestStatusColor, formatCurrency } from '../../../utils/formatters';
import MainInfoView from './MainInfoView';
import EditMainInfoForm from './EditMainInfoForm';
import DocumentsSection from './DocumentsSection';
import ContactsSection from './ContactsSection';
import ObjectsSection from './ObjectsSection';
import TaxAccrualsTab from './TaxAccrualsTab';

const TaxpayerDetailView = ({ 
  taxpayer, 
  onRequestClick, 
  onDeclarationClick,
  onInspectionClick,
  onAccrualClick,
  onContactClick, 
  onDocumentClick, 
  onObjectClick, 
  onDeleteContact, 
  onDeleteDocument, 
  onDeleteObject, 
  canChangeStatus, 
  onTaxpayerUpdate, 
  currentWorker 
}) => {
  const [activeTab, setActiveTab] = useState('main');
  const [editingMainInfo, setEditingMainInfo] = useState(false);
  const [editedMainInfo, setEditedMainInfo] = useState({});

  // Используем useCallback для стабильных функций
  const isSeniorInspector = React.useMemo(() => {
    return currentWorker?.role_id && [2, 3].includes(Number(currentWorker.role_id));
  }, [currentWorker]);

  // Функции для проверки возможности клика
  const canClickDeclaration = useCallback((declaration) => {
    return true;
  }, []);

  const canClickRequest = useCallback((request) => {
    return true;
  }, []);

  const canClickInspection = useCallback((inspection) => {
    return true;
  }, []);

  // Инициализация редактируемых данных - ТОЛЬКО ПРИ ИЗМЕНЕНИИ taxpayer
  useEffect(() => {
    if (taxpayer) {
      setEditedMainInfo({
        fio: taxpayer.fio || '',
        full_name: taxpayer.full_name || '',
        short_name: taxpayer.short_name || '',
        birth_date: taxpayer.birth_date || '',
        registration_address: taxpayer.registration_address || '',
        fact_address: taxpayer.fact_address || '',
        ogrn: taxpayer.ogrn || '',
        bank_detals: taxpayer.bank_detals || '',
        executive_list: taxpayer.executive_list || '',
        tax_regime_id: taxpayer.tax_regime_id || '',
        payer_status_id: taxpayer.payer_status_id || ''
      });
    }
  }, [taxpayer]);

  // Стабильная функция для обновления editedMainInfo
  const handleMainInfoChange = useCallback((newData) => {
    setEditedMainInfo(newData);
  }, []);

  const handleSaveMainInfo = useCallback(async () => {
    try {
      console.log('Saving taxpayer data:', editedMainInfo);
      
      // Фильтруем данные перед отправкой
      const dataToSend = { ...editedMainInfo };
      
      // Для физических лиц удаляем поля, которые им не положены
      if (taxpayer.payer_type_id === 1) {
        delete dataToSend.ogrn;
        delete dataToSend.full_name;
        delete dataToSend.short_name;
        delete dataToSend.executive_list;
      }
      // Для ИП и Юрлиц удаляем ФИО
      else if (taxpayer.payer_type_id === 2 || taxpayer.payer_type_id === 3) {
        delete dataToSend.fio;
      }

      // Проверяем обязательные поля
      if (!dataToSend.tax_regime_id || !dataToSend.payer_status_id) {
        alert('Пожалуйста, заполните обязательные поля: Налоговый режим и Статус плательщика');
        return;
      }

      // Если Физлицо - проверяем ФИО
      if (taxpayer.payer_type_id === 1 && !dataToSend.fio) {
        alert('Пожалуйста, заполните ФИО');
        return;
      }

      // Если ИП или Юрлицо - проверяем полное наименование
      if ((taxpayer.payer_type_id === 2 || taxpayer.payer_type_id === 3) && !dataToSend.full_name) {
        alert('Пожалуйста, заполните полное наименование');
        return;
      }

      const result = await updateTaxpayerInfo(taxpayer.taxpayer_id, dataToSend);
      console.log('Save successful:', result);
      
      setEditingMainInfo(false);
      if (onTaxpayerUpdate) {
        onTaxpayerUpdate(taxpayer.taxpayer_id);
      }
      
      alert('Данные успешно сохранены!');
      
    } catch (error) {
      console.error('Ошибка при сохранении данных:', error);
      alert('Ошибка при сохранении данных: ' + (error.response?.data?.error || error.message));
    }
  }, [editedMainInfo, taxpayer, onTaxpayerUpdate]);

  const handleCancelEdit = useCallback(() => {
    setEditingMainInfo(false);
    // Восстанавливаем исходные данные из taxpayer
    setEditedMainInfo({
      fio: taxpayer.fio || '',
      full_name: taxpayer.full_name || '',
      short_name: taxpayer.short_name || '',
      birth_date: taxpayer.birth_date || '',
      registration_address: taxpayer.registration_address || '',
      fact_address: taxpayer.fact_address || '',
      ogrn: taxpayer.ogrn || '',
      bank_detals: taxpayer.bank_detals || '',
      executive_list: taxpayer.executive_list || '',
      tax_regime_id: taxpayer.tax_regime_id || '',
      payer_status_id: taxpayer.payer_status_id || ''
    });
  }, [taxpayer]);

  // Упрощенный обработчик клика по декларации
  const handleDeclarationClick = useCallback((declarationId) => {
    if (onDeclarationClick) {
      onDeclarationClick(declarationId);
    }
  }, [onDeclarationClick]);

  // Упрощенный обработчик клика по проверке
  const handleInspectionClick = useCallback((inspectionId) => {
    if (onInspectionClick) {
      onInspectionClick(inspectionId);
    }
  }, [onInspectionClick]);

  return (
    <div>
      {/* Заголовок и RiskScore */}
      <div className="row mb-4">
        <div className="col-md-8">
          <h4>{taxpayer.fio || taxpayer.full_name || taxpayer.short_name || 'Без названия'}</h4>
          <p className="text-muted mb-0">
            <strong>ИНН:</strong> {taxpayer.inn}
            {taxpayer.ogrn && (
              <> | <strong>ОГРН:</strong> {taxpayer.ogrn}</>
            )}
          </p>
        </div>
        <div className="col-md-4 text-end">
          <div className={`display-6 fw-bold text-${getRiskScoreColor(taxpayer.risk_score)}`}>
            {taxpayer.risk_score ?? '—'}
          </div>
          <div className={`badge bg-${getRiskScoreColor(taxpayer.risk_score)} fs-6`}>
            {getRiskScoreText(taxpayer.risk_score)}
          </div>
        </div>
      </div>

      {/* Навигация по вкладкам */}
      <nav className="mb-4">
        <div className="nav nav-tabs">
          <button
            className={`nav-link ${activeTab === 'main' ? 'active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Основная информация
          </button>
          <button
            className={`nav-link ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Документы
          </button>
          <button
            className={`nav-link ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            Контакты
          </button>
          <button
            className={`nav-link ${activeTab === 'objects' ? 'active' : ''}`}
            onClick={() => setActiveTab('objects')}
          >
            Объекты
          </button>
          <button
            className={`nav-link ${activeTab === 'declarations' ? 'active' : ''}`}
            onClick={() => setActiveTab('declarations')}
          >
            Декларации
          </button>
          <button
            className={`nav-link ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Заявления
          </button>
          <button
            className={`nav-link ${activeTab === 'inspections' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspections')}
          >
            Проверки
          </button>
          <button
            className={`nav-link ${activeTab === 'accruals' ? 'active' : ''}`}
            onClick={() => setActiveTab('accruals')}
          >
            Налоговые начисления
          </button>
        </div>
      </nav>

      {/* Содержимое вкладок */}
      <div className="tab-content">
        {/* Основная информация с возможностью редактирования */}
        {activeTab === 'main' && (
          <div>
            {canChangeStatus && !editingMainInfo && (
              <div className="mb-3">
                <button 
                  className="btn btn-primary"
                  onClick={() => setEditingMainInfo(true)}
                >
                  <i className="bi bi-pencil me-2"></i>
                  Редактировать основную информацию
                </button>
              </div>
            )}

            {editingMainInfo ? (
              <EditMainInfoForm
                data={editedMainInfo}
                onChange={handleMainInfoChange}
                onSave={handleSaveMainInfo}
                onCancel={handleCancelEdit}
                taxpayerType={taxpayer.payer_type_id}
                currentTaxpayer={taxpayer}
              />
            ) : (
              <MainInfoView taxpayer={taxpayer} />
            )}
          </div>
        )}
        
        {/* Документы с возможностью редактирования */}
        {activeTab === 'documents' && (
          <DocumentsSection
            documents={taxpayer.documents || []}
            taxpayerId={taxpayer.taxpayer_id}
            canEdit={canChangeStatus}
            onAddDocument={() => onDocumentClick(null)} 
            onEditDocument={onDocumentClick} 
            onDeleteDocument={onDeleteDocument} 
          />
        )}

        {/* Контакты с возможностью редактирования */}
        {activeTab === 'contacts' && (
          <ContactsSection
            contacts={taxpayer.contacts || []}
            taxpayerId={taxpayer.taxpayer_id}
            canEdit={canChangeStatus}
            onAddContact={() => onContactClick(null)} 
            onEditContact={onContactClick} 
            onDeleteContact={onDeleteContact} 
          />
        )}

        {/* Объекты с возможностью редактирования */}
        {activeTab === 'objects' && (
          <ObjectsSection
            objects={taxpayer.taxable_objects || []}
            taxpayerId={taxpayer.taxpayer_id}
            canEdit={canChangeStatus}
            onAddObject={() => onObjectClick(null)}
            onEditObject={onObjectClick}
            onDeleteObject={onDeleteObject} 
          />
        )}

        {/* Декларации */}
        {activeTab === 'declarations' && (
          <DeclarationsTab 
            declarations={taxpayer.declarations || []} 
            onDeclarationClick={handleDeclarationClick}
            canClickDeclaration={canClickDeclaration}
            canChangeStatus={canChangeStatus}
          />
        )}

        {/* Вкладка заявлений */}
        {activeTab === 'requests' && (
          <RequestsTab 
            requests={taxpayer.reduce_requests || []} 
            onRequestClick={onRequestClick}
            canClickRequest={canClickRequest}
            canChangeStatus={canChangeStatus}
          />
        )}

        {/* Проверки */}
        {activeTab === 'inspections' && (
          <InspectionsTab 
            inspections={taxpayer.inspections || []} 
            onInspectionClick={handleInspectionClick}
            canClickInspection={canClickInspection}
            isSeniorInspector={isSeniorInspector}
          />
        )}

        {/* Налоговые начисления */}
        {activeTab === 'accruals' && (
          <TaxAccrualsTab 
            accruals={taxpayer.accruals || []} 
            onAccrualClick={onAccrualClick} 
            canEdit={isSeniorInspector}
          />
        )}
      </div>
    </div>
  );
};

// Компоненты для вкладок Декларации, Заявления и Проверки
const DeclarationsTab = ({ declarations, onDeclarationClick, canClickDeclaration, canChangeStatus  }) => {
  if (declarations.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        <i className="bi bi-file-earmark-x display-4"></i>
        <p className="mt-2">Декларации не найдены</p>
      </div>
    );
  }

  const getDeclarationStatusColor = (statusId) => {
    if (statusId === 1) return 'secondary';  // черновик
    if (statusId === 2) return 'warning';    // подана
    if (statusId === 3) return 'success';    // принята
    if (statusId === 4) return 'danger';     // отклонена
    return 'secondary';
  };

  const getDeclarationStatusText = (statusId) => {
    const statusMap = {
      1: 'черновик',
      2: 'подана', 
      3: 'принята',
      4: 'отклонена'
    };
    return statusMap[statusId] || 'неизвестно';
  };

  return (
    <div className="table-responsive">
      <table className="table table-striped table-hover">
        <thead>
          <tr>
            <th>Тип налога</th>
            <th>Период</th>
            <th>Дата подачи</th>
            <th>Сумма налога</th>
            <th>Тип декларации</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {declarations.map(declaration => (
            <tr 
              key={declaration.declaration_id}
              onClick={() => canClickDeclaration(declaration) && onDeclarationClick(declaration.declaration_id)}
              style={{ cursor: canClickDeclaration(declaration) ? 'pointer' : 'default' }}
              className={canClickDeclaration(declaration) ? 'hover-row' : ''}
            >
              <td>{declaration.tax_type_name}</td>
              <td>{declaration.period_name}</td>
              <td>{formatDate(declaration.submission_date)}</td>
              <td>{formatCurrency(declaration.tax_amount)}</td>
              <td>
                <span className={`badge ${
                  declaration.declaration_type === '3-НДФЛ' ? 'bg-primary' : 'bg-info'
                }`}>
                  {declaration.declaration_type}
                </span>
              </td>
              <td>
                <span className={`badge bg-${getDeclarationStatusColor(declaration.declaration_status_id)}`}>
                  {getDeclarationStatusText(declaration.declaration_status_id)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canClickDeclaration(declarations[0]) && (
        <div className="text-muted small mt-2">
          <i className="bi bi-hand-index me-1"></i>
          Нажмите на декларацию для подробного просмотра{canChangeStatus && ' и изменения статуса'}
        </div>
      )}
    </div>
  );
};

const RequestsTab = ({ requests, onRequestClick, canClickRequest, canChangeStatus }) => {
  if (requests.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        <i className="bi bi-file-earmark-x display-4"></i>
        <p className="mt-2">Заявления не найдены</p>
      </div>
    );
  }

  const getRequestStatusColor = (statusId) => {
    if (statusId === undefined || statusId === null) {
      return 'secondary';
    }
    
    const id = typeof statusId === 'string' ? parseInt(statusId, 10) : statusId;
    
    switch (id) {
      case 1: return 'warning';  // на рассмотрении
      case 2: return 'success';  // одобрено
      case 3: return 'danger';   // отклонено
      default: 
        return 'secondary';
    }
  };

  return (
    <div className="row">
      {requests.map(request => (
        <div 
          key={request.request_id} 
          className="col-12 mb-3"
          onClick={() => canClickRequest(request) && onRequestClick(request.request_id)}
          style={{ cursor: canClickRequest(request) ? 'pointer' : 'default' }}
        >
          <div className={`card border ${canClickRequest(request) ? 'hover-shadow' : ''}`}>
            <div className="card-header bg-light">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Заявление #{request.request_id}</h6>
                <span className={`badge bg-${getRequestStatusColor(request.request_status_id)}`}>
                  {request.request_status_name || 'Неизвестный статус'}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-2">
                    <strong>Дата подачи:</strong> {formatDate(request.send_date)}
                  </div>
                  <div className="mb-2">
                    <strong>Основание для снижения:</strong> {request.reduce_base_name}
                  </div>
                  <div className="mb-2">
                    <strong>Тип снижения:</strong> {request.reduce_type_name}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-2">
                    <strong>Запрошенная сумма:</strong> {formatCurrency(request.requested_reduce_amount)}
                  </div>
                  {request.verdict_date && (
                    <div className="mb-2">
                      <strong>Дата решения:</strong> {formatDate(request.verdict_date)}
                    </div>
                  )}
                </div>
              </div>
              {request.full_description && (
                <div className="mt-3">
                  <strong>Описание:</strong>
                  <p className="mb-0">{request.full_description}</p>
                </div>
              )}
              {request.periods && request.periods.length > 0 && (
                <div className="mt-3">
                  <strong>Периоды:</strong>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {request.periods.map(period => (
                      <span key={period.period_id} className="badge bg-secondary">
                        {period.period_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {canClickRequest(request) && (
                <div className="mt-3">
                  <small className="text-muted">
                    <i className="bi bi-hand-index me-1"></i>
                    Нажмите для подробного просмотра{canChangeStatus && ' и изменения статуса'}
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const InspectionsTab = ({ inspections, onInspectionClick, canClickInspection, isSeniorInspector }) => {
  if (inspections.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        <i className="bi bi-clipboard-x display-4"></i>
        <p className="mt-2">Проверки не найдены</p>
      </div>
    );
  }

  const getInspectionTypeText = (typeId) => {
    const types = {
      1: 'Выездная',
      2: 'Камеральная',
      3: 'Документарная'
    };
    return types[typeId] || 'Неизвестно';
  };

  const getInspectionReasonText = (reasonId) => {
    const reasons = {
      1: 'Плановая проверка',
      2: 'Жалоба', 
      3: 'Анализ рисков'
    };
    return reasons[reasonId] || 'Неизвестно';
  };

  const getInspectionStatusText = (statusId) => {
    const statuses = {
      1: 'В процессе',
      2: 'Завершена',
      3: 'Отменена',
      4: "Запланирована"
    };
    return statuses[statusId] || 'Неизвестно';
  };

  const getInspectionStatusColor = (statusId) => {
    if (statusId === 1) return 'info';
    if (statusId === 2) return 'success';
    if (statusId === 3) return 'secondary';
    if (statusId === 4) return 'warning'
    return 'secondary';
  };

  const isFutureInspection = (inspectionDate) => {
    if (!inspectionDate) return false;
    const date = new Date(inspectionDate);
    const today = new Date();
    return date > today;
  };

  // Разделяем проверки на будущие и прошедшие
  const futureInspections = inspections.filter(inspection => 
    isFutureInspection(inspection.inspection_date) && inspection.inspection_type_status_id === 1
  );
  const pastInspections = inspections.filter(inspection => 
    !isFutureInspection(inspection.inspection_date) || inspection.inspection_type_status_id !== 1
  );

  return (
    <div>
      {/* Будущие проверки */}
      {futureInspections.length > 0 && (
        <div className="mb-5">
          <h5 className="text-warning mb-3">
            <i className="bi bi-clock-history me-2"></i>
            Предстоящие проверки ({futureInspections.length})
          </h5>
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Дата проверки</th>
                  <th>Тип проверки</th>
                  <th>Причина</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {futureInspections.map(inspection => (
                  <tr 
                    key={inspection.inspection_id}
                    onClick={() => canClickInspection(inspection) && onInspectionClick(inspection.inspection_id)}
                    style={{ cursor: canClickInspection(inspection) ? 'pointer' : 'default' }}
                    className={canClickInspection(inspection) ? 'hover-row' : ''}
                  >
                    <td>{formatDate(inspection.inspection_date)}</td>
                    <td>{getInspectionTypeText(inspection.inspection_type_id)}</td>
                    <td>{getInspectionReasonText(inspection.inspection_reason)}</td>
                    <td>
                      <span className={`badge bg-${getInspectionStatusColor(inspection.inspection_type_status_id)}`}>
                        {getInspectionStatusText(inspection.inspection_type_status_id)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Прошедшие проверки */}
      {pastInspections.length > 0 && (
        <div>
          <h5 className="text-muted mb-3">
            <i className="bi bi-check-circle me-2"></i>
            Завершенные проверки ({pastInspections.length})
          </h5>
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Дата проверки</th>
                  <th>Тип проверки</th>
                  <th>Причина</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {pastInspections.map(inspection => (
                  <tr 
                    key={inspection.inspection_id}
                    onClick={() => canClickInspection(inspection) && onInspectionClick(inspection.inspection_id)}
                    style={{ cursor: canClickInspection(inspection) ? 'pointer' : 'default' }}
                    className={canClickInspection(inspection) ? 'hover-row' : ''}
                  >
                    <td>{formatDate(inspection.inspection_date)}</td>
                    <td>{getInspectionTypeText(inspection.inspection_type_id)}</td>
                    <td>{getInspectionReasonText(inspection.inspection_reason)}</td>
                    <td>
                      <span className={`badge bg-${getInspectionStatusColor(inspection.inspection_type_status_id)}`}>
                        {getInspectionStatusText(inspection.inspection_type_status_id)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Информационное сообщение */}
      {canClickInspection(futureInspections[0]) && futureInspections.length > 0 && (
        <div className="text-muted small mt-2">
          <i className="bi bi-hand-index me-1"></i>
          Нажмите на проверку для подробного просмотра
          {isSeniorInspector && ' и редактирования'}
        </div>
      )}
    </div>
  );
};

export default TaxpayerDetailView;