// frontend/src/api/workersApi.js
import axiosInstance from './axiosInstance';

// Получить данные текущего сотрудника
export const getCurrentWorker = async () => {
  const { data } = await axiosInstance.get('/worker/current/');
  return data;
};

// Получить средний RiskScore всех налогоплательщиков
export const getAverageRiskScore = async () => {
  const { data } = await axiosInstance.get('/worker/average-risk-score/');
  return data;
};

// Получить количество заявлений для рассмотрения
export const getPendingRequestsCount = async () => {
  const { data } = await axiosInstance.get('/worker/pending-requests-count/');
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

// Поиск налогоплательщика
export const searchTaxpayers = async (searchParams) => {
  const { data } = await axiosInstance.get('/worker/taxpayer-search/', { params: searchParams });
  return data;
};

// Получить список заявлений для рассмотрения
export const getRequestsForReview = async () => {
  const { data } = await axiosInstance.get('/worker/requests-for-review/');
  return data;
};

// Обновить статус заявления
export const updateRequestStatus = async (requestId, statusData) => {
  const { data } = await axiosInstance.patch(`/worker/requests/${requestId}/`, statusData);
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