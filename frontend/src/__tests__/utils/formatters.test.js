// frontend/src/__tests__/utils/formatters.test.js
import { 
  formatCurrency, 
  formatDate, 
  getRiskScoreColor, 
  getRiskScoreText 
} from '../../utils/formatters';

describe('Formatters Utility', () => {
  const originalNumberFormat = global.Intl.NumberFormat;
  
  beforeEach(() => {
    // Мокаем Intl.NumberFormat
    const mockFormat = jest.fn().mockReturnValue('1 000 ₽');
    global.Intl.NumberFormat = jest.fn().mockImplementation(() => ({
      format: mockFormat
    }));
  });

  afterEach(() => {
    // Восстанавливаем оригинальный NumberFormat
    global.Intl.NumberFormat = originalNumberFormat;
  });

  test('formatCurrency should format numbers correctly', () => {
    const result = formatCurrency(1000);
    
    expect(result).toBe('1 000 ₽');
    
    // Проверяем, что Intl.NumberFormat был вызван с правильной локалью
    expect(global.Intl.NumberFormat).toHaveBeenCalled();
    
    // Используем expect.any для дополнительных параметров
    const firstCall = global.Intl.NumberFormat.mock.calls[0];
    expect(firstCall[0]).toBe('ru-RU');
    expect(firstCall[1].style).toBe('currency');
    expect(firstCall[1].currency).toBe('RUB');
  });

  test('formatCurrency should handle null and undefined', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
  });

  test('formatDate should format dates correctly', () => {
    const mockDate = '15.01.2024';
    const mockToLocaleDateString = jest.fn().mockReturnValue(mockDate);
    const originalToLocaleDateString = Date.prototype.toLocaleDateString;
    
    Date.prototype.toLocaleDateString = mockToLocaleDateString;
    
    const result = formatDate('2024-01-15');
    
    expect(result).toBe(mockDate);
    expect(mockToLocaleDateString).toHaveBeenCalledWith('ru-RU');
    
    // Восстанавливаем
    Date.prototype.toLocaleDateString = originalToLocaleDateString;
  });

  test('formatDate should handle null and undefined', () => {
    expect(formatDate(null)).toBe('Не указано');
    expect(formatDate(undefined)).toBe('Не указано');
  });

  test('getRiskScoreColor should return correct color for score', () => {
    expect(getRiskScoreColor(85)).toBe('danger');
    expect(getRiskScoreColor(60)).toBe('warning');
    expect(getRiskScoreColor(30)).toBe('success');
    expect(getRiskScoreColor(null)).toBe('secondary');
    expect(getRiskScoreColor(undefined)).toBe('secondary');
  });

  test('getRiskScoreText should return correct text for score', () => {
    expect(getRiskScoreText(85)).toBe('Высокий риск');
    expect(getRiskScoreText(60)).toBe('Средний риск');
    expect(getRiskScoreText(30)).toBe('Низкий риск');
    expect(getRiskScoreText(null)).toBe('Нет данных');
    expect(getRiskScoreText(undefined)).toBe('Нет данных');
  });
});