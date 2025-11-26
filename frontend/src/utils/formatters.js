export const formatDate = (dateString) => {
  if (!dateString) return 'Не указано';
  try {
    return new Date(dateString).toLocaleDateString('ru-RU');
  } catch {
    return 'Не указано';
  }
};

export const getRiskScoreColor = (score) => {
  if (score === null || score === undefined) return 'secondary';
  if (score <= 30) return 'success';
  if (score <= 70) return 'warning';
  return 'danger';
};

export const getRiskScoreText = (score) => {
  if (score === null || score === undefined) return 'Нет данных';
  if (score <= 30) return 'Низкий риск';
  if (score <= 70) return 'Средний риск';
  return 'Высокий риск';
};

export const getRequestStatusColor = (statusId) => {
  const id = Number(statusId);
  if (id === 1) return 'warning';    // на рассмотрении - желтый
  if (id === 2) return 'success';    // одобрено - зеленый
  if (id === 3) return 'danger';     // отклонено - красный
  return 'secondary';
};

export const formatCurrency = (value) => {
  if (!value && value !== 0) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
};