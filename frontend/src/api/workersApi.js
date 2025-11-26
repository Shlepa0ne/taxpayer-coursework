// frontend/src/api/workersApi.js
import axiosInstance from './axiosInstance';


// Получить средний RiskScore всех налогоплательщиков
export const getAverageRiskScore = async () => {
  const { data } = await axiosInstance.get('/worker/average-risk-score/');
  return data;
};

// Получить количество деклараций
export const getDeclarationsCount = async () => {
  const { data } = await axiosInstance.get('/worker/declarations-count/');
  return data;
};

// Получить количество предстоящих проверок
export const getUpcomingInspectionsCount = async () => {
  const { data } = await axiosInstance.get('/worker/upcoming-inspections-count/');
  return data;
};


// Создать нового сотрудника
export const createWorker = async (workerData) => {
  const { data } = await axiosInstance.post('/worker/create-worker/', workerData);
  return data;
};

// Создать нового налогоплательщика
export const createTaxpayer = async (taxpayerData) => {
  const { data } = await axiosInstance.post('/worker/create-taxpayer/', taxpayerData);
  return data;
};

// Поиск налогоплательщиков
export const searchTaxpayers = async (searchParams) => {
  const { data } = await axiosInstance.get('/worker/taxpayer-search/', { params: searchParams });
  return data;
};

// Получить детальную информацию о налогоплательщике
export const getTaxpayerDetail = async (taxpayerId) => {
  const { data } = await axiosInstance.get(`/worker/taxpayer/${taxpayerId}/`);
  return data;
};

// Получить список регионов
export const getRegions = async () => {
  const { data } = await axiosInstance.get('/worker/regions/');
  return data;
};

// Получить список заявлений для рассмотрения
export const getRequestsForReview = async () => {
  const { data } = await axiosInstance.get('/worker/requests-for-review/');
  return data;
};

// Получить детальную информацию о заявлении
export const getRequestDetail = async (requestId) => {
  const { data } = await axiosInstance.get(`/worker/requests/${requestId}/`);
  return data;
};

// Обновить статус заявления
export const updateRequestStatus = async (requestId, statusData) => {
  const { data } = await axiosInstance.patch(`/worker/requests/${requestId}/update/`, statusData);
  return data;
};

// Получить количество заявлений для рассмотрения
export const getPendingRequestsCount = async () => {
  const { data } = await axiosInstance.get('/worker/pending-requests-count/');
  return data;
};

// Получение информации о текущем сотруднике
export const getCurrentWorker = async () => {
  const { data } = await axiosInstance.get('/worker/current/');
  return data;
};

// Основная информация налогоплательщика
export const updateTaxpayerInfo = async (taxpayerId, data) => {
  console.log('API: Updating taxpayer', taxpayerId, 'with data:', data);
  try {
    const { data: response } = await axiosInstance.patch(`/worker/taxpayer/${taxpayerId}/update/`, data);
    console.log('API: Update successful', response);
    return response;
  } catch (error) {
    console.error('API: Update failed', error);
    throw error;
  }
};

// Документы
export const getDocumentTypes = async () => {
  const { data } = await axiosInstance.get('/worker/document-types/');
  return data;
};

export const createDocument = async (taxpayerId, documentData) => {
  const { data } = await axiosInstance.post(`/worker/taxpayer/${taxpayerId}/documents/`, documentData);
  return data;
};

export const updateDocument = async (documentId, documentData) => {
  const { data } = await axiosInstance.patch(`/worker/documents/${documentId}/`, documentData);
  return data;
};

export const deleteDocument = async (documentId) => {
  const { data } = await axiosInstance.delete(`/worker/documents/${documentId}/`);
  return data;
};

// Контакты
export const getContactTypes = async () => {
  const { data } = await axiosInstance.get('/worker/contact-types/');
  return data;
};

export const createContact = async (taxpayerId, contactData) => {
  const { data } = await axiosInstance.post(`/worker/taxpayer/${taxpayerId}/contacts/`, contactData);
  return data;
};

export const updateContact = async (contactId, contactData) => {
  const { data } = await axiosInstance.patch(`/worker/contacts/${contactId}/`, contactData);
  return data;
};

export const deleteContact = async (contactId) => {
  const { data } = await axiosInstance.delete(`/worker/contacts/${contactId}/`);
  return data;
};

// Объекты
export const getObjectTypes = async () => {
  const { data } = await axiosInstance.get('/worker/object-types/');
  return data;
};

export const createTaxableObject = async (taxpayerId, objectData) => {
  const { data } = await axiosInstance.post(`/worker/taxpayer/${taxpayerId}/objects/`, objectData);
  return data;
};

export const updateTaxableObject = async (objectId, objectData) => {
  const { data } = await axiosInstance.patch(`/worker/objects/${objectId}/`, objectData);
  return data;
};

export const deleteTaxableObject = async (objectId) => {
  const { data } = await axiosInstance.delete(`/worker/objects/${objectId}/`);
  return data;
};

// Получить список налоговых режимов
export const getTaxRegimes = async () => {
  const { data } = await axiosInstance.get('/worker/tax-regimes/');
  return data;
};

// Получить список статусов плательщика
export const getPayerStatuses = async () => {
  const { data } = await axiosInstance.get('/worker/payer-statuses/');
  return data;
};

export const getInspectionViolations = async (inspectionId) => {
  const { data } = await axiosInstance.get(`/worker/inspections/${inspectionId}/violations/`);
  return data;
};

export const updateInspectionViolation = async (violationId, violationData) => {
  const { data } = await axiosInstance.patch(`/worker/violations/${violationId}/`, violationData);
  return data;
};

// Декларации
export const getDeclarationsForReview = async () => {
  const { data } = await axiosInstance.get('/worker/declarations-for-review/');
  return data;
};

export const getDeclarationDetail = async (declarationId) => {
  const { data } = await axiosInstance.get(`/worker/declarations/${declarationId}/`);
  return data;
};

export const updateDeclarationStatus = async (declarationId, statusData) => {
  console.log('API: updateDeclarationStatus called with:', declarationId, statusData);
  try {
    const { data } = await axiosInstance.patch(`/worker/declarations/${declarationId}/update/`, statusData);
    console.log('API: updateDeclarationStatus response:', data);
    return data;
  } catch (error) {
    console.error('API: updateDeclarationStatus error:', error);
    throw error;
  }
};

// Проверки
export const getWorkerInspections = async () => {
  const { data } = await axiosInstance.get('/worker/inspections/');
  return data;
};

export const getInspectionDetail = async (inspectionId) => {
  const { data } = await axiosInstance.get(`/worker/inspections/${inspectionId}/`);
  return data;
};

export const createInspection = async (inspectionData) => {
  const { data } = await axiosInstance.post('/worker/inspections/create/', inspectionData);
  return data;
};

export const updateInspection = async (inspectionId, inspectionData) => {
  const { data } = await axiosInstance.patch(`/worker/inspections/${inspectionId}/update/`, inspectionData);
  return data;
};

// Получить список сотрудников для выбора участников проверки
export const getAvailableOfficers = async () => {
  const { data } = await axiosInstance.get('/worker/available-officers/');
  return data;
};