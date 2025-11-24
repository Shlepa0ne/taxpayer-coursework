// frontend/src/api/taxpayersApi.js
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

// Получаем данные текущего налогоплательщика
export const getCurrentTaxpayer = async () => {
    const { data } = await axiosInstance.get('/current-taxpayer/');
    return data;
}

// Получаем последний RiskScore для текущего пользователя
export const getLatestRiskScore = async () => {
    const { data } = await axiosInstance.get('/latest-risk-score/');
    return data;
}

export const getProfile = async () => {
    try {
        const { data } = await axiosInstance.get('/profile/');
        return data;
    } catch (error) {
        console.error('API Error:', error.response?.data);
        throw error;
    }
}

export const changePassword = async (passwordData) => {
    try {
        const { data } = await axiosInstance.post('/change-password/', passwordData);
        return data;
    } catch (error) {
        if (error.response && error.response.data) {
            throw new Error(error.response.data.error || 'Ошибка при смене пароля');
        }
        throw new Error('Ошибка сети');
    }
}

// Получить список заявлений пользователя
export const getMyRequests = async () => {
    const { data } = await axiosInstance.get('/my-requests/');
    return data;
}

// Получить налогооблагаемые объекты пользователя
export const getMyTaxableObjects = async () => {
    const { data } = await axiosInstance.get('/my-taxable-objects/');
    return data;
}

// Получить начисления с информацией об оплате
export const getMyAccrualsWithPayments = async () => {
    const { data } = await axiosInstance.get('/my-accruals-with-payments/');
    return data;
}

// Создать платеж
export const createTaxPayment = async (paymentData) => {
    const { data } = await axiosInstance.post('/create-tax-payment/', paymentData);
    return data;
}

// Получить список всех деклараций пользователя
export const getMyDeclarations = async () => {
  const { data } = await axiosInstance.get('/my-declarations/');
  return data;
};

// Создать новую декларацию
export const createDeclaration = async (declarationData) => {
  const { data } = await axiosInstance.post('/declarations/', {
    declaration_type: declarationData.declaration_type,
    target_inn: declarationData.target_inn || '',
    tax_type_id: declarationData.tax_type_id,
    tax_amount: declarationData.tax_amount,
    total_income: declarationData.total_income,
    period_start: declarationData.period_start,
    period_end: declarationData.period_end
  });
  return data;
};

// Получить типы налогов для деклараций
export const getTaxTypes = async () => {
  const { data } = await axiosInstance.get('/tax-types/');
  return data;
};

export const getPeriods = async () => {
  const { data } = await axiosInstance.get('/periods/');
  return data;
};