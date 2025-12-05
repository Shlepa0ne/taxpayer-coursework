-- 1. Роли сотрудников
INSERT INTO role (role_id, role_name) VALUES (1, 'Инспектор') ON CONFLICT DO NOTHING;
INSERT INTO role (role_id, role_name) VALUES (2, 'Старший инспектор') ON CONFLICT DO NOTHING;
INSERT INTO role (role_id, role_name) VALUES (3, 'Руководитель') ON CONFLICT DO NOTHING;

-- 2. Статусы заявлений
INSERT INTO report_status (report_status_id, report_status_name) VALUES (1, 'на рассмотрении') ON CONFLICT DO NOTHING;
INSERT INTO report_status (report_status_id, report_status_name) VALUES (2, 'одобрено') ON CONFLICT DO NOTHING;
INSERT INTO report_status (report_status_id, report_status_name) VALUES (3, 'отклонено') ON CONFLICT DO NOTHING;

-- 3. Типы снижения налога
INSERT INTO reduce_type (reduce_type_id, reduce_type_name) VALUES (1, 'Полное освобождение') ON CONFLICT DO NOTHING;
INSERT INTO reduce_type (reduce_type_id, reduce_type_name) VALUES (2, 'Частичное снижение') ON CONFLICT DO NOTHING;

-- 4. Основания для снижения (примеры)
INSERT INTO reduce_base (reduce_base_id, reduce_base_name) VALUES (3, 'Социальный вычет') ON CONFLICT DO NOTHING;
INSERT INTO reduce_base (reduce_base_id, reduce_base_name) VALUES (4, 'Имущественный вычет') ON CONFLICT DO NOTHING;

-- 5. Сотрудник по умолчанию (КРИТИЧНО ВАЖНО для создания заявлений)
INSERT INTO tax_officer (tax_officer_id, tax_officer_name, unit, role_id) 
VALUES (1, 'Автоматический регистратор', 'Система', 1) 
ON CONFLICT DO NOTHING;

-- 6. Тестовый налогоплательщик
-- ВАЖНО: Если в твоей базе ИНН отличается от 123456789012, поправь эту строку!
INSERT INTO taxpayer (inn, full_name, short_name) 
VALUES ('123456789012', 'Тестовый Пользователь', 'Тест') 
ON CONFLICT DO NOTHING;