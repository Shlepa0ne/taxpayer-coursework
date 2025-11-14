import axiosInstance from './axiosInstance';

// Функция для получения списка налогоплательщиков
export const getTaxpayers = async () => {
    const { data } = await axiosInstance.get('/taxpayers/');
    return data;
}

// Функция для вызова расчета RiskScore
export const calculateRiskScore = async (taxpayerId) => {
    const { data } = await axiosInstance.post('/calculate-risk-score/', {
        taxpayer_id: taxpayerId,
    });
    return data;
}