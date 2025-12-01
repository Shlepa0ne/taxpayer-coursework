export const mockTaxpayer = {
  taxpayer_id: 1,
  inn: '123456789012',
  fio: 'Иванов Иван Иванович',
  risk_score: 45,
  registration_address: 'г. Москва, ул. Примерная, д. 1',
  tax_regime_name: 'УСН'
};

export const mockDeclaration = {
  declaration_id: 1,
  declaration_type: '3-НДФЛ',
  tax_type_name: 'НДФЛ',
  tax_amount: 15000,
  submission_date: '2024-01-15',
  declaration_status_id: 2
};

export const mockWorker = {
  tax_officer_id: 1,
  tax_officer_name: 'Петрова Мария Сергеевна',
  role_id: 2,
  unit: 'Отдел камеральных проверок'
};