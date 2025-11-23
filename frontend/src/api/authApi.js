// frontend/src/api/authApi.js
import axiosInstance from './axiosInstance';

export async function login(inn, password) {
  const res = await axiosInstance.post('/auth/login/', { inn, password });
  const data = res.data;
  if (data?.access) {
    localStorage.setItem('authTokens', JSON.stringify(data));
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${data.access}`;
    
    // Триггерим событие для обновления контекста
    window.dispatchEvent(new Event('storage'));
  }
  return data;
}

export async function loginWorker({ inn, password }) {
  const response = await axiosInstance.post('/auth/login-workers/', { inn, password });
  const data = response.data;

  const tokens = {
    access: data.access,
    refresh: data.refresh,
    role: data.role
  };

  localStorage.setItem("authTokens", JSON.stringify(tokens));
  axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${data.access}`;
  
  // Триггерим событие для обновления контекста
  window.dispatchEvent(new Event('storage'));

  return data;
}

/**
 * Опциональная функция logout.
 * Если у вас есть endpoint для аннулирования refresh токена - добавьте путь на бэке и замените URL.
 * Аргументы: refreshToken (строка) - можно передать null/undefined.
 */
export async function logout(refreshToken) {
  try {
    if (refreshToken) {
      // Если на бэке есть endpoint для logout/revoke, раскомментируйте и поправьте URL.
      // await axiosInstance.post('/api/auth/logout/', { refresh: refreshToken });
      // Пока просто пытаемся безопасно уведомить сервер (если нужно).
    }
  } catch (err) {
    // игнорируем ошибки при попытке logout на сервере
    console.warn('Server logout failed:', err);
  } finally {
    // локальная очистка
    localStorage.removeItem('authTokens');
    delete axiosInstance.defaults.headers.common['Authorization'];
  }
}

/**
 * Вспомогательные экспорты — если где-то используются другие функции (необязательно)
 */
export async function loginTaxpayer({ inn, password }) {
  return login(inn, password);
}