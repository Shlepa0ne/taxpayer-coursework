import axiosInstance from './axiosInstance';

// Функция для получения списка всех налогоплательщиков (для админ-панели).
export const getTaxpayers = async () => {
    const { data } = await axiosInstance.get('/taxpayers/');
    return data;
}

// Функция для вызова расчета RiskScore.
export const calculateRiskScore = async (taxpayerId) => {
    const { data } = await axiosInstance.post('/calculate-risk-score/', {
        taxpayer_id: taxpayerId,
    });
    return data;
}

// Получает список налоговых начислений для ТЕКУЩЕГО залогиненного пользователя.
// Токен авторизации подставляется автоматически перехватчиком в axiosInstance.
export const getMyAccruals = async () => {
    const { data } = await axiosInstance.get('/my-accruals/');
    return data;
}

// Отправляет данные формы для создания заявления на снижение налога.
// requestData - это объект с полями, определенными в TaxReduceRequestSerializer.
export const createTaxReduceRequest = async (requestData) => {
    const { data } = await axiosInstance.post('/tax-reduce-requests/', requestData);
    return data;
}

// Получает с сервера список всех возможных оснований для снижения налога.
export const getReduceBases = async () => {
    const { data } = await axiosInstance.get('/reduce-bases/');
    return data;
}