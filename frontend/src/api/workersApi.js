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

// Получить список деклараций для проверки
export const getDeclarationsForReview = async () => {
  const { data } = await axiosInstance.get('/worker/declarations-for-review/');
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