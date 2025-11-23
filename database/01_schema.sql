--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2025-11-23 19:50:16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 5550 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 340 (class 1255 OID 16711)
-- Name: calculate_inn_10_checksum(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_inn_10_checksum(p_inn_base character varying) RETURNS integer
    LANGUAGE plpgsql
    AS $$ 
DECLARE 
    v_weights INTEGER[] := ARRAY[2, 4, 10, 3, 5, 9, 4, 6, 8]; 
    v_sum INTEGER := 0; 
    i INTEGER; 
BEGIN 
    FOR i IN 1..9 LOOP 
        v_sum := v_sum + substring(p_inn_base FROM i FOR 1)::INTEGER * 
v_weights[i]; 
    END LOOP; 
     
    RETURN (v_sum % 11) % 10; 
END; 
$$;


ALTER FUNCTION public.calculate_inn_10_checksum(p_inn_base character varying) OWNER TO postgres;

--
-- TOC entry 341 (class 1255 OID 16712)
-- Name: calculate_inn_12_checksums(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_inn_12_checksums(p_inn_base character varying) RETURNS TABLE(checksum1 integer, checksum2 integer)
    LANGUAGE plpgsql
    AS $$ 
DECLARE 
    v_weights1 INTEGER[] := ARRAY[7, 2, 4, 10, 3, 5, 9, 4, 6, 8]; 
    v_weights2 INTEGER[] := ARRAY[3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]; 
    v_sum1 INTEGER := 0; 
    v_sum2 INTEGER := 0; 
    i INTEGER; 
    v_inn_with_first VARCHAR(11); 
BEGIN 
    -- Первая контрольная цифра (11-я позиция) 
    FOR i IN 1..10 LOOP 
        v_sum1 := v_sum1 + substring(p_inn_base FROM i FOR 1)::INTEGER 
* v_weights1[i]; 
    END LOOP; 
     
    -- Вторая контрольная цифра (12-я позиция) 
    v_inn_with_first := p_inn_base || ((v_sum1 % 11) % 10)::TEXT; 
     
    FOR i IN 1..11 LOOP 
v_sum2 := v_sum2 + substring(v_inn_with_first FROM i FOR 
1)::INTEGER * v_weights2[i]; 
END LOOP; 
checksum1 := (v_sum1 % 11) % 10; 
checksum2 := (v_sum2 % 11) % 10; 
RETURN NEXT; 
END; 
$$;


ALTER FUNCTION public.calculate_inn_12_checksums(p_inn_base character varying) OWNER TO postgres;

--
-- TOC entry 343 (class 1255 OID 16713)
-- Name: calculate_ownership_months(date, date, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_ownership_months(p_start_date date, p_end_date date, p_year integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_start_month INTEGER;
    v_end_month INTEGER;
    v_year_start DATE := TO_DATE(p_year || '-01-01', 'YYYY-MM-DD');
    v_year_end DATE := TO_DATE(p_year || '-12-31', 'YYYY-MM-DD');
BEGIN
    -- Определяем начальный месяц владения в указанном году
    IF p_start_date < v_year_start THEN
        v_start_month := 1;
    ELSE
        v_start_month := EXTRACT(MONTH FROM p_start_date);
    END IF;
    
    -- Определяем конечный месяц владения в указанном году
    IF p_end_date IS NULL OR p_end_date > v_year_end THEN
        v_end_month := 12;
    ELSE
        v_end_month := EXTRACT(MONTH FROM p_end_date);
    END IF;
    
    RETURN GREATEST(0, v_end_month - v_start_month + 1);
END;
$$;


ALTER FUNCTION public.calculate_ownership_months(p_start_date date, p_end_date date, p_year integer) OWNER TO postgres;

--
-- TOC entry 359 (class 1255 OID 16714)
-- Name: calculate_penalties(integer, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_penalties(p_tax_accrual_id integer, p_refinance_rate numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_accrual_record RECORD;
    v_days_late INTEGER;
    v_penalty_rate NUMERIC(10,8); -- 1/300 от ставки рефинансирования
    v_penalty_amount NUMERIC(20,2);
    v_unpaid_amount NUMERIC(20,2);
BEGIN
    -- Проверяем корректность ставки рефинансирования
    IF p_refinance_rate IS NULL OR p_refinance_rate <= 0 OR p_refinance_rate > 1 THEN
        RAISE EXCEPTION 'Некорректная ставка рефинансирования!';
    END IF;

    -- Рассчитываем дневную ставку пени (1/300 от ставки рефинансирования)
    v_penalty_rate := p_refinance_rate / 300;

    -- Получаем данные начисления
    SELECT 
        ta.accrual_amount,
        COALESCE(ta.percent_amount, 0) as percent_amount,
        ta.due_date,
        COALESCE(SUM(tp.payment_amount), 0) as total_paid
    INTO v_accrual_record
    FROM tax_accrual ta
    LEFT JOIN tax_payment tp ON ta.tax_accrual_id = tp.tax_income_id
    WHERE ta.tax_accrual_id = p_tax_accrual_id
    GROUP BY ta.tax_accrual_id, ta.accrual_amount, ta.percent_amount, ta.due_date;

    -- Если начисление не найдено
    IF v_accrual_record.accrual_amount IS NULL THEN
        RETURN 0;
    END IF;

    -- Если срок уплаты не наступил или не указан
    IF v_accrual_record.due_date IS NULL OR CURRENT_DATE <= v_accrual_record.due_date THEN
        RETURN 0;
    END IF;

    -- Рассчитываем дни просрочки (только рабочие дни)
    v_days_late := CURRENT_DATE - v_accrual_record.due_date;

    -- Неоплаченная сумма (основной долг + уже начисленные пени)
    v_unpaid_amount := (v_accrual_record.accrual_amount + v_accrual_record.percent_amount) - v_accrual_record.total_paid;

    -- Если оплата полная, пеней нет
    IF v_unpaid_amount <= 0 THEN
        RETURN 0;
    END IF;

    -- Расчет пеней по формуле: недоимка * (ставка рефинансирования / 300) * количество дней просрочки
    v_penalty_amount := v_unpaid_amount * v_penalty_rate * v_days_late;

    -- Округляем до копеек (2 знака после запятой)
    RETURN ROUND(GREATEST(0, v_penalty_amount), 2);
END;
$$;


ALTER FUNCTION public.calculate_penalties(p_tax_accrual_id integer, p_refinance_rate numeric) OWNER TO postgres;

--
-- TOC entry 360 (class 1255 OID 16715)
-- Name: calculate_real_estate_tax(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_real_estate_tax(p_taxpayer_id integer, p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_tax NUMERIC(20,2) := 0;
    v_real_estate_record RECORD;
    v_tax_rate NUMERIC(10,4);
    v_tax_amount NUMERIC(20,2);
    v_period_id INTEGER;
    v_property_tax_type_id INTEGER;
BEGIN
    -- Получаем ID типа налога на имущество
    SELECT tax_type_id INTO v_property_tax_type_id 
    FROM tax_type WHERE tax_type_name = 'на имущество';
    
    -- Находим или создаём налоговый период
    SELECT period_id INTO v_period_id
    FROM tax_period
    WHERE EXTRACT(YEAR FROM start_date) = p_year
      AND EXTRACT(YEAR FROM end_date) = p_year;
    
    IF v_period_id IS NULL THEN
        INSERT INTO tax_period (start_date, end_date, period_type_id)
        VALUES (
            TO_DATE(p_year || '-01-01', 'YYYY-MM-DD'),
            TO_DATE(p_year || '-12-31', 'YYYY-MM-DD'),
            (SELECT type_period_id FROM period_type WHERE name = 'годовой')
        )
        RETURNING period_id INTO v_period_id;
    END IF;

    FOR v_real_estate_record IN 
        SELECT 
            tobj.object_id,
            tobj.object_name,
            tobj.cadastral_value,
            tobj.object_address,
            ret.real_estate_type_name,
            oo.ownership_start_date,
            oo.ownership_end_date,
            oo.ownership_id
        FROM object_ownership oo
        JOIN taxable_object tobj ON oo.object_id = tobj.object_id
        JOIN object_type ot ON tobj.object_type_id = ot.object_type_id
        JOIN real_estate_type ret ON tobj.real_estate_type_id = ret.real_estate_type_id
        WHERE oo.taxpayer_id = p_taxpayer_id
          AND ot.object_type_name = 'недвижимость'
          AND (EXTRACT(YEAR FROM oo.ownership_start_date) <= p_year 
               AND (oo.ownership_end_date IS NULL 
                    OR EXTRACT(YEAR FROM oo.ownership_end_date) >= p_year))
    LOOP
        -- Определяем ставку налога в зависимости от типа недвижимости
        CASE v_real_estate_record.real_estate_type_name
            WHEN 'квартира' THEN v_tax_rate := 0.1;
            WHEN 'жилой дом' THEN v_tax_rate := 0.1;
            WHEN 'гараж' THEN v_tax_rate := 0.1;
            WHEN 'коммерческая' THEN v_tax_rate := 2.0;
            ELSE v_tax_rate := 0.5;
        END CASE;
        
        -- Рассчитываем налог для конкретного объекта недвижимости
        v_tax_amount := ROUND(
            v_real_estate_record.cadastral_value * v_tax_rate / 100 * 
            calculate_ownership_months(
                v_real_estate_record.ownership_start_date, 
                v_real_estate_record.ownership_end_date, 
                p_year
            ) / 12, 
        2);
        
        -- Создаем отдельное налоговое начисление для каждого объекта недвижимости, если его еще нет
        IF v_tax_amount > 0 AND NOT EXISTS (
            SELECT 1 
            FROM tax_accrual 
            WHERE taxpayer_id = p_taxpayer_id 
              AND object_id = v_real_estate_record.object_id
              AND tax_type_id = v_property_tax_type_id
              AND EXTRACT(YEAR FROM accrual_date) = p_year
        ) THEN
            INSERT INTO tax_accrual (
                accrual_date, 
                accrual_amount, 
                due_date, 
                tax_type_id, 
                taxpayer_id, 
                object_id,
                ownership_id,
				income_status_id
            ) VALUES (
                CURRENT_DATE, 
                v_tax_amount, 
                TO_DATE((p_year + 1) || '-12-01', 'YYYY-MM-DD'),
                v_property_tax_type_id,
                p_taxpayer_id, 
                v_real_estate_record.object_id,
                v_real_estate_record.ownership_id,
				1
            );
            
            v_total_tax := v_total_tax + v_tax_amount;
        ELSIF v_tax_amount > 0 THEN
            -- Если начисление уже существует, обновляем сумму
            UPDATE tax_accrual 
            SET accrual_amount = v_tax_amount
            WHERE taxpayer_id = p_taxpayer_id 
              AND object_id = v_real_estate_record.object_id
              AND tax_type_id = v_property_tax_type_id
              AND EXTRACT(YEAR FROM accrual_date) = p_year;
            
            v_total_tax := v_total_tax + v_tax_amount;
        END IF;
    END LOOP;
    
    RETURN v_total_tax;
END;
$$;


ALTER FUNCTION public.calculate_real_estate_tax(p_taxpayer_id integer, p_year integer) OWNER TO postgres;

--
-- TOC entry 361 (class 1255 OID 16717)
-- Name: calculate_risk_score(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_risk_score(p_taxpayer_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$ 
DECLARE 
    v_total_debt NUMERIC(20,2) := 0; 
    v_oldest_debt_days INTEGER := 0; 
    v_violations_count INTEGER := 0; 
    v_score INTEGER := 0; 
BEGIN 
    -- 1. Сумма неоплаченных налоговых начислений (с обработкой NULL)
    SELECT COALESCE(SUM(ta.accrual_amount + COALESCE(ta.percent_amount, 0) - COALESCE(tp.total_paid, 0)), 0)
    INTO v_total_debt
    FROM tax_accrual ta
    LEFT JOIN (
        SELECT tax_income_id, SUM(payment_amount) as total_paid
        FROM tax_payment
        GROUP BY tax_income_id
    ) tp ON ta.tax_accrual_id = tp.tax_income_id
    WHERE ta.taxpayer_id = p_taxpayer_id
    AND (ta.accrual_amount + COALESCE(ta.percent_amount, 0)) > COALESCE(tp.total_paid, 0);

    -- 2. Самая старая просрочка по начислениям (в днях)
    SELECT COALESCE(MAX(EXTRACT(DAYS FROM CURRENT_DATE - ta.accrual_date)), 0)
    INTO v_oldest_debt_days
    FROM tax_accrual ta
    LEFT JOIN (
        SELECT tax_income_id, SUM(payment_amount) as total_paid
        FROM tax_payment
        GROUP BY tax_income_id
    ) tp ON ta.tax_accrual_id = tp.tax_income_id
    WHERE ta.taxpayer_id = p_taxpayer_id
    AND (ta.accrual_amount + COALESCE(ta.percent_amount, 0)) > COALESCE(tp.total_paid, 0);

    -- 3. Количество нарушений за последние 3 года
    SELECT COUNT(*)
    INTO v_violations_count
    FROM identified_violation iv
    JOIN inspection i ON iv.inspection_id = i.inspection_id
    WHERE i.taxpayer_id = p_taxpayer_id
    AND i.inspection_date > CURRENT_DATE - INTERVAL '3 years';
 
    -- Расчет баллов по сумме задолженности (0-50) 
    IF v_total_debt = 0 THEN 
        v_score := v_score + 0; 
    ELSIF v_total_debt <= 50000 THEN 
        v_score := v_score + 10; 
    ELSIF v_total_debt <= 100000 THEN 
        v_score := v_score + 20; 
    ELSIF v_total_debt <= 500000 THEN 
        v_score := v_score + 30; 
    ELSIF v_total_debt <= 1000000 THEN 
        v_score := v_score + 40; 
    ELSE 
        v_score := v_score + 50; 
    END IF; 
 
    -- Расчет баллов по длительности просрочки (0-30) 
    IF v_oldest_debt_days = 0 THEN 
        v_score := v_score + 0; 
    ELSIF v_oldest_debt_days <= 30 THEN 
        v_score := v_score + 5; 
    ELSIF v_oldest_debt_days <= 90 THEN 
        v_score := v_score + 10; 
    ELSIF v_oldest_debt_days <= 180 THEN 
        v_score := v_score + 15; 
    ELSIF v_oldest_debt_days <= 365 THEN 
        v_score := v_score + 20; 
    ELSE 
        v_score := v_score + 30; 
    END IF; 
 
    -- Расчет баллов по количеству нарушений (0-20) 
    IF v_violations_count = 0 THEN 
        v_score := v_score + 0; 
    ELSIF v_violations_count = 1 THEN 
        v_score := v_score + 5; 
    ELSIF v_violations_count = 2 THEN 
        v_score := v_score + 10; 
    ELSIF v_violations_count = 3 THEN 
        v_score := v_score + 15; 
    ELSE 
        v_score := v_score + 20; 
    END IF; 
 
    -- Ограничиваем 100 баллами 
    RETURN LEAST(100, v_score); 
END; 
$$;


ALTER FUNCTION public.calculate_risk_score(p_taxpayer_id integer) OWNER TO postgres;

--
-- TOC entry 362 (class 1255 OID 16718)
-- Name: calculate_transport_tax(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_transport_tax(p_taxpayer_id integer, p_year integer DEFAULT EXTRACT(year FROM CURRENT_DATE)) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_tax NUMERIC(20,2) := 0;
    v_transport_record RECORD;
    v_tax_rate NUMERIC(10,2);
    v_tax_amount NUMERIC(20,2);
    v_period_id INTEGER;
    v_transport_tax_type_id INTEGER;
BEGIN
    -- Получаем ID типа транспортного налога
    SELECT tax_type_id INTO v_transport_tax_type_id 
    FROM tax_type WHERE tax_type_name = 'транспортный';
    
    -- Находим или создаём налоговый период
    SELECT period_id INTO v_period_id
    FROM tax_period
    WHERE EXTRACT(YEAR FROM start_date) = p_year
      AND EXTRACT(YEAR FROM end_date) = p_year;
    
    IF v_period_id IS NULL THEN
        INSERT INTO tax_period (start_date, end_date, period_type_id)
        VALUES (
            TO_DATE(p_year || '-01-01', 'YYYY-MM-DD'),
            TO_DATE(p_year || '-12-31', 'YYYY-MM-DD'),
            (SELECT type_period_id FROM period_type WHERE name = 'годовой')
        )
        RETURNING period_id INTO v_period_id;
    END IF;

    FOR v_transport_record IN 
        SELECT 
            tobj.object_id,
            tobj.transport_model,
            tobj.registration_plate,
            tobj.extra_value as engine_power,
            oo.ownership_start_date,
            oo.ownership_end_date,
            oo.ownership_id
        FROM object_ownership oo
        JOIN taxable_object tobj ON oo.object_id = tobj.object_id
        JOIN object_type ot ON tobj.object_type_id = ot.object_type_id
        WHERE oo.taxpayer_id = p_taxpayer_id
          AND ot.object_type_name = 'транспорт'
          AND (EXTRACT(YEAR FROM oo.ownership_start_date) <= p_year 
               AND (oo.ownership_end_date IS NULL 
                    OR EXTRACT(YEAR FROM oo.ownership_end_date) >= p_year))
    LOOP
        -- Определяем ставку налога в зависимости от мощности двигателя
        IF v_transport_record.engine_power <= 100 THEN
            v_tax_rate := 2.5;
        ELSIF v_transport_record.engine_power <= 150 THEN
            v_tax_rate := 3.5;
        ELSIF v_transport_record.engine_power <= 200 THEN
            v_tax_rate := 5.0;
        ELSIF v_transport_record.engine_power <= 250 THEN
            v_tax_rate := 7.5;
        ELSE
            v_tax_rate := 15.0;
        END IF;
        
        -- Рассчитываем налог для конкретного ТС
        v_tax_amount := ROUND(
            v_transport_record.engine_power * v_tax_rate * 
            calculate_ownership_months(
                v_transport_record.ownership_start_date, 
                v_transport_record.ownership_end_date, 
                p_year
            ) / 12, 
        2);
        
        -- Создаем отдельное налоговое начисление для каждого ТС, если его еще нет
        IF v_tax_amount > 0 AND NOT EXISTS (
            SELECT 1 
            FROM tax_accrual 
            WHERE taxpayer_id = p_taxpayer_id 
              AND object_id = v_transport_record.object_id
              AND tax_type_id = v_transport_tax_type_id
              AND EXTRACT(YEAR FROM accrual_date) = p_year
        ) THEN
            INSERT INTO tax_accrual (
                accrual_date, 
                accrual_amount, 
                due_date, 
                tax_type_id, 
                taxpayer_id, 
                object_id,
                ownership_id,
				income_status_id
            ) VALUES (
                CURRENT_DATE, 
                v_tax_amount, 
                TO_DATE((p_year + 1) || '-12-01', 'YYYY-MM-DD'),
                v_transport_tax_type_id,
                p_taxpayer_id, 
                v_transport_record.object_id,
                v_transport_record.ownership_id,
				1
            );
            
            v_total_tax := v_total_tax + v_tax_amount;
        ELSIF v_tax_amount > 0 THEN
            -- Если начисление уже существует, обновляем сумму
            UPDATE tax_accrual 
            SET accrual_amount = v_tax_amount
            WHERE taxpayer_id = p_taxpayer_id 
              AND object_id = v_transport_record.object_id
              AND tax_type_id = v_transport_tax_type_id
              AND EXTRACT(YEAR FROM accrual_date) = p_year;
            
            v_total_tax := v_total_tax + v_tax_amount;
        END IF;
    END LOOP;
    
    RETURN v_total_tax;
END;
$$;


ALTER FUNCTION public.calculate_transport_tax(p_taxpayer_id integer, p_year integer) OWNER TO postgres;

--
-- TOC entry 363 (class 1255 OID 16720)
-- Name: create_tax_accrual_on_declaration_accept(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_tax_accrual_on_declaration_accept() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_period_end_date DATE;
    v_due_date DATE;
    v_tax_type_name TEXT;
BEGIN
    -- Проверяем, изменился ли статус на "принята"
    IF NEW.declaration_status_id = (
        SELECT declaration_status_id 
        FROM declaration_status 
        WHERE declaration_status_name = 'принята'
    ) AND (OLD.declaration_status_id IS NULL OR OLD.declaration_status_id != NEW.declaration_status_id) THEN
        
        -- Получаем дату окончания периода
        SELECT end_date INTO v_period_end_date
        FROM tax_period 
        WHERE period_id = NEW.period_id;
        
        -- Определяем срок уплаты (3 месяца после окончания отчетного периода)
        v_due_date := v_period_end_date + INTERVAL '3 months';
                
        -- Проверяем, не существует ли уже начисление для этой декларации
        IF NOT EXISTS (
            SELECT 1 
            FROM tax_accrual 
            WHERE declaration_id = NEW.declaration_id
        ) AND NEW.tax_sum > 0 THEN
            
            -- Создаем налоговое начисление
            INSERT INTO tax_accrual (
                accrual_date, 
                accrual_amount, 
                due_date, 
                tax_type_id, 
                taxpayer_id, 
                declaration_id,
				income_status_id
            ) VALUES (
                CURRENT_DATE, 
                NEW.tax_sum,
                v_due_date,
                NEW.tax_type_id,
                NEW.taxpayer_id, 
                NEW.declaration_id,
				1
            );
            
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_tax_accrual_on_declaration_accept() OWNER TO postgres;

--
-- TOC entry 344 (class 1255 OID 16721)
-- Name: generate_ogrn(character varying, character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_ogrn(p_region_code character varying, p_tax_office_code character varying, p_year integer DEFAULT NULL::integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$ 
DECLARE 
    v_ogrn VARCHAR(13); 
    v_base VARCHAR(12); 
    v_control_digit INTEGER; 
    v_year CHAR(2); 
BEGIN 
    -- Определяем год (последние две цифры) 
    IF p_year IS NULL THEN 
        v_year := to_char(CURRENT_DATE, 'YY'); 
    ELSE 
        v_year := to_char(p_year, 'FM00'); 
    END IF; 
     
    v_base := '1' || v_year ||  
             lpad(p_region_code, 2, '0') ||  
             lpad(p_tax_office_code, 2, '0') || 
             lpad(floor(random() * 100000)::TEXT, 5, '0'); 
     
    v_control_digit := (v_base::BIGINT % 11) % 10; 
     
    v_ogrn := v_base || v_control_digit::TEXT; 
     
    RETURN v_ogrn; 
END; 
$$;


ALTER FUNCTION public.generate_ogrn(p_region_code character varying, p_tax_office_code character varying, p_year integer) OWNER TO postgres;

--
-- TOC entry 364 (class 1255 OID 16722)
-- Name: generate_ogrnip(character varying, character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_ogrnip(p_region_code character varying, p_tax_office_code character varying, p_year integer DEFAULT NULL::integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$ 
DECLARE 
    v_ogrnip VARCHAR(15); 
    v_base VARCHAR(14); 
    v_control_digit INTEGER; 
    v_year CHAR(2); 
BEGIN 
    IF p_year IS NULL THEN 
        v_year := to_char(CURRENT_DATE, 'YY'); 
    ELSE 
        v_year := to_char(p_year, 'FM00'); 
    END IF; 
     
    v_base := '3' || v_year ||  
             lpad(p_region_code, 2, '0') ||  
             lpad(p_tax_office_code, 2, '0') || 
             lpad(floor(random() * 10000000)::TEXT, 7, '0'); 
     
    v_control_digit := (v_base::BIGINT % 13) % 10; 
     
    v_ogrnip := v_base || v_control_digit::TEXT; 
     
    RETURN v_ogrnip; 
END; 
$$;


ALTER FUNCTION public.generate_ogrnip(p_region_code character varying, p_tax_office_code character varying, p_year integer) OWNER TO postgres;

--
-- TOC entry 365 (class 1255 OID 16723)
-- Name: generate_unique_inn(integer, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_unique_inn(p_payer_type_id integer, p_tax_office_code character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $_$ 
DECLARE 
    v_inn VARCHAR(12); 
    v_base VARCHAR(10); 
    v_checksum INTEGER; 
    v_checksums RECORD; 
    v_counter INTEGER := 0; 
    v_max_attempts INTEGER := 100; 
    v_sequence_length INTEGER; 
BEGIN 
    -- Проверка кода налогового органа 
    IF p_tax_office_code !~ '^[0-9]{4}$' THEN 
        RAISE EXCEPTION 'Код налогового органа должен состоять из 4 
цифр!'; 
    END IF; 
     
    IF p_payer_type_id = 3 THEN -- Юрлицо (10 цифр) 
        v_max_attempts := 50; 
        v_sequence_length := 5; -- 5 цифр порядкового номера для юрлиц 
         
        WHILE v_counter < v_max_attempts LOOP 
            -- Генерируем базовую часть: код налогового органа (4) + порядковый номер (5) 
            v_base := p_tax_office_code ||  
                     lpad(floor(random() * 100000)::TEXT, 
v_sequence_length, '0'); 
             
            -- Вычисляем контрольную цифру 
            v_checksum := calculate_inn_10_checksum(v_base); 
             
            -- Формируем полный ИНН 
            v_inn := v_base || v_checksum::TEXT; 
             
            -- Проверяем уникальность 
            IF NOT EXISTS (SELECT 1 FROM taxpayer WHERE inn = v_inn) 
THEN 
                RETURN v_inn; 
            END IF; 
             
            v_counter := v_counter + 1; 
        END LOOP; 
         
    ELSE -- Физлицо или ИП (12 цифр) 
        v_sequence_length := 6; -- 6 цифр порядкового номера для физлиц 
         
        WHILE v_counter < v_max_attempts LOOP 
            -- Генерируем базовую часть: код налогового органа (4) + порядковый номер (6) 
            v_base := p_tax_office_code ||  
                     lpad(floor(random() * 1000000)::TEXT, 
v_sequence_length, '0'); 
             
            -- Вычисляем контрольные цифры 
            SELECT * INTO v_checksums FROM 
calculate_inn_12_checksums(v_base); 
             
            -- Формируем полный ИНН 
            v_inn := v_base || v_checksums.checksum1::TEXT || 
v_checksums.checksum2::TEXT; 
             
            -- Проверяем уникальность 
            IF NOT EXISTS (SELECT 1 FROM taxpayer WHERE inn = v_inn) 
THEN 
                RETURN v_inn; 
            END IF; 
             
            v_counter := v_counter + 1; 
        END LOOP; 
    END IF; 
     
    RAISE EXCEPTION 'Не удалось сгенерировать уникальный ИНН!'; 
END; 
$_$;


ALTER FUNCTION public.generate_unique_inn(p_payer_type_id integer, p_tax_office_code character varying) OWNER TO postgres;

--
-- TOC entry 366 (class 1255 OID 16724)
-- Name: update_risk_score(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_risk_score() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ 
DECLARE 
    v_taxpayer_id INTEGER; 
    v_new_score INTEGER; 
BEGIN 
    -- Определяем ID налогоплательщика в зависимости от операции и таблицы 
    IF TG_TABLE_NAME = 'tax_accrual' THEN 
        v_taxpayer_id := CASE WHEN TG_OP = 'DELETE' THEN 
OLD.taxpayer_id ELSE NEW.taxpayer_id END; 
    ELSIF TG_TABLE_NAME = 'tax_payment' THEN 
        -- Для платежей получаем taxpayer_id через начисление 
        SELECT taxpayer_id INTO v_taxpayer_id 
        FROM tax_accrual  
        WHERE tax_accrual_id = CASE WHEN TG_OP = 'DELETE' THEN 
OLD.tax_income_id ELSE NEW.tax_income_id END; 
    ELSIF TG_TABLE_NAME = 'identified_violation' THEN 
        -- Для нарушений получаем taxpayer_id через проверку 
        SELECT i.taxpayer_id INTO v_taxpayer_id 
        FROM inspection i 
        WHERE i.inspection_id = CASE WHEN TG_OP = 'DELETE' THEN 
OLD.inspection_id ELSE NEW.inspection_id END; 
    ELSIF TG_TABLE_NAME = 'inspection' THEN 
        v_taxpayer_id := CASE WHEN TG_OP = 'DELETE' THEN 
OLD.taxpayer_id ELSE NEW.taxpayer_id END; 
    END IF; 
 
    -- Если нашли налогоплательщика - обновляем рейтинг 
    IF v_taxpayer_id IS NOT NULL THEN 
        v_new_score := calculate_risk_score(v_taxpayer_id); 
         
        INSERT INTO taxpayer_rating (taxpayer_id, rating_date, 
rating_value) 
        VALUES (v_taxpayer_id, CURRENT_TIMESTAMP, v_new_score); 
    END IF; 
 
    RETURN COALESCE(NEW, OLD); 
END; 
$$;


ALTER FUNCTION public.update_risk_score() OWNER TO postgres;

--
-- TOC entry 367 (class 1255 OID 16725)
-- Name: validate_contact_data(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_contact_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ 
DECLARE 
    v_contact_type_name TEXT; 
BEGIN 
    -- Получаем тип контакта 
    SELECT name INTO v_contact_type_name  
    FROM contact_type  
    WHERE type_id = NEW.contact_type_id; 
     
    IF v_contact_type_name = 'email' THEN 
        IF NOT validate_email(NEW.value) THEN 
            RAISE EXCEPTION 'Неверный формат email: %', NEW.value; 
        END IF; 
    ELSIF v_contact_type_name = 'phone' THEN 
        IF NOT validate_phone(NEW.value) THEN 
            RAISE EXCEPTION 'Неверный формат телефона: %', NEW.value; 
        END IF; 
        -- Убираем всё, кроме цифр 
        NEW.value := regexp_replace(NEW.value, '[^\d+]', '', 'g'); 
END IF; 
RETURN NEW; 
END; 
$$;


ALTER FUNCTION public.validate_contact_data() OWNER TO postgres;

--
-- TOC entry 368 (class 1255 OID 16726)
-- Name: validate_dates(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_dates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ 
BEGIN 
    -- Проверка для таблицы taxpayer 
    IF TG_TABLE_NAME = 'taxpayer' THEN 
        -- Дата рождения не может быть в будущем 
        IF NEW.birth_date > CURRENT_DATE THEN 
            RAISE EXCEPTION 'Дата рождения не может быть в будущем: 
%', NEW.birth_date; 
        END IF; 
         
        -- Дата начала не может быть позже даты окончания 
        IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL 
THEN 
            IF NEW.start_date > NEW.end_date THEN 
                RAISE EXCEPTION 'Дата начала (%) не может быть позже 
даты окончания (%)', NEW.start_date, NEW.end_date; 
            END IF; 
        END IF; 
         
        -- Дата регистрации не может быть в будущем 
        IF NEW.registration_date > CURRENT_DATE THEN 
            RAISE EXCEPTION 'Дата регистрации не может быть в будущем: 
%', NEW.registration_date; 
        END IF; 
    END IF; 
 
    -- Проверка для таблицы document 
    IF TG_TABLE_NAME = 'document' THEN 
        -- Дата выдачи не может быть в будущем 
        IF NEW.issued_date > CURRENT_DATE THEN 
            RAISE EXCEPTION 'Дата выдачи документа не может быть в 
будущем: %', NEW.issued_date; 
        END IF; 
         
        -- Дата истечения не может быть раньше даты выдачи 
        IF NEW.expire_date IS NOT NULL AND NEW.issued_date > 
NEW.expire_date THEN 
            RAISE EXCEPTION 'Дата истечения (%) не может быть раньше 
даты выдачи (%)', NEW.expire_date, NEW.issued_date; 
        END IF; 
    END IF; 
 
    -- Проверка для таблицы object_ownership 
    IF TG_TABLE_NAME = 'object_ownership' THEN 
        -- Дата начала владения не может быть позже даты окончания 
        IF NEW.ownership_start_date > NEW.ownership_end_date THEN 
            RAISE EXCEPTION 'Дата начала владения (%) не может быть 
позже даты окончания (%)', NEW.ownership_start_date, 
NEW.ownership_end_date; 
        END IF; 
         
        -- Дата начала владения не может быть в будущем 
        IF NEW.ownership_start_date > CURRENT_DATE THEN 
            RAISE EXCEPTION 'Дата начала владения не может быть в 
будущем: %', NEW.ownership_start_date; 
        END IF; 
    END IF; 
 
    -- Проверка для таблицы tax_period 
    IF TG_TABLE_NAME = 'tax_period' THEN 
        -- Дата начала не может быть позже даты окончания 
        IF NEW.start_date > NEW.end_date THEN 
            RAISE EXCEPTION 'Дата начала периода (%) не может быть 
позже даты окончания (%)', NEW.start_date, NEW.end_date; 
        END IF; 
         
        -- Дата окончания не может быть в будущем для закрытых  периодов 
        IF NEW.end_date > CURRENT_DATE + INTERVAL '10 years' THEN 
            RAISE EXCEPTION 'Дата окончания периода не может быть 
более чем на 10 лет в будущем: %', NEW.end_date; 
        END IF; 
    END IF; 
 
    -- Проверка для таблицы tax_accrual 
    IF TG_TABLE_NAME = 'tax_accrual' THEN 
        -- Дата начисления не может быть в будущем 
        IF NEW.accrual_date > CURRENT_DATE THEN 
            RAISE EXCEPTION 'Дата начисления не может быть в будущем: 
%', NEW.accrual_date; 
        END IF; 
         
        -- Срок уплаты не может быть раньше даты начисления 
        IF NEW.due_date IS NOT NULL AND NEW.accrual_date > 
NEW.due_date THEN 
            RAISE EXCEPTION 'Срок уплаты (%) не может быть раньше даты 
начисления (%)', NEW.due_date, NEW.accrual_date; 
        END IF; 
    END IF; 
 
    -- Проверка для таблицы inspection 
    IF TG_TABLE_NAME = 'inspection' THEN 
        -- Дата проверки не может быть в будущем 
        IF NEW.inspection_date > CURRENT_DATE THEN 
            RAISE EXCEPTION 'Дата проверки не может быть в будущем: 
%', NEW.inspection_date; 
        END IF; 
    END IF; 
 
    RETURN NEW; 
END; 
$$;


ALTER FUNCTION public.validate_dates() OWNER TO postgres;

--
-- TOC entry 369 (class 1255 OID 16727)
-- Name: validate_email(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_email(email text) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$ 
BEGIN 
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za
z]{2,}$'; 
END; 
$_$;


ALTER FUNCTION public.validate_email(email text) OWNER TO postgres;

--
-- TOC entry 370 (class 1255 OID 16728)
-- Name: validate_inn(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_inn(p_inn character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$ 
DECLARE 
    v_length INTEGER; 
    v_checksum INTEGER; 
    v_checksums RECORD; 
    v_weights INTEGER[]; 
    v_sum INTEGER := 0; 
    i INTEGER; 
BEGIN 
    -- Проверка длины 
    v_length := length(p_inn); 
    IF v_length NOT IN (10, 12) THEN 
        RETURN FALSE; 
    END IF; 
     
    -- Проверка, что все символы - цифры 
    IF p_inn !~ '^[0-9]+$' THEN 
        RETURN FALSE; 
    END IF; 
     
    -- Проверка контрольной цифры для 10-значного ИНН (юрлица) 
    IF v_length = 10 THEN 
        v_checksum := calculate_inn_10_checksum(substring(p_inn FROM 1 
FOR 9)); 
        RETURN v_checksum = substring(p_inn FROM 10 FOR 1)::INTEGER; 
         
    -- Проверка контрольных цифр для 12-значного ИНН (физлица) 
    ELSIF v_length = 12 THEN 
        SELECT * INTO v_checksums  
        FROM calculate_inn_12_checksums(substring(p_inn FROM 1 FOR 
10)); 
         
        RETURN v_checksums.checksum1 = substring(p_inn FROM 11 FOR 
1)::INTEGER 
           AND v_checksums.checksum2 = substring(p_inn FROM 12 FOR 
1)::INTEGER; 
    END IF; 
     
    RETURN FALSE; 
END; 
$_$;


ALTER FUNCTION public.validate_inn(p_inn character varying) OWNER TO postgres;

--
-- TOC entry 345 (class 1255 OID 16729)
-- Name: validate_ogrn(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_ogrn(p_ogrn character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$ 
DECLARE 
    v_base BIGINT; 
    v_control_digit INTEGER; 
BEGIN 
    IF length(p_ogrn) != 13 OR p_ogrn !~ '^[0-9]+$' THEN 
        RETURN FALSE; 
    END IF; 
     
    v_base := substring(p_ogrn FROM 1 FOR 12)::BIGINT; 
    v_control_digit := substring(p_ogrn FROM 13 FOR 1)::INTEGER; 
     
    RETURN ((v_base % 11) % 10) = v_control_digit; 
END; 
$_$;


ALTER FUNCTION public.validate_ogrn(p_ogrn character varying) OWNER TO postgres;

--
-- TOC entry 346 (class 1255 OID 16730)
-- Name: validate_ogrnip(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_ogrnip(p_ogrnip character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$ 
DECLARE 
    v_base BIGINT; 
    v_control_digit INTEGER; 
BEGIN 
    IF length(p_ogrnip) != 15 OR p_ogrnip !~ '^[0-9]+$' THEN 
        RETURN FALSE; 
    END IF; 
     
    v_base := substring(p_ogrnip FROM 1 FOR 14)::BIGINT; 
    v_control_digit := substring(p_ogrnip FROM 15 FOR 1)::INTEGER; 
     
    RETURN ((v_base % 13) % 10) = v_control_digit; 
END; 
$_$;


ALTER FUNCTION public.validate_ogrnip(p_ogrnip character varying) OWNER TO postgres;

--
-- TOC entry 351 (class 1255 OID 16731)
-- Name: validate_phone(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_phone(phone text) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$ 
BEGIN 
    -- Российские номера: +7, 8 
    RETURN phone ~ '^(\+7|8|7)?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0
9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$'; 
END; 
$_$;


ALTER FUNCTION public.validate_phone(phone text) OWNER TO postgres;

--
-- TOC entry 342 (class 1255 OID 16732)
-- Name: validate_taxpayer_requisites(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_taxpayer_requisites() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ 
BEGIN 
    IF NEW.inn IS NOT NULL THEN 
        -- Проверяем соответствие длины ИНН типу налогоплательщика 
        IF (NEW.payer_type_id = 3 AND length(NEW.inn) != 10) OR 
           (NEW.payer_type_id IN (1, 2) AND length(NEW.inn) != 12) 
THEN 
            RAISE EXCEPTION 'Длина ИНН не соответствует типу 
налогоплательщика'; 
        END IF; 
         
        -- Проверяем контрольные цифры ИНН 
        IF NOT validate_inn(NEW.inn) THEN 
            RAISE EXCEPTION 'Неверный ИНН: ошибка контрольной суммы'; 
        END IF; 
    END IF; 
 
    IF NEW.ogrn IS NOT NULL THEN 
        CASE NEW.payer_type_id 
            WHEN 1 THEN -- Физлицо не должно иметь ОГРН/ОГРНИП 
                RAISE EXCEPTION 'Физическое лицо не может иметь 
ОГРН/ОГРНИП'; 
                 
            WHEN 2 THEN -- ИП должен иметь ОГРНИП (15 цифр) 
                IF length(NEW.ogrn) != 15 THEN 
                    RAISE EXCEPTION 'ОГРНИП должен содержать 15 цифр'; 
                END IF; 
                 
                IF NOT validate_ogrnip(NEW.ogrn) THEN 
                    RAISE EXCEPTION 'Неверный ОГРНИП: ошибка 
контрольной суммы'; 
                END IF; 
                 
            WHEN 3 THEN -- Юрлицо должно иметь ОГРН (13 цифр) 
                IF length(NEW.ogrn) != 13 THEN 
                    RAISE EXCEPTION 'ОГРН должен содержать 13 цифр'; 
                END IF; 
                 
                IF NOT validate_ogrn(NEW.ogrn) THEN 
                    RAISE EXCEPTION 'Неверный ОГРН: ошибка контрольной 
суммы'; 
                END IF; 
        END CASE; 
END IF; 
RETURN NEW; 
END; 
$$;


ALTER FUNCTION public.validate_taxpayer_requisites() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 322 (class 1259 OID 24903)
-- Name: account_emailaddress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_emailaddress (
    id integer NOT NULL,
    email character varying(254) NOT NULL,
    verified boolean NOT NULL,
    "primary" boolean NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.account_emailaddress OWNER TO postgres;

--
-- TOC entry 321 (class 1259 OID 24902)
-- Name: account_emailaddress_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.account_emailaddress ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.account_emailaddress_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 324 (class 1259 OID 24911)
-- Name: account_emailconfirmation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_emailconfirmation (
    id integer NOT NULL,
    created timestamp with time zone NOT NULL,
    sent timestamp with time zone,
    key character varying(64) NOT NULL,
    email_address_id integer NOT NULL
);


ALTER TABLE public.account_emailconfirmation OWNER TO postgres;

--
-- TOC entry 323 (class 1259 OID 24910)
-- Name: account_emailconfirmation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.account_emailconfirmation ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.account_emailconfirmation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 217 (class 1259 OID 16733)
-- Name: accrual_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accrual_status (
    accrual_status_id integer NOT NULL,
    accrual_status_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.accrual_status OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16738)
-- Name: accrual_status_accrual_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accrual_status_accrual_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accrual_status_accrual_status_id_seq OWNER TO postgres;

--
-- TOC entry 5551 (class 0 OID 0)
-- Dependencies: 218
-- Name: accrual_status_accrual_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accrual_status_accrual_status_id_seq OWNED BY public.accrual_status.accrual_status_id;


--
-- TOC entry 309 (class 1259 OID 17354)
-- Name: auth_group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_group (
    id integer NOT NULL,
    name character varying(150) NOT NULL
);


ALTER TABLE public.auth_group OWNER TO postgres;

--
-- TOC entry 308 (class 1259 OID 17353)
-- Name: auth_group_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 311 (class 1259 OID 17362)
-- Name: auth_group_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_group_permissions (
    id bigint NOT NULL,
    group_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.auth_group_permissions OWNER TO postgres;

--
-- TOC entry 310 (class 1259 OID 17361)
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_group_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 307 (class 1259 OID 17348)
-- Name: auth_permission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_permission (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    content_type_id integer NOT NULL,
    codename character varying(100) NOT NULL
);


ALTER TABLE public.auth_permission OWNER TO postgres;

--
-- TOC entry 306 (class 1259 OID 17347)
-- Name: auth_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_permission ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 313 (class 1259 OID 17368)
-- Name: auth_user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_user (
    id integer NOT NULL,
    password character varying(128) NOT NULL,
    last_login timestamp with time zone,
    is_superuser boolean NOT NULL,
    username character varying(150) NOT NULL,
    first_name character varying(150) NOT NULL,
    last_name character varying(150) NOT NULL,
    email character varying(254) NOT NULL,
    is_staff boolean NOT NULL,
    is_active boolean NOT NULL,
    date_joined timestamp with time zone NOT NULL
);


ALTER TABLE public.auth_user OWNER TO postgres;

--
-- TOC entry 315 (class 1259 OID 17376)
-- Name: auth_user_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_user_groups (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    group_id integer NOT NULL
);


ALTER TABLE public.auth_user_groups OWNER TO postgres;

--
-- TOC entry 314 (class 1259 OID 17375)
-- Name: auth_user_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_user_groups ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_user_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 312 (class 1259 OID 17367)
-- Name: auth_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_user ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 317 (class 1259 OID 17382)
-- Name: auth_user_user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_user_user_permissions (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.auth_user_user_permissions OWNER TO postgres;

--
-- TOC entry 316 (class 1259 OID 17381)
-- Name: auth_user_user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_user_user_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_user_user_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 325 (class 1259 OID 24942)
-- Name: authtoken_token; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.authtoken_token (
    key character varying(40) NOT NULL,
    created timestamp with time zone NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.authtoken_token OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16739)
-- Name: card_create_source; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.card_create_source (
    source_id integer NOT NULL,
    source_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.card_create_source OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16744)
-- Name: card_create_source_source_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.card_create_source_source_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.card_create_source_source_id_seq OWNER TO postgres;

--
-- TOC entry 5552 (class 0 OID 0)
-- Dependencies: 220
-- Name: card_create_source_source_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.card_create_source_source_id_seq OWNED BY public.card_create_source.source_id;


--
-- TOC entry 221 (class 1259 OID 16745)
-- Name: check_status_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.check_status_type (
    check_status_type_id integer NOT NULL,
    check_status_type_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.check_status_type OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16750)
-- Name: check_status_type_check_status_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.check_status_type_check_status_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.check_status_type_check_status_type_id_seq OWNER TO postgres;

--
-- TOC entry 5553 (class 0 OID 0)
-- Dependencies: 222
-- Name: check_status_type_check_status_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.check_status_type_check_status_type_id_seq OWNED BY public.check_status_type.check_status_type_id;


--
-- TOC entry 223 (class 1259 OID 16751)
-- Name: contact_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_data (
    contact_id integer NOT NULL,
    value text,
    contact_type_id integer NOT NULL,
    taxpayer_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.contact_data OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16756)
-- Name: contact_data_contact_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contact_data_contact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contact_data_contact_id_seq OWNER TO postgres;

--
-- TOC entry 5554 (class 0 OID 0)
-- Dependencies: 224
-- Name: contact_data_contact_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contact_data_contact_id_seq OWNED BY public.contact_data.contact_id;


--
-- TOC entry 225 (class 1259 OID 16757)
-- Name: contact_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_type (
    type_id integer NOT NULL,
    name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.contact_type OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16762)
-- Name: contant_type_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.contant_type_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.contant_type_type_id_seq OWNER TO postgres;

--
-- TOC entry 5555 (class 0 OID 0)
-- Dependencies: 226
-- Name: contant_type_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.contant_type_type_id_seq OWNED BY public.contact_type.type_id;


--
-- TOC entry 227 (class 1259 OID 16763)
-- Name: declaration_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.declaration_status (
    declaration_status_id integer NOT NULL,
    declaration_status_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.declaration_status OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16768)
-- Name: declaration_status_declaration_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.declaration_status_declaration_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.declaration_status_declaration_status_id_seq OWNER TO postgres;

--
-- TOC entry 5556 (class 0 OID 0)
-- Dependencies: 228
-- Name: declaration_status_declaration_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.declaration_status_declaration_status_id_seq OWNED BY public.declaration_status.declaration_status_id;


--
-- TOC entry 319 (class 1259 OID 17440)
-- Name: django_admin_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_admin_log (
    id integer NOT NULL,
    action_time timestamp with time zone NOT NULL,
    object_id text,
    object_repr character varying(200) NOT NULL,
    action_flag smallint NOT NULL,
    change_message text NOT NULL,
    content_type_id integer,
    user_id integer NOT NULL,
    CONSTRAINT django_admin_log_action_flag_check CHECK ((action_flag >= 0))
);


ALTER TABLE public.django_admin_log OWNER TO postgres;

--
-- TOC entry 318 (class 1259 OID 17439)
-- Name: django_admin_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_admin_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_admin_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 305 (class 1259 OID 17340)
-- Name: django_content_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_content_type (
    id integer NOT NULL,
    app_label character varying(100) NOT NULL,
    model character varying(100) NOT NULL
);


ALTER TABLE public.django_content_type OWNER TO postgres;

--
-- TOC entry 304 (class 1259 OID 17339)
-- Name: django_content_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_content_type ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_content_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 303 (class 1259 OID 17332)
-- Name: django_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_migrations (
    id bigint NOT NULL,
    app character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    applied timestamp with time zone NOT NULL
);


ALTER TABLE public.django_migrations OWNER TO postgres;

--
-- TOC entry 302 (class 1259 OID 17331)
-- Name: django_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_migrations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 320 (class 1259 OID 17468)
-- Name: django_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_session (
    session_key character varying(40) NOT NULL,
    session_data text NOT NULL,
    expire_date timestamp with time zone NOT NULL
);


ALTER TABLE public.django_session OWNER TO postgres;

--
-- TOC entry 327 (class 1259 OID 24956)
-- Name: django_site; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_site (
    id integer NOT NULL,
    domain character varying(100) NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.django_site OWNER TO postgres;

--
-- TOC entry 326 (class 1259 OID 24955)
-- Name: django_site_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_site ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_site_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 229 (class 1259 OID 16769)
-- Name: document; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document (
    document_id integer NOT NULL,
    series character varying(15),
    number character varying(30),
    issued_by text,
    issued_date date,
    additional_info text,
    expire_date date,
    "Ключ типа документа" integer NOT NULL,
    "Ключ налогоплательщика" integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.document OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16774)
-- Name: document_document_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_document_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_document_id_seq OWNER TO postgres;

--
-- TOC entry 5557 (class 0 OID 0)
-- Dependencies: 230
-- Name: document_document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_document_id_seq OWNED BY public.document.document_id;


--
-- TOC entry 231 (class 1259 OID 16775)
-- Name: document_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_type (
    document_type_id integer NOT NULL,
    name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.document_type OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 16780)
-- Name: document_type_document_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_type_document_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_type_document_type_id_seq OWNER TO postgres;

--
-- TOC entry 5558 (class 0 OID 0)
-- Dependencies: 232
-- Name: document_type_document_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_type_document_type_id_seq OWNED BY public.document_type.document_type_id;


--
-- TOC entry 233 (class 1259 OID 16781)
-- Name: employers_declaration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employers_declaration (
    "Attribute1" bigint
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.employers_declaration OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 16784)
-- Name: identified_violation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.identified_violation (
    violation_id integer NOT NULL,
    sum_to_pay numeric(20,2),
    violation_type_id integer NOT NULL,
    period_id integer NOT NULL,
    inspection_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.identified_violation OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 16787)
-- Name: identified_violation_violation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.identified_violation_violation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.identified_violation_violation_id_seq OWNER TO postgres;

--
-- TOC entry 5559 (class 0 OID 0)
-- Dependencies: 235
-- Name: identified_violation_violation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.identified_violation_violation_id_seq OWNED BY public.identified_violation.violation_id;


--
-- TOC entry 236 (class 1259 OID 16788)
-- Name: inspection; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inspection (
    inspection_id integer NOT NULL,
    inspection_date timestamp without time zone,
    taxpayer_id integer NOT NULL,
    inspection_type_id integer NOT NULL,
    inspection_reason integer NOT NULL,
    inspection_type_status_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.inspection OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 16791)
-- Name: inspection_base; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inspection_base (
    inspection_base_id integer NOT NULL,
    inspection_base_name text NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.inspection_base OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 16796)
-- Name: inspection_base_inspection_base_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inspection_base_inspection_base_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inspection_base_inspection_base_id_seq OWNER TO postgres;

--
-- TOC entry 5560 (class 0 OID 0)
-- Dependencies: 238
-- Name: inspection_base_inspection_base_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inspection_base_inspection_base_id_seq OWNED BY public.inspection_base.inspection_base_id;


--
-- TOC entry 239 (class 1259 OID 16797)
-- Name: inspection_base_inspection_base_name_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inspection_base_inspection_base_name_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inspection_base_inspection_base_name_seq OWNER TO postgres;

--
-- TOC entry 5561 (class 0 OID 0)
-- Dependencies: 239
-- Name: inspection_base_inspection_base_name_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inspection_base_inspection_base_name_seq OWNED BY public.inspection_base.inspection_base_name;


--
-- TOC entry 240 (class 1259 OID 16798)
-- Name: inspection_inspection_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inspection_inspection_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inspection_inspection_id_seq OWNER TO postgres;

--
-- TOC entry 5562 (class 0 OID 0)
-- Dependencies: 240
-- Name: inspection_inspection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inspection_inspection_id_seq OWNED BY public.inspection.inspection_id;


--
-- TOC entry 241 (class 1259 OID 16799)
-- Name: inspection_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inspection_type (
    inspection_type_id integer NOT NULL,
    inspection_name_id text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.inspection_type OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 16804)
-- Name: inspection_type_inspection_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inspection_type_inspection_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inspection_type_inspection_type_id_seq OWNER TO postgres;

--
-- TOC entry 5563 (class 0 OID 0)
-- Dependencies: 242
-- Name: inspection_type_inspection_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inspection_type_inspection_type_id_seq OWNED BY public.inspection_type.inspection_type_id;


--
-- TOC entry 243 (class 1259 OID 16805)
-- Name: kbk; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kbk (
    kbk_id integer NOT NULL,
    kbk_code character varying(20),
    kbk_description text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.kbk OWNER TO postgres;

--
-- TOC entry 244 (class 1259 OID 16810)
-- Name: kbk_kbk_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kbk_kbk_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kbk_kbk_id_seq OWNER TO postgres;

--
-- TOC entry 5564 (class 0 OID 0)
-- Dependencies: 244
-- Name: kbk_kbk_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kbk_kbk_id_seq OWNED BY public.kbk.kbk_id;


--
-- TOC entry 245 (class 1259 OID 16811)
-- Name: object_ownership; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.object_ownership (
    ownership_id integer NOT NULL,
    ownership_start_date date,
    ownership_end_date date,
    taxpayer_id integer NOT NULL,
    object_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.object_ownership OWNER TO postgres;

--
-- TOC entry 246 (class 1259 OID 16814)
-- Name: object_ownership_ownership_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.object_ownership_ownership_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.object_ownership_ownership_id_seq OWNER TO postgres;

--
-- TOC entry 5565 (class 0 OID 0)
-- Dependencies: 246
-- Name: object_ownership_ownership_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.object_ownership_ownership_id_seq OWNED BY public.object_ownership.ownership_id;


--
-- TOC entry 247 (class 1259 OID 16815)
-- Name: object_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.object_type (
    object_type_id integer NOT NULL,
    object_type_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.object_type OWNER TO postgres;

--
-- TOC entry 248 (class 1259 OID 16820)
-- Name: object_type_object_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.object_type_object_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.object_type_object_type_id_seq OWNER TO postgres;

--
-- TOC entry 5566 (class 0 OID 0)
-- Dependencies: 248
-- Name: object_type_object_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.object_type_object_type_id_seq OWNED BY public.object_type.object_type_id;


--
-- TOC entry 249 (class 1259 OID 16821)
-- Name: okved; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.okved (
    okved_id integer NOT NULL,
    code character varying(8),
    description text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.okved OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 16826)
-- Name: okved_okved_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.okved_okved_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.okved_okved_id_seq OWNER TO postgres;

--
-- TOC entry 5567 (class 0 OID 0)
-- Dependencies: 250
-- Name: okved_okved_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.okved_okved_id_seq OWNED BY public.okved.okved_id;


--
-- TOC entry 251 (class 1259 OID 16827)
-- Name: okved_taxpayer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.okved_taxpayer (
    okved_id integer NOT NULL,
    id_taxpayer integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.okved_taxpayer OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 16830)
-- Name: opf; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.opf (
    opf_id integer NOT NULL,
    name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.opf OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 16835)
-- Name: opf_opf_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.opf_opf_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.opf_opf_id_seq OWNER TO postgres;

--
-- TOC entry 5568 (class 0 OID 0)
-- Dependencies: 253
-- Name: opf_opf_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.opf_opf_id_seq OWNED BY public.opf.opf_id;


--
-- TOC entry 254 (class 1259 OID 16836)
-- Name: period_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.period_type (
    type_period_id integer NOT NULL,
    name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.period_type OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 16841)
-- Name: period_type_type_period_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.period_type_type_period_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.period_type_type_period_id_seq OWNER TO postgres;

--
-- TOC entry 5569 (class 0 OID 0)
-- Dependencies: 255
-- Name: period_type_type_period_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.period_type_type_period_id_seq OWNED BY public.period_type.type_period_id;


--
-- TOC entry 256 (class 1259 OID 16842)
-- Name: rax_period_tax_reduce_request; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rax_period_tax_reduce_request (
    period_id integer NOT NULL,
    request_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.rax_period_tax_reduce_request OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 16845)
-- Name: real_estate_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.real_estate_type (
    real_estate_type_id integer NOT NULL,
    real_estate_type_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.real_estate_type OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 16850)
-- Name: real_estate_type_real_estate_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.real_estate_type_real_estate_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.real_estate_type_real_estate_type_id_seq OWNER TO postgres;

--
-- TOC entry 5570 (class 0 OID 0)
-- Dependencies: 258
-- Name: real_estate_type_real_estate_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.real_estate_type_real_estate_type_id_seq OWNED BY public.real_estate_type.real_estate_type_id;


--
-- TOC entry 259 (class 1259 OID 16851)
-- Name: reduce_base; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reduce_base (
    reduce_base_id integer NOT NULL,
    reduce_base_name text,
    reduce_ground text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.reduce_base OWNER TO postgres;

--
-- TOC entry 260 (class 1259 OID 16856)
-- Name: reduce_base_reduce_base_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reduce_base_reduce_base_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reduce_base_reduce_base_id_seq OWNER TO postgres;

--
-- TOC entry 5571 (class 0 OID 0)
-- Dependencies: 260
-- Name: reduce_base_reduce_base_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reduce_base_reduce_base_id_seq OWNED BY public.reduce_base.reduce_base_id;


--
-- TOC entry 261 (class 1259 OID 16857)
-- Name: reduce_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reduce_type (
    reduce_type_id integer NOT NULL,
    reduce_type_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.reduce_type OWNER TO postgres;

--
-- TOC entry 262 (class 1259 OID 16862)
-- Name: reduce_type_reduce_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reduce_type_reduce_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reduce_type_reduce_type_id_seq OWNER TO postgres;

--
-- TOC entry 5572 (class 0 OID 0)
-- Dependencies: 262
-- Name: reduce_type_reduce_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reduce_type_reduce_type_id_seq OWNED BY public.reduce_type.reduce_type_id;


--
-- TOC entry 263 (class 1259 OID 16863)
-- Name: region; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.region (
    region_id integer NOT NULL,
    name text,
    code character varying(3)
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.region OWNER TO postgres;

--
-- TOC entry 264 (class 1259 OID 16868)
-- Name: region_region_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.region_region_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.region_region_id_seq OWNER TO postgres;

--
-- TOC entry 5573 (class 0 OID 0)
-- Dependencies: 264
-- Name: region_region_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.region_region_id_seq OWNED BY public.region.region_id;


--
-- TOC entry 265 (class 1259 OID 16869)
-- Name: report_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.report_status (
    report_status_id integer NOT NULL,
    report_status_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.report_status OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 16874)
-- Name: report_status_report_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.report_status_report_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.report_status_report_status_id_seq OWNER TO postgres;

--
-- TOC entry 5574 (class 0 OID 0)
-- Dependencies: 266
-- Name: report_status_report_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.report_status_report_status_id_seq OWNED BY public.report_status.report_status_id;


--
-- TOC entry 267 (class 1259 OID 16875)
-- Name: risk_factor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.risk_factor (
    risk_factor_id integer NOT NULL,
    factor_name text,
    factor_description text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.risk_factor OWNER TO postgres;

--
-- TOC entry 268 (class 1259 OID 16880)
-- Name: risk_factor_risk_factor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.risk_factor_risk_factor_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.risk_factor_risk_factor_id_seq OWNER TO postgres;

--
-- TOC entry 5575 (class 0 OID 0)
-- Dependencies: 268
-- Name: risk_factor_risk_factor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.risk_factor_risk_factor_id_seq OWNED BY public.risk_factor.risk_factor_id;


--
-- TOC entry 269 (class 1259 OID 16881)
-- Name: role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role (
    role_id integer NOT NULL,
    role_name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.role OWNER TO postgres;

--
-- TOC entry 270 (class 1259 OID 16886)
-- Name: role_role_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.role_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_role_id_seq OWNER TO postgres;

--
-- TOC entry 5576 (class 0 OID 0)
-- Dependencies: 270
-- Name: role_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_role_id_seq OWNED BY public.role.role_id;


--
-- TOC entry 329 (class 1259 OID 24965)
-- Name: socialaccount_socialaccount; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.socialaccount_socialaccount (
    id integer NOT NULL,
    provider character varying(200) NOT NULL,
    uid character varying(191) NOT NULL,
    last_login timestamp with time zone NOT NULL,
    date_joined timestamp with time zone NOT NULL,
    extra_data jsonb NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.socialaccount_socialaccount OWNER TO postgres;

--
-- TOC entry 328 (class 1259 OID 24964)
-- Name: socialaccount_socialaccount_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.socialaccount_socialaccount ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.socialaccount_socialaccount_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 331 (class 1259 OID 24973)
-- Name: socialaccount_socialapp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.socialaccount_socialapp (
    id integer NOT NULL,
    provider character varying(30) NOT NULL,
    name character varying(40) NOT NULL,
    client_id character varying(191) NOT NULL,
    secret character varying(191) NOT NULL,
    key character varying(191) NOT NULL,
    provider_id character varying(200) NOT NULL,
    settings jsonb NOT NULL
);


ALTER TABLE public.socialaccount_socialapp OWNER TO postgres;

--
-- TOC entry 330 (class 1259 OID 24972)
-- Name: socialaccount_socialapp_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.socialaccount_socialapp ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.socialaccount_socialapp_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 333 (class 1259 OID 24979)
-- Name: socialaccount_socialapp_sites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.socialaccount_socialapp_sites (
    id bigint NOT NULL,
    socialapp_id integer NOT NULL,
    site_id integer NOT NULL
);


ALTER TABLE public.socialaccount_socialapp_sites OWNER TO postgres;

--
-- TOC entry 332 (class 1259 OID 24978)
-- Name: socialaccount_socialapp_sites_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.socialaccount_socialapp_sites ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.socialaccount_socialapp_sites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 335 (class 1259 OID 24985)
-- Name: socialaccount_socialtoken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.socialaccount_socialtoken (
    id integer NOT NULL,
    token text NOT NULL,
    token_secret text NOT NULL,
    expires_at timestamp with time zone,
    account_id integer NOT NULL,
    app_id integer
);


ALTER TABLE public.socialaccount_socialtoken OWNER TO postgres;

--
-- TOC entry 334 (class 1259 OID 24984)
-- Name: socialaccount_socialtoken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.socialaccount_socialtoken ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.socialaccount_socialtoken_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 271 (class 1259 OID 16887)
-- Name: tax_accrual; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_accrual (
    tax_accrual_id integer NOT NULL,
    accrual_date timestamp(6) without time zone,
    accrual_amount numeric(20,2),
    percent_amount numeric(20,2),
    tax_type_id integer NOT NULL,
    income_status_id integer NOT NULL,
    ownership_id integer,
    declaration_id integer,
    taxpayer_id integer,
    object_id integer,
    due_date date
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_accrual OWNER TO postgres;

--
-- TOC entry 272 (class 1259 OID 16890)
-- Name: tax_accrual_tax_accrual_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_accrual_tax_accrual_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_accrual_tax_accrual_id_seq OWNER TO postgres;

--
-- TOC entry 5577 (class 0 OID 0)
-- Dependencies: 272
-- Name: tax_accrual_tax_accrual_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_accrual_tax_accrual_id_seq OWNED BY public.tax_accrual.tax_accrual_id;


--
-- TOC entry 273 (class 1259 OID 16891)
-- Name: tax_declaration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_declaration (
    declaration_id integer NOT NULL,
    submission_date timestamp(6) without time zone,
    tax_sum numeric(20,2),
    total_income numeric(20,2),
    taxpayer_id integer NOT NULL,
    period_id integer NOT NULL,
    tax_type_id integer NOT NULL,
    declaration_status_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_declaration OWNER TO postgres;

--
-- TOC entry 274 (class 1259 OID 16894)
-- Name: tax_declaration_declaration_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_declaration_declaration_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_declaration_declaration_id_seq OWNER TO postgres;

--
-- TOC entry 5578 (class 0 OID 0)
-- Dependencies: 274
-- Name: tax_declaration_declaration_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_declaration_declaration_id_seq OWNED BY public.tax_declaration.declaration_id;


--
-- TOC entry 275 (class 1259 OID 16895)
-- Name: tax_officer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_officer (
    tax_officer_id integer NOT NULL,
    tax_officer_name text,
    unit text,
    role_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_officer OWNER TO postgres;

--
-- TOC entry 276 (class 1259 OID 16900)
-- Name: tax_officer_inspection; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_officer_inspection (
    tax_officer_id integer NOT NULL,
    inspection_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_officer_inspection OWNER TO postgres;

--
-- TOC entry 277 (class 1259 OID 16903)
-- Name: tax_officer_tax_officer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_officer_tax_officer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_officer_tax_officer_id_seq OWNER TO postgres;

--
-- TOC entry 5579 (class 0 OID 0)
-- Dependencies: 277
-- Name: tax_officer_tax_officer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_officer_tax_officer_id_seq OWNED BY public.tax_officer.tax_officer_id;


--
-- TOC entry 278 (class 1259 OID 16904)
-- Name: tax_payment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_payment (
    payment_id integer NOT NULL,
    payment_date timestamp(6) without time zone,
    payment_amount numeric(20,2),
    debit_account character varying(20),
    credit_account character varying(20),
    kbk_id integer NOT NULL,
    tax_income_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_payment OWNER TO postgres;

--
-- TOC entry 279 (class 1259 OID 16907)
-- Name: tax_payment_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_payment_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_payment_payment_id_seq OWNER TO postgres;

--
-- TOC entry 5580 (class 0 OID 0)
-- Dependencies: 279
-- Name: tax_payment_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_payment_payment_id_seq OWNED BY public.tax_payment.payment_id;


--
-- TOC entry 280 (class 1259 OID 16908)
-- Name: tax_period; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_period (
    period_id integer NOT NULL,
    start_date date,
    end_date date,
    period_type_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_period OWNER TO postgres;

--
-- TOC entry 281 (class 1259 OID 16911)
-- Name: tax_period_period_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_period_period_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_period_period_id_seq OWNER TO postgres;

--
-- TOC entry 5581 (class 0 OID 0)
-- Dependencies: 281
-- Name: tax_period_period_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_period_period_id_seq OWNED BY public.tax_period.period_id;


--
-- TOC entry 282 (class 1259 OID 16912)
-- Name: tax_reduce_request; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_reduce_request (
    request_id integer NOT NULL,
    send_date timestamp(6) without time zone,
    requested_reduce_amount numeric(20,2),
    full_description text,
    verdict_date timestamp(6) without time zone,
    reduce_base_id integer NOT NULL,
    request_status_id integer NOT NULL,
    taxpayer_id integer NOT NULL,
    "Ключ сотрудника" integer NOT NULL,
    "Ключ типа снижения" integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_reduce_request OWNER TO postgres;

--
-- TOC entry 283 (class 1259 OID 16917)
-- Name: tax_reduce_request_request_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_reduce_request_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_reduce_request_request_id_seq OWNER TO postgres;

--
-- TOC entry 5582 (class 0 OID 0)
-- Dependencies: 283
-- Name: tax_reduce_request_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_reduce_request_request_id_seq OWNED BY public.tax_reduce_request.request_id;


--
-- TOC entry 284 (class 1259 OID 16918)
-- Name: tax_reduce_request_tax_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_reduce_request_tax_type (
    request_id integer NOT NULL,
    tax_type_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_reduce_request_tax_type OWNER TO postgres;

--
-- TOC entry 285 (class 1259 OID 16921)
-- Name: tax_regime; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_regime (
    regime_id integer NOT NULL,
    name text,
    description text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_regime OWNER TO postgres;

--
-- TOC entry 286 (class 1259 OID 16926)
-- Name: tax_regime_regime_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_regime_regime_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_regime_regime_id_seq OWNER TO postgres;

--
-- TOC entry 5583 (class 0 OID 0)
-- Dependencies: 286
-- Name: tax_regime_regime_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_regime_regime_id_seq OWNED BY public.tax_regime.regime_id;


--
-- TOC entry 287 (class 1259 OID 16927)
-- Name: tax_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_type (
    tax_type_id integer NOT NULL,
    tax_type_name text,
    tax_type_description text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.tax_type OWNER TO postgres;

--
-- TOC entry 288 (class 1259 OID 16932)
-- Name: tax_type_tax_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tax_type_tax_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tax_type_tax_type_id_seq OWNER TO postgres;

--
-- TOC entry 5584 (class 0 OID 0)
-- Dependencies: 288
-- Name: tax_type_tax_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tax_type_tax_type_id_seq OWNED BY public.tax_type.tax_type_id;


--
-- TOC entry 289 (class 1259 OID 16933)
-- Name: taxable_object; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taxable_object (
    object_id integer NOT NULL,
    object_name text,
    cadastral_number character varying(16),
    object_address text,
    cadastral_value numeric(20,2),
    transport_vin character varying(17),
    registration_plate character varying(9),
    transport_model text,
    extra_value numeric(20,2),
    object_type_id integer NOT NULL,
    real_estate_type_id integer,
    engine_power integer
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.taxable_object OWNER TO postgres;

--
-- TOC entry 290 (class 1259 OID 16938)
-- Name: taxable_object_object_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.taxable_object_object_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.taxable_object_object_id_seq OWNER TO postgres;

--
-- TOC entry 5585 (class 0 OID 0)
-- Dependencies: 290
-- Name: taxable_object_object_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.taxable_object_object_id_seq OWNED BY public.taxable_object.object_id;


--
-- TOC entry 291 (class 1259 OID 16939)
-- Name: taxpayer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taxpayer (
    taxpayer_id integer NOT NULL,
    inn character varying(12),
    creation_date timestamp(6) without time zone,
    notes text,
    update_date timestamp(6) without time zone,
    fio text,
    birth_date date,
    registration_address text,
    fact_address text,
    ogrn character varying(15),
    registration_date date,
    bank_detals character varying(20),
    start_date date,
    end_date date,
    full_name text,
    short_name text,
    executive_list text,
    payer_status_id integer NOT NULL,
    region_key integer NOT NULL,
    opf_id integer NOT NULL,
    tax_regime_id integer NOT NULL,
    payer_type_id integer NOT NULL,
    origin_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.taxpayer OWNER TO postgres;

--
-- TOC entry 292 (class 1259 OID 16944)
-- Name: taxpayer_rating; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taxpayer_rating (
    rating_id integer NOT NULL,
    rating_date timestamp(6) without time zone,
    rating_value numeric(3,0),
    taxpayer_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.taxpayer_rating OWNER TO postgres;

--
-- TOC entry 293 (class 1259 OID 16947)
-- Name: taxpayer_rating_rating_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.taxpayer_rating_rating_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.taxpayer_rating_rating_id_seq OWNER TO postgres;

--
-- TOC entry 5586 (class 0 OID 0)
-- Dependencies: 293
-- Name: taxpayer_rating_rating_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.taxpayer_rating_rating_id_seq OWNED BY public.taxpayer_rating.rating_id;


--
-- TOC entry 294 (class 1259 OID 16948)
-- Name: taxpayer_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taxpayer_status (
    status_id integer NOT NULL,
    name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.taxpayer_status OWNER TO postgres;

--
-- TOC entry 295 (class 1259 OID 16953)
-- Name: taxpayer_status_status_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.taxpayer_status_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.taxpayer_status_status_id_seq OWNER TO postgres;

--
-- TOC entry 5587 (class 0 OID 0)
-- Dependencies: 295
-- Name: taxpayer_status_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.taxpayer_status_status_id_seq OWNED BY public.taxpayer_status.status_id;


--
-- TOC entry 296 (class 1259 OID 16954)
-- Name: taxpayer_taxpayer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.taxpayer_taxpayer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.taxpayer_taxpayer_id_seq OWNER TO postgres;

--
-- TOC entry 5588 (class 0 OID 0)
-- Dependencies: 296
-- Name: taxpayer_taxpayer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.taxpayer_taxpayer_id_seq OWNED BY public.taxpayer.taxpayer_id;


--
-- TOC entry 297 (class 1259 OID 16955)
-- Name: taxpayer_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.taxpayer_type (
    id_taxpayer_type integer NOT NULL,
    name text
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.taxpayer_type OWNER TO postgres;

--
-- TOC entry 298 (class 1259 OID 16960)
-- Name: taxpayer_type_id_taxpayer_type_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.taxpayer_type_id_taxpayer_type_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.taxpayer_type_id_taxpayer_type_seq OWNER TO postgres;

--
-- TOC entry 5589 (class 0 OID 0)
-- Dependencies: 298
-- Name: taxpayer_type_id_taxpayer_type_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.taxpayer_type_id_taxpayer_type_seq OWNED BY public.taxpayer_type.id_taxpayer_type;


--
-- TOC entry 337 (class 1259 OID 25048)
-- Name: token_blacklist_blacklistedtoken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_blacklist_blacklistedtoken (
    id bigint NOT NULL,
    blacklisted_at timestamp with time zone NOT NULL,
    token_id bigint NOT NULL
);


ALTER TABLE public.token_blacklist_blacklistedtoken OWNER TO postgres;

--
-- TOC entry 336 (class 1259 OID 25047)
-- Name: token_blacklist_blacklistedtoken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.token_blacklist_blacklistedtoken ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.token_blacklist_blacklistedtoken_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 339 (class 1259 OID 25054)
-- Name: token_blacklist_outstandingtoken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_blacklist_outstandingtoken (
    id bigint NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    user_id integer,
    jti character varying(255) NOT NULL
);


ALTER TABLE public.token_blacklist_outstandingtoken OWNER TO postgres;

--
-- TOC entry 338 (class 1259 OID 25053)
-- Name: token_blacklist_outstandingtoken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.token_blacklist_outstandingtoken ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.token_blacklist_outstandingtoken_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 299 (class 1259 OID 16961)
-- Name: violation_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.violation_type (
    violation_type_id integer NOT NULL,
    violation_name text,
    violation_code character varying(3)
)
WITH (autovacuum_enabled='true');


ALTER TABLE public.violation_type OWNER TO postgres;

--
-- TOC entry 300 (class 1259 OID 16966)
-- Name: violation_type_violation_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.violation_type_violation_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.violation_type_violation_type_id_seq OWNER TO postgres;

--
-- TOC entry 5590 (class 0 OID 0)
-- Dependencies: 300
-- Name: violation_type_violation_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.violation_type_violation_type_id_seq OWNED BY public.violation_type.violation_type_id;


--
-- TOC entry 301 (class 1259 OID 16967)
-- Name: Факторы риска_Оценка риска налого; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Факторы риска_Оценка риска налого" (
    risk_factor_id integer NOT NULL,
    rating_id integer NOT NULL
)
WITH (autovacuum_enabled='true');


ALTER TABLE public."Факторы риска_Оценка риска налого" OWNER TO postgres;

--
-- TOC entry 5075 (class 2604 OID 16970)
-- Name: accrual_status accrual_status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accrual_status ALTER COLUMN accrual_status_id SET DEFAULT nextval('public.accrual_status_accrual_status_id_seq'::regclass);


--
-- TOC entry 5076 (class 2604 OID 16971)
-- Name: card_create_source source_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_create_source ALTER COLUMN source_id SET DEFAULT nextval('public.card_create_source_source_id_seq'::regclass);


--
-- TOC entry 5077 (class 2604 OID 16972)
-- Name: check_status_type check_status_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.check_status_type ALTER COLUMN check_status_type_id SET DEFAULT nextval('public.check_status_type_check_status_type_id_seq'::regclass);


--
-- TOC entry 5078 (class 2604 OID 16973)
-- Name: contact_data contact_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_data ALTER COLUMN contact_id SET DEFAULT nextval('public.contact_data_contact_id_seq'::regclass);


--
-- TOC entry 5079 (class 2604 OID 16974)
-- Name: contact_type type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_type ALTER COLUMN type_id SET DEFAULT nextval('public.contant_type_type_id_seq'::regclass);


--
-- TOC entry 5080 (class 2604 OID 16975)
-- Name: declaration_status declaration_status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.declaration_status ALTER COLUMN declaration_status_id SET DEFAULT nextval('public.declaration_status_declaration_status_id_seq'::regclass);


--
-- TOC entry 5081 (class 2604 OID 16976)
-- Name: document document_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document ALTER COLUMN document_id SET DEFAULT nextval('public.document_document_id_seq'::regclass);


--
-- TOC entry 5082 (class 2604 OID 16977)
-- Name: document_type document_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_type ALTER COLUMN document_type_id SET DEFAULT nextval('public.document_type_document_type_id_seq'::regclass);


--
-- TOC entry 5083 (class 2604 OID 16978)
-- Name: identified_violation violation_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identified_violation ALTER COLUMN violation_id SET DEFAULT nextval('public.identified_violation_violation_id_seq'::regclass);


--
-- TOC entry 5084 (class 2604 OID 16979)
-- Name: inspection inspection_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection ALTER COLUMN inspection_id SET DEFAULT nextval('public.inspection_inspection_id_seq'::regclass);


--
-- TOC entry 5085 (class 2604 OID 16980)
-- Name: inspection_base inspection_base_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection_base ALTER COLUMN inspection_base_id SET DEFAULT nextval('public.inspection_base_inspection_base_id_seq'::regclass);


--
-- TOC entry 5086 (class 2604 OID 16981)
-- Name: inspection_base inspection_base_name; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection_base ALTER COLUMN inspection_base_name SET DEFAULT nextval('public.inspection_base_inspection_base_name_seq'::regclass);


--
-- TOC entry 5087 (class 2604 OID 16982)
-- Name: inspection_type inspection_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection_type ALTER COLUMN inspection_type_id SET DEFAULT nextval('public.inspection_type_inspection_type_id_seq'::regclass);


--
-- TOC entry 5088 (class 2604 OID 16983)
-- Name: kbk kbk_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kbk ALTER COLUMN kbk_id SET DEFAULT nextval('public.kbk_kbk_id_seq'::regclass);


--
-- TOC entry 5089 (class 2604 OID 16984)
-- Name: object_ownership ownership_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.object_ownership ALTER COLUMN ownership_id SET DEFAULT nextval('public.object_ownership_ownership_id_seq'::regclass);


--
-- TOC entry 5090 (class 2604 OID 16985)
-- Name: object_type object_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.object_type ALTER COLUMN object_type_id SET DEFAULT nextval('public.object_type_object_type_id_seq'::regclass);


--
-- TOC entry 5091 (class 2604 OID 16986)
-- Name: okved okved_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.okved ALTER COLUMN okved_id SET DEFAULT nextval('public.okved_okved_id_seq'::regclass);


--
-- TOC entry 5092 (class 2604 OID 16987)
-- Name: opf opf_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opf ALTER COLUMN opf_id SET DEFAULT nextval('public.opf_opf_id_seq'::regclass);


--
-- TOC entry 5093 (class 2604 OID 16988)
-- Name: period_type type_period_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.period_type ALTER COLUMN type_period_id SET DEFAULT nextval('public.period_type_type_period_id_seq'::regclass);


--
-- TOC entry 5094 (class 2604 OID 16989)
-- Name: real_estate_type real_estate_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.real_estate_type ALTER COLUMN real_estate_type_id SET DEFAULT nextval('public.real_estate_type_real_estate_type_id_seq'::regclass);


--
-- TOC entry 5095 (class 2604 OID 16990)
-- Name: reduce_base reduce_base_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reduce_base ALTER COLUMN reduce_base_id SET DEFAULT nextval('public.reduce_base_reduce_base_id_seq'::regclass);


--
-- TOC entry 5096 (class 2604 OID 16991)
-- Name: reduce_type reduce_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reduce_type ALTER COLUMN reduce_type_id SET DEFAULT nextval('public.reduce_type_reduce_type_id_seq'::regclass);


--
-- TOC entry 5097 (class 2604 OID 16992)
-- Name: region region_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region ALTER COLUMN region_id SET DEFAULT nextval('public.region_region_id_seq'::regclass);


--
-- TOC entry 5098 (class 2604 OID 16993)
-- Name: report_status report_status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_status ALTER COLUMN report_status_id SET DEFAULT nextval('public.report_status_report_status_id_seq'::regclass);


--
-- TOC entry 5099 (class 2604 OID 16994)
-- Name: risk_factor risk_factor_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_factor ALTER COLUMN risk_factor_id SET DEFAULT nextval('public.risk_factor_risk_factor_id_seq'::regclass);


--
-- TOC entry 5100 (class 2604 OID 16995)
-- Name: role role_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role ALTER COLUMN role_id SET DEFAULT nextval('public.role_role_id_seq'::regclass);


--
-- TOC entry 5101 (class 2604 OID 16996)
-- Name: tax_accrual tax_accrual_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_accrual ALTER COLUMN tax_accrual_id SET DEFAULT nextval('public.tax_accrual_tax_accrual_id_seq'::regclass);


--
-- TOC entry 5102 (class 2604 OID 16997)
-- Name: tax_declaration declaration_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_declaration ALTER COLUMN declaration_id SET DEFAULT nextval('public.tax_declaration_declaration_id_seq'::regclass);


--
-- TOC entry 5103 (class 2604 OID 16998)
-- Name: tax_officer tax_officer_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_officer ALTER COLUMN tax_officer_id SET DEFAULT nextval('public.tax_officer_tax_officer_id_seq'::regclass);


--
-- TOC entry 5104 (class 2604 OID 16999)
-- Name: tax_payment payment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_payment ALTER COLUMN payment_id SET DEFAULT nextval('public.tax_payment_payment_id_seq'::regclass);


--
-- TOC entry 5105 (class 2604 OID 17000)
-- Name: tax_period period_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_period ALTER COLUMN period_id SET DEFAULT nextval('public.tax_period_period_id_seq'::regclass);


--
-- TOC entry 5106 (class 2604 OID 17001)
-- Name: tax_reduce_request request_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_reduce_request ALTER COLUMN request_id SET DEFAULT nextval('public.tax_reduce_request_request_id_seq'::regclass);


--
-- TOC entry 5107 (class 2604 OID 17002)
-- Name: tax_regime regime_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_regime ALTER COLUMN regime_id SET DEFAULT nextval('public.tax_regime_regime_id_seq'::regclass);


--
-- TOC entry 5108 (class 2604 OID 17003)
-- Name: tax_type tax_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_type ALTER COLUMN tax_type_id SET DEFAULT nextval('public.tax_type_tax_type_id_seq'::regclass);


--
-- TOC entry 5109 (class 2604 OID 17004)
-- Name: taxable_object object_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxable_object ALTER COLUMN object_id SET DEFAULT nextval('public.taxable_object_object_id_seq'::regclass);


--
-- TOC entry 5110 (class 2604 OID 17005)
-- Name: taxpayer taxpayer_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer ALTER COLUMN taxpayer_id SET DEFAULT nextval('public.taxpayer_taxpayer_id_seq'::regclass);


--
-- TOC entry 5111 (class 2604 OID 17006)
-- Name: taxpayer_rating rating_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer_rating ALTER COLUMN rating_id SET DEFAULT nextval('public.taxpayer_rating_rating_id_seq'::regclass);


--
-- TOC entry 5112 (class 2604 OID 17007)
-- Name: taxpayer_status status_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer_status ALTER COLUMN status_id SET DEFAULT nextval('public.taxpayer_status_status_id_seq'::regclass);


--
-- TOC entry 5113 (class 2604 OID 17008)
-- Name: taxpayer_type id_taxpayer_type; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer_type ALTER COLUMN id_taxpayer_type SET DEFAULT nextval('public.taxpayer_type_id_taxpayer_type_seq'::regclass);


--
-- TOC entry 5114 (class 2604 OID 17009)
-- Name: violation_type violation_type_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.violation_type ALTER COLUMN violation_type_id SET DEFAULT nextval('public.violation_type_violation_type_id_seq'::regclass);


--
-- TOC entry 5218 (class 2606 OID 17011)
-- Name: taxpayer Unique_Identifier1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer
    ADD CONSTRAINT "Unique_Identifier1" PRIMARY KEY (taxpayer_id);


--
-- TOC entry 5125 (class 2606 OID 17013)
-- Name: contact_data Unique_Identifier10; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_data
    ADD CONSTRAINT "Unique_Identifier10" PRIMARY KEY (contact_id);


--
-- TOC entry 5127 (class 2606 OID 17015)
-- Name: contact_type Unique_Identifier11; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_type
    ADD CONSTRAINT "Unique_Identifier11" PRIMARY KEY (type_id);


--
-- TOC entry 5195 (class 2606 OID 17017)
-- Name: tax_period Unique_Identifier12; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_period
    ADD CONSTRAINT "Unique_Identifier12" PRIMARY KEY (period_id);


--
-- TOC entry 5160 (class 2606 OID 17019)
-- Name: period_type Unique_Identifier13; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.period_type
    ADD CONSTRAINT "Unique_Identifier13" PRIMARY KEY (type_period_id);


--
-- TOC entry 5186 (class 2606 OID 17021)
-- Name: tax_declaration Unique_Identifier14; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_declaration
    ADD CONSTRAINT "Unique_Identifier14" PRIMARY KEY (declaration_id);


--
-- TOC entry 5134 (class 2606 OID 17023)
-- Name: document_type Unique_Identifier15; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_type
    ADD CONSTRAINT "Unique_Identifier15" PRIMARY KEY (document_type_id);


--
-- TOC entry 5206 (class 2606 OID 17025)
-- Name: tax_type Unique_Identifier16; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_type
    ADD CONSTRAINT "Unique_Identifier16" PRIMARY KEY (tax_type_id);


--
-- TOC entry 5129 (class 2606 OID 17027)
-- Name: declaration_status Unique_Identifier17; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.declaration_status
    ADD CONSTRAINT "Unique_Identifier17" PRIMARY KEY (declaration_status_id);


--
-- TOC entry 5180 (class 2606 OID 17029)
-- Name: tax_accrual Unique_Identifier18; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_accrual
    ADD CONSTRAINT "Unique_Identifier18" PRIMARY KEY (tax_accrual_id);


--
-- TOC entry 5117 (class 2606 OID 17031)
-- Name: accrual_status Unique_Identifier19; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accrual_status
    ADD CONSTRAINT "Unique_Identifier19" PRIMARY KEY (accrual_status_id);


--
-- TOC entry 5225 (class 2606 OID 17033)
-- Name: taxpayer_type Unique_Identifier2; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer_type
    ADD CONSTRAINT "Unique_Identifier2" PRIMARY KEY (id_taxpayer_type);


--
-- TOC entry 5210 (class 2606 OID 17035)
-- Name: taxable_object Unique_Identifier20; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxable_object
    ADD CONSTRAINT "Unique_Identifier20" PRIMARY KEY (object_id);


--
-- TOC entry 5154 (class 2606 OID 17037)
-- Name: object_type Unique_Identifier21; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.object_type
    ADD CONSTRAINT "Unique_Identifier21" PRIMARY KEY (object_type_id);


--
-- TOC entry 5152 (class 2606 OID 17039)
-- Name: object_ownership Unique_Identifier22; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.object_ownership
    ADD CONSTRAINT "Unique_Identifier22" PRIMARY KEY (ownership_id, taxpayer_id, object_id);


--
-- TOC entry 5192 (class 2606 OID 17041)
-- Name: tax_payment Unique_Identifier23; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_payment
    ADD CONSTRAINT "Unique_Identifier23" PRIMARY KEY (payment_id, tax_income_id);


--
-- TOC entry 5202 (class 2606 OID 17043)
-- Name: tax_reduce_request Unique_Identifier24; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_reduce_request
    ADD CONSTRAINT "Unique_Identifier24" PRIMARY KEY (request_id);


--
-- TOC entry 5164 (class 2606 OID 17045)
-- Name: reduce_base Unique_Identifier25; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reduce_base
    ADD CONSTRAINT "Unique_Identifier25" PRIMARY KEY (reduce_base_id);


--
-- TOC entry 5170 (class 2606 OID 17047)
-- Name: report_status Unique_Identifier26; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_status
    ADD CONSTRAINT "Unique_Identifier26" PRIMARY KEY (report_status_id);


--
-- TOC entry 5221 (class 2606 OID 17049)
-- Name: taxpayer_rating Unique_Identifier27; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer_rating
    ADD CONSTRAINT "Unique_Identifier27" PRIMARY KEY (rating_id);


--
-- TOC entry 5172 (class 2606 OID 17051)
-- Name: risk_factor Unique_Identifier28; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_factor
    ADD CONSTRAINT "Unique_Identifier28" PRIMARY KEY (risk_factor_id);


--
-- TOC entry 5144 (class 2606 OID 17053)
-- Name: inspection Unique_Identifier29; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT "Unique_Identifier29" PRIMARY KEY (inspection_id);


--
-- TOC entry 5119 (class 2606 OID 17055)
-- Name: card_create_source Unique_Identifier3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_create_source
    ADD CONSTRAINT "Unique_Identifier3" PRIMARY KEY (source_id);


--
-- TOC entry 5150 (class 2606 OID 17057)
-- Name: kbk Unique_Identifier30; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kbk
    ADD CONSTRAINT "Unique_Identifier30" PRIMARY KEY (kbk_id);


--
-- TOC entry 5189 (class 2606 OID 17059)
-- Name: tax_officer Unique_Identifier31; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_officer
    ADD CONSTRAINT "Unique_Identifier31" PRIMARY KEY (tax_officer_id);


--
-- TOC entry 5174 (class 2606 OID 17061)
-- Name: role Unique_Identifier32; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT "Unique_Identifier32" PRIMARY KEY (role_id);


--
-- TOC entry 5148 (class 2606 OID 17063)
-- Name: inspection_type Unique_Identifier33; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection_type
    ADD CONSTRAINT "Unique_Identifier33" PRIMARY KEY (inspection_type_id);


--
-- TOC entry 5162 (class 2606 OID 17065)
-- Name: real_estate_type Unique_Identifier34; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.real_estate_type
    ADD CONSTRAINT "Unique_Identifier34" PRIMARY KEY (real_estate_type_id);


--
-- TOC entry 5166 (class 2606 OID 17067)
-- Name: reduce_type Unique_Identifier35; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reduce_type
    ADD CONSTRAINT "Unique_Identifier35" PRIMARY KEY (reduce_type_id);


--
-- TOC entry 5146 (class 2606 OID 17069)
-- Name: inspection_base Unique_Identifier36; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection_base
    ADD CONSTRAINT "Unique_Identifier36" PRIMARY KEY (inspection_base_id);


--
-- TOC entry 5138 (class 2606 OID 17071)
-- Name: identified_violation Unique_Identifier37; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identified_violation
    ADD CONSTRAINT "Unique_Identifier37" PRIMARY KEY (violation_id, inspection_id);


--
-- TOC entry 5227 (class 2606 OID 17073)
-- Name: violation_type Unique_Identifier38; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.violation_type
    ADD CONSTRAINT "Unique_Identifier38" PRIMARY KEY (violation_type_id);


--
-- TOC entry 5121 (class 2606 OID 17075)
-- Name: check_status_type Unique_Identifier39; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.check_status_type
    ADD CONSTRAINT "Unique_Identifier39" PRIMARY KEY (check_status_type_id);


--
-- TOC entry 5223 (class 2606 OID 17077)
-- Name: taxpayer_status Unique_Identifier4; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer_status
    ADD CONSTRAINT "Unique_Identifier4" PRIMARY KEY (status_id);


--
-- TOC entry 5168 (class 2606 OID 17079)
-- Name: region Unique_Identifier5; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.region
    ADD CONSTRAINT "Unique_Identifier5" PRIMARY KEY (region_id);


--
-- TOC entry 5132 (class 2606 OID 17081)
-- Name: document Unique_Identifier6; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT "Unique_Identifier6" PRIMARY KEY (document_id, "Ключ налогоплательщика");


--
-- TOC entry 5158 (class 2606 OID 17083)
-- Name: opf Unique_Identifier7; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.opf
    ADD CONSTRAINT "Unique_Identifier7" PRIMARY KEY (opf_id);


--
-- TOC entry 5204 (class 2606 OID 17085)
-- Name: tax_regime Unique_Identifier8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_regime
    ADD CONSTRAINT "Unique_Identifier8" PRIMARY KEY (regime_id);


--
-- TOC entry 5156 (class 2606 OID 17087)
-- Name: okved Unique_Identifier9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.okved
    ADD CONSTRAINT "Unique_Identifier9" PRIMARY KEY (okved_id);


--
-- TOC entry 5278 (class 2606 OID 24907)
-- Name: account_emailaddress account_emailaddress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_emailaddress
    ADD CONSTRAINT account_emailaddress_pkey PRIMARY KEY (id);


--
-- TOC entry 5281 (class 2606 OID 24936)
-- Name: account_emailaddress account_emailaddress_user_id_email_987c8728_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_emailaddress
    ADD CONSTRAINT account_emailaddress_user_id_email_987c8728_uniq UNIQUE (user_id, email);


--
-- TOC entry 5287 (class 2606 OID 24917)
-- Name: account_emailconfirmation account_emailconfirmation_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_emailconfirmation
    ADD CONSTRAINT account_emailconfirmation_key_key UNIQUE (key);


--
-- TOC entry 5289 (class 2606 OID 24915)
-- Name: account_emailconfirmation account_emailconfirmation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_emailconfirmation
    ADD CONSTRAINT account_emailconfirmation_pkey PRIMARY KEY (id);


--
-- TOC entry 5241 (class 2606 OID 17466)
-- Name: auth_group auth_group_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_name_key UNIQUE (name);


--
-- TOC entry 5246 (class 2606 OID 17397)
-- Name: auth_group_permissions auth_group_permissions_group_id_permission_id_0cd325b0_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_permission_id_0cd325b0_uniq UNIQUE (group_id, permission_id);


--
-- TOC entry 5249 (class 2606 OID 17366)
-- Name: auth_group_permissions auth_group_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 5243 (class 2606 OID 17358)
-- Name: auth_group auth_group_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_pkey PRIMARY KEY (id);


--
-- TOC entry 5236 (class 2606 OID 17388)
-- Name: auth_permission auth_permission_content_type_id_codename_01ab375a_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_codename_01ab375a_uniq UNIQUE (content_type_id, codename);


--
-- TOC entry 5238 (class 2606 OID 17352)
-- Name: auth_permission auth_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_pkey PRIMARY KEY (id);


--
-- TOC entry 5257 (class 2606 OID 17380)
-- Name: auth_user_groups auth_user_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user_groups
    ADD CONSTRAINT auth_user_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 5260 (class 2606 OID 17412)
-- Name: auth_user_groups auth_user_groups_user_id_group_id_94350c0c_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user_groups
    ADD CONSTRAINT auth_user_groups_user_id_group_id_94350c0c_uniq UNIQUE (user_id, group_id);


--
-- TOC entry 5251 (class 2606 OID 17372)
-- Name: auth_user auth_user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user
    ADD CONSTRAINT auth_user_pkey PRIMARY KEY (id);


--
-- TOC entry 5263 (class 2606 OID 17386)
-- Name: auth_user_user_permissions auth_user_user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user_user_permissions
    ADD CONSTRAINT auth_user_user_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 5266 (class 2606 OID 17426)
-- Name: auth_user_user_permissions auth_user_user_permissions_user_id_permission_id_14a6b632_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user_user_permissions
    ADD CONSTRAINT auth_user_user_permissions_user_id_permission_id_14a6b632_uniq UNIQUE (user_id, permission_id);


--
-- TOC entry 5254 (class 2606 OID 17461)
-- Name: auth_user auth_user_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user
    ADD CONSTRAINT auth_user_username_key UNIQUE (username);


--
-- TOC entry 5292 (class 2606 OID 24946)
-- Name: authtoken_token authtoken_token_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authtoken_token
    ADD CONSTRAINT authtoken_token_pkey PRIMARY KEY (key);


--
-- TOC entry 5294 (class 2606 OID 24948)
-- Name: authtoken_token authtoken_token_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authtoken_token
    ADD CONSTRAINT authtoken_token_user_id_key UNIQUE (user_id);


--
-- TOC entry 5269 (class 2606 OID 17447)
-- Name: django_admin_log django_admin_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5231 (class 2606 OID 17346)
-- Name: django_content_type django_content_type_app_label_model_76bd3d3b_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_app_label_model_76bd3d3b_uniq UNIQUE (app_label, model);


--
-- TOC entry 5233 (class 2606 OID 17344)
-- Name: django_content_type django_content_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_pkey PRIMARY KEY (id);


--
-- TOC entry 5229 (class 2606 OID 17338)
-- Name: django_migrations django_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_migrations
    ADD CONSTRAINT django_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 5273 (class 2606 OID 17474)
-- Name: django_session django_session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_session
    ADD CONSTRAINT django_session_pkey PRIMARY KEY (session_key);


--
-- TOC entry 5297 (class 2606 OID 24962)
-- Name: django_site django_site_domain_a2e37b91_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_site
    ADD CONSTRAINT django_site_domain_a2e37b91_uniq UNIQUE (domain);


--
-- TOC entry 5299 (class 2606 OID 24960)
-- Name: django_site django_site_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_site
    ADD CONSTRAINT django_site_pkey PRIMARY KEY (id);


--
-- TOC entry 5301 (class 2606 OID 24971)
-- Name: socialaccount_socialaccount socialaccount_socialaccount_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialaccount
    ADD CONSTRAINT socialaccount_socialaccount_pkey PRIMARY KEY (id);


--
-- TOC entry 5303 (class 2606 OID 25033)
-- Name: socialaccount_socialaccount socialaccount_socialaccount_provider_uid_fc810c6e_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialaccount
    ADD CONSTRAINT socialaccount_socialaccount_provider_uid_fc810c6e_uniq UNIQUE (provider, uid);


--
-- TOC entry 5308 (class 2606 OID 25003)
-- Name: socialaccount_socialapp_sites socialaccount_socialapp__socialapp_id_site_id_71a9a768_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialapp_sites
    ADD CONSTRAINT socialaccount_socialapp__socialapp_id_site_id_71a9a768_uniq UNIQUE (socialapp_id, site_id);


--
-- TOC entry 5306 (class 2606 OID 24977)
-- Name: socialaccount_socialapp socialaccount_socialapp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialapp
    ADD CONSTRAINT socialaccount_socialapp_pkey PRIMARY KEY (id);


--
-- TOC entry 5310 (class 2606 OID 24983)
-- Name: socialaccount_socialapp_sites socialaccount_socialapp_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialapp_sites
    ADD CONSTRAINT socialaccount_socialapp_sites_pkey PRIMARY KEY (id);


--
-- TOC entry 5316 (class 2606 OID 24993)
-- Name: socialaccount_socialtoken socialaccount_socialtoken_app_id_account_id_fca4e0ac_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialtoken
    ADD CONSTRAINT socialaccount_socialtoken_app_id_account_id_fca4e0ac_uniq UNIQUE (app_id, account_id);


--
-- TOC entry 5318 (class 2606 OID 24991)
-- Name: socialaccount_socialtoken socialaccount_socialtoken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialtoken
    ADD CONSTRAINT socialaccount_socialtoken_pkey PRIMARY KEY (id);


--
-- TOC entry 5320 (class 2606 OID 25086)
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_pkey PRIMARY KEY (id);


--
-- TOC entry 5322 (class 2606 OID 25107)
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_token_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_token_id_key UNIQUE (token_id);


--
-- TOC entry 5325 (class 2606 OID 25077)
-- Name: token_blacklist_outstandingtoken token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken
    ADD CONSTRAINT token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq UNIQUE (jti);


--
-- TOC entry 5327 (class 2606 OID 25095)
-- Name: token_blacklist_outstandingtoken token_blacklist_outstandingtoken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken
    ADD CONSTRAINT token_blacklist_outstandingtoken_pkey PRIMARY KEY (id);


--
-- TOC entry 5219 (class 1259 OID 17088)
-- Name: IX_имеет312; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_имеет312" ON public.taxpayer_rating USING btree (taxpayer_id);


--
-- TOC entry 5211 (class 1259 OID 17089)
-- Name: IX_имеется1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_имеется1" ON public.taxpayer USING btree (payer_status_id);


--
-- TOC entry 5212 (class 1259 OID 17090)
-- Name: IX_имеется2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_имеется2" ON public.taxpayer USING btree (tax_regime_id);


--
-- TOC entry 5213 (class 1259 OID 17091)
-- Name: IX_имеется3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_имеется3" ON public.taxpayer USING btree (payer_type_id);


--
-- TOC entry 5214 (class 1259 OID 17092)
-- Name: IX_имеется4; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_имеется4" ON public.taxpayer USING btree (origin_id);


--
-- TOC entry 5122 (class 1259 OID 17093)
-- Name: IX_имеются; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_имеются" ON public.contact_data USING btree (taxpayer_id);


--
-- TOC entry 5181 (class 1259 OID 17094)
-- Name: IX_кто подает; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_кто подает" ON public.tax_declaration USING btree (taxpayer_id);


--
-- TOC entry 5175 (class 1259 OID 17095)
-- Name: IX_на что начисляют (доход); Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_на что начисляют (доход)" ON public.tax_accrual USING btree (declaration_id);


--
-- TOC entry 5176 (class 1259 OID 17096)
-- Name: IX_на что начисляют (объект); Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_на что начисляют (объект)" ON public.tax_accrual USING btree (ownership_id, taxpayer_id, object_id);


--
-- TOC entry 5139 (class 1259 OID 17097)
-- Name: IX_объясняет; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_объясняет" ON public.inspection USING btree (inspection_reason);


--
-- TOC entry 5123 (class 1259 OID 17098)
-- Name: IX_определяет; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет" ON public.contact_data USING btree (contact_type_id);


--
-- TOC entry 5207 (class 1259 OID 17099)
-- Name: IX_определяет (недвижимость); Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет (недвижимость)" ON public.taxable_object USING btree (real_estate_type_id);


--
-- TOC entry 5135 (class 1259 OID 17100)
-- Name: IX_определяет когда; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет когда" ON public.identified_violation USING btree (period_id);


--
-- TOC entry 5215 (class 1259 OID 17101)
-- Name: IX_определяет местонахождение; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет местонахождение" ON public.taxpayer USING btree (region_key);


--
-- TOC entry 5177 (class 1259 OID 17102)
-- Name: IX_определяет статус; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет статус" ON public.tax_accrual USING btree (income_status_id);


--
-- TOC entry 5182 (class 1259 OID 17103)
-- Name: IX_определяет текущий статус; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет текущий статус" ON public.tax_declaration USING btree (declaration_status_id);


--
-- TOC entry 5136 (class 1259 OID 17104)
-- Name: IX_определяет1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет1" ON public.identified_violation USING btree (violation_type_id);


--
-- TOC entry 5193 (class 1259 OID 17105)
-- Name: IX_определяет10; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет10" ON public.tax_period USING btree (period_type_id);


--
-- TOC entry 5216 (class 1259 OID 17106)
-- Name: IX_определяет11; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет11" ON public.taxpayer USING btree (opf_id);


--
-- TOC entry 5140 (class 1259 OID 17107)
-- Name: IX_определяет2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет2" ON public.inspection USING btree (inspection_type_id);


--
-- TOC entry 5141 (class 1259 OID 17108)
-- Name: IX_определяет3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет3" ON public.inspection USING btree (inspection_type_status_id);


--
-- TOC entry 5130 (class 1259 OID 17109)
-- Name: IX_определяет4; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет4" ON public.document USING btree ("Ключ типа документа");


--
-- TOC entry 5196 (class 1259 OID 17110)
-- Name: IX_определяет4324; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет4324" ON public.tax_reduce_request USING btree (reduce_base_id);


--
-- TOC entry 5208 (class 1259 OID 17111)
-- Name: IX_определяет5; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет5" ON public.taxable_object USING btree (object_type_id);


--
-- TOC entry 5190 (class 1259 OID 17112)
-- Name: IX_определяет6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет6" ON public.tax_payment USING btree (kbk_id);


--
-- TOC entry 5178 (class 1259 OID 17113)
-- Name: IX_определяет7; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет7" ON public.tax_accrual USING btree (tax_type_id);


--
-- TOC entry 5183 (class 1259 OID 17114)
-- Name: IX_определяет8; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет8" ON public.tax_declaration USING btree (period_id);


--
-- TOC entry 5184 (class 1259 OID 17115)
-- Name: IX_определяет9; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_определяет9" ON public.tax_declaration USING btree (tax_type_id);


--
-- TOC entry 5197 (class 1259 OID 17116)
-- Name: IX_подает; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_подает" ON public.tax_reduce_request USING btree (taxpayer_id);


--
-- TOC entry 5142 (class 1259 OID 17117)
-- Name: IX_проверяется; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_проверяется" ON public.inspection USING btree (taxpayer_id);


--
-- TOC entry 5198 (class 1259 OID 17118)
-- Name: IX_рассматривает; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_рассматривает" ON public.tax_reduce_request USING btree ("Ключ сотрудника");


--
-- TOC entry 5199 (class 1259 OID 17119)
-- Name: IX_характеризует1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_характеризует1" ON public.tax_reduce_request USING btree ("Ключ типа снижения");


--
-- TOC entry 5200 (class 1259 OID 17120)
-- Name: IX_характеризует2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_характеризует2" ON public.tax_reduce_request USING btree (request_status_id);


--
-- TOC entry 5187 (class 1259 OID 17121)
-- Name: IX_характеризует312; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IX_характеризует312" ON public.tax_officer USING btree (role_id);


--
-- TOC entry 5275 (class 1259 OID 24939)
-- Name: account_emailaddress_email_03be32b2; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX account_emailaddress_email_03be32b2 ON public.account_emailaddress USING btree (email);


--
-- TOC entry 5276 (class 1259 OID 24940)
-- Name: account_emailaddress_email_03be32b2_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX account_emailaddress_email_03be32b2_like ON public.account_emailaddress USING btree (email varchar_pattern_ops);


--
-- TOC entry 5279 (class 1259 OID 24924)
-- Name: account_emailaddress_user_id_2c513194; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX account_emailaddress_user_id_2c513194 ON public.account_emailaddress USING btree (user_id);


--
-- TOC entry 5284 (class 1259 OID 24931)
-- Name: account_emailconfirmation_email_address_id_5b7f8c58; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX account_emailconfirmation_email_address_id_5b7f8c58 ON public.account_emailconfirmation USING btree (email_address_id);


--
-- TOC entry 5285 (class 1259 OID 24930)
-- Name: account_emailconfirmation_key_f43612bd_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX account_emailconfirmation_key_f43612bd_like ON public.account_emailconfirmation USING btree (key varchar_pattern_ops);


--
-- TOC entry 5239 (class 1259 OID 17467)
-- Name: auth_group_name_a6ea08ec_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_name_a6ea08ec_like ON public.auth_group USING btree (name varchar_pattern_ops);


--
-- TOC entry 5244 (class 1259 OID 17408)
-- Name: auth_group_permissions_group_id_b120cbf9; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_permissions_group_id_b120cbf9 ON public.auth_group_permissions USING btree (group_id);


--
-- TOC entry 5247 (class 1259 OID 17409)
-- Name: auth_group_permissions_permission_id_84c5c92e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_permissions_permission_id_84c5c92e ON public.auth_group_permissions USING btree (permission_id);


--
-- TOC entry 5234 (class 1259 OID 17394)
-- Name: auth_permission_content_type_id_2f476e4b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_permission_content_type_id_2f476e4b ON public.auth_permission USING btree (content_type_id);


--
-- TOC entry 5255 (class 1259 OID 17424)
-- Name: auth_user_groups_group_id_97559544; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_user_groups_group_id_97559544 ON public.auth_user_groups USING btree (group_id);


--
-- TOC entry 5258 (class 1259 OID 17423)
-- Name: auth_user_groups_user_id_6a12ed8b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_user_groups_user_id_6a12ed8b ON public.auth_user_groups USING btree (user_id);


--
-- TOC entry 5261 (class 1259 OID 17438)
-- Name: auth_user_user_permissions_permission_id_1fbb5f2c; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_user_user_permissions_permission_id_1fbb5f2c ON public.auth_user_user_permissions USING btree (permission_id);


--
-- TOC entry 5264 (class 1259 OID 17437)
-- Name: auth_user_user_permissions_user_id_a95ead1b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_user_user_permissions_user_id_a95ead1b ON public.auth_user_user_permissions USING btree (user_id);


--
-- TOC entry 5252 (class 1259 OID 17462)
-- Name: auth_user_username_6821ab7c_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_user_username_6821ab7c_like ON public.auth_user USING btree (username varchar_pattern_ops);


--
-- TOC entry 5290 (class 1259 OID 24954)
-- Name: authtoken_token_key_10f0b77e_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX authtoken_token_key_10f0b77e_like ON public.authtoken_token USING btree (key varchar_pattern_ops);


--
-- TOC entry 5267 (class 1259 OID 17458)
-- Name: django_admin_log_content_type_id_c4bce8eb; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_admin_log_content_type_id_c4bce8eb ON public.django_admin_log USING btree (content_type_id);


--
-- TOC entry 5270 (class 1259 OID 17459)
-- Name: django_admin_log_user_id_c564eba6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_admin_log_user_id_c564eba6 ON public.django_admin_log USING btree (user_id);


--
-- TOC entry 5271 (class 1259 OID 17476)
-- Name: django_session_expire_date_a5c62663; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_session_expire_date_a5c62663 ON public.django_session USING btree (expire_date);


--
-- TOC entry 5274 (class 1259 OID 17475)
-- Name: django_session_session_key_c0390e0f_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_session_session_key_c0390e0f_like ON public.django_session USING btree (session_key varchar_pattern_ops);


--
-- TOC entry 5295 (class 1259 OID 24963)
-- Name: django_site_domain_a2e37b91_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_site_domain_a2e37b91_like ON public.django_site USING btree (domain varchar_pattern_ops);


--
-- TOC entry 5304 (class 1259 OID 25001)
-- Name: socialaccount_socialaccount_user_id_8146e70c; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX socialaccount_socialaccount_user_id_8146e70c ON public.socialaccount_socialaccount USING btree (user_id);


--
-- TOC entry 5311 (class 1259 OID 25015)
-- Name: socialaccount_socialapp_sites_site_id_2579dee5; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX socialaccount_socialapp_sites_site_id_2579dee5 ON public.socialaccount_socialapp_sites USING btree (site_id);


--
-- TOC entry 5312 (class 1259 OID 25014)
-- Name: socialaccount_socialapp_sites_socialapp_id_97fb6e7d; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX socialaccount_socialapp_sites_socialapp_id_97fb6e7d ON public.socialaccount_socialapp_sites USING btree (socialapp_id);


--
-- TOC entry 5313 (class 1259 OID 25026)
-- Name: socialaccount_socialtoken_account_id_951f210e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX socialaccount_socialtoken_account_id_951f210e ON public.socialaccount_socialtoken USING btree (account_id);


--
-- TOC entry 5314 (class 1259 OID 25027)
-- Name: socialaccount_socialtoken_app_id_636a42d7; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX socialaccount_socialtoken_app_id_636a42d7 ON public.socialaccount_socialtoken USING btree (app_id);


--
-- TOC entry 5323 (class 1259 OID 25078)
-- Name: token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_like ON public.token_blacklist_outstandingtoken USING btree (jti varchar_pattern_ops);


--
-- TOC entry 5328 (class 1259 OID 25075)
-- Name: token_blacklist_outstandingtoken_user_id_83bc629a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_blacklist_outstandingtoken_user_id_83bc629a ON public.token_blacklist_outstandingtoken USING btree (user_id);


--
-- TOC entry 5282 (class 1259 OID 24941)
-- Name: unique_primary_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_primary_email ON public.account_emailaddress USING btree (user_id, "primary") WHERE "primary";


--
-- TOC entry 5283 (class 1259 OID 24937)
-- Name: unique_verified_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unique_verified_email ON public.account_emailaddress USING btree (email) WHERE verified;


--
-- TOC entry 5387 (class 2620 OID 17122)
-- Name: contact_data contact_data_validation_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER contact_data_validation_trigger BEFORE INSERT OR UPDATE ON public.contact_data FOR EACH ROW EXECUTE FUNCTION public.validate_contact_data();


--
-- TOC entry 5398 (class 2620 OID 17123)
-- Name: taxpayer taxpayer_requisites_validation_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER taxpayer_requisites_validation_trigger BEFORE INSERT OR UPDATE ON public.taxpayer FOR EACH ROW EXECUTE FUNCTION public.validate_taxpayer_requisites();


--
-- TOC entry 5395 (class 2620 OID 17124)
-- Name: tax_declaration trigger_tax_accrual_on_declaration_accept; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_tax_accrual_on_declaration_accept AFTER UPDATE ON public.tax_declaration FOR EACH ROW EXECUTE FUNCTION public.create_tax_accrual_on_declaration_accept();


--
-- TOC entry 5393 (class 2620 OID 17125)
-- Name: tax_accrual update_risk_after_accrual; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_risk_after_accrual AFTER INSERT OR DELETE OR UPDATE ON public.tax_accrual FOR EACH ROW EXECUTE FUNCTION public.update_risk_score();


--
-- TOC entry 5390 (class 2620 OID 17126)
-- Name: inspection update_risk_after_inspection; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_risk_after_inspection AFTER INSERT OR DELETE OR UPDATE ON public.inspection FOR EACH ROW EXECUTE FUNCTION public.update_risk_score();


--
-- TOC entry 5396 (class 2620 OID 17127)
-- Name: tax_payment update_risk_after_payment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_risk_after_payment AFTER INSERT OR DELETE OR UPDATE ON public.tax_payment FOR EACH ROW EXECUTE FUNCTION public.update_risk_score();


--
-- TOC entry 5389 (class 2620 OID 17128)
-- Name: identified_violation update_risk_after_violation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_risk_after_violation AFTER INSERT OR DELETE OR UPDATE ON public.identified_violation FOR EACH ROW EXECUTE FUNCTION public.update_risk_score();


--
-- TOC entry 5388 (class 2620 OID 17129)
-- Name: document validate_document_dates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER validate_document_dates BEFORE INSERT OR UPDATE ON public.document FOR EACH ROW EXECUTE FUNCTION public.validate_dates();


--
-- TOC entry 5391 (class 2620 OID 17130)
-- Name: inspection validate_inspection_dates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER validate_inspection_dates BEFORE INSERT OR UPDATE ON public.inspection FOR EACH ROW EXECUTE FUNCTION public.validate_dates();


--
-- TOC entry 5392 (class 2620 OID 17131)
-- Name: object_ownership validate_object_ownership_dates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER validate_object_ownership_dates BEFORE INSERT OR UPDATE ON public.object_ownership FOR EACH ROW EXECUTE FUNCTION public.validate_dates();


--
-- TOC entry 5394 (class 2620 OID 17132)
-- Name: tax_accrual validate_tax_accrual_dates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER validate_tax_accrual_dates BEFORE INSERT OR UPDATE ON public.tax_accrual FOR EACH ROW EXECUTE FUNCTION public.validate_dates();


--
-- TOC entry 5397 (class 2620 OID 17133)
-- Name: tax_period validate_tax_period_dates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER validate_tax_period_dates BEFORE INSERT OR UPDATE ON public.tax_period FOR EACH ROW EXECUTE FUNCTION public.validate_dates();


--
-- TOC entry 5399 (class 2620 OID 17134)
-- Name: taxpayer validate_taxpayer_dates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER validate_taxpayer_dates BEFORE INSERT OR UPDATE ON public.taxpayer FOR EACH ROW EXECUTE FUNCTION public.validate_dates();


--
-- TOC entry 5377 (class 2606 OID 24918)
-- Name: account_emailaddress account_emailaddress_user_id_2c513194_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_emailaddress
    ADD CONSTRAINT account_emailaddress_user_id_2c513194_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5378 (class 2606 OID 24925)
-- Name: account_emailconfirmation account_emailconfirm_email_address_id_5b7f8c58_fk_account_e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_emailconfirmation
    ADD CONSTRAINT account_emailconfirm_email_address_id_5b7f8c58_fk_account_e FOREIGN KEY (email_address_id) REFERENCES public.account_emailaddress(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5369 (class 2606 OID 17403)
-- Name: auth_group_permissions auth_group_permissio_permission_id_84c5c92e_fk_auth_perm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissio_permission_id_84c5c92e_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5370 (class 2606 OID 17398)
-- Name: auth_group_permissions auth_group_permissions_group_id_b120cbf9_fk_auth_group_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_b120cbf9_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5368 (class 2606 OID 17389)
-- Name: auth_permission auth_permission_content_type_id_2f476e4b_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_2f476e4b_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5371 (class 2606 OID 17418)
-- Name: auth_user_groups auth_user_groups_group_id_97559544_fk_auth_group_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user_groups
    ADD CONSTRAINT auth_user_groups_group_id_97559544_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5372 (class 2606 OID 17413)
-- Name: auth_user_groups auth_user_groups_user_id_6a12ed8b_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user_groups
    ADD CONSTRAINT auth_user_groups_user_id_6a12ed8b_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5373 (class 2606 OID 17432)
-- Name: auth_user_user_permissions auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user_user_permissions
    ADD CONSTRAINT auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5374 (class 2606 OID 17427)
-- Name: auth_user_user_permissions auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_user_user_permissions
    ADD CONSTRAINT auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5379 (class 2606 OID 24949)
-- Name: authtoken_token authtoken_token_user_id_35299eff_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authtoken_token
    ADD CONSTRAINT authtoken_token_user_id_35299eff_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5361 (class 2606 OID 17135)
-- Name: taxpayer determine1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer
    ADD CONSTRAINT determine1 FOREIGN KEY (opf_id) REFERENCES public.opf(opf_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5336 (class 2606 OID 17140)
-- Name: inspection determine10; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT determine10 FOREIGN KEY (inspection_type_id) REFERENCES public.inspection_type(inspection_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5353 (class 2606 OID 17145)
-- Name: tax_period determine11; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_period
    ADD CONSTRAINT determine11 FOREIGN KEY (period_type_id) REFERENCES public.period_type(type_period_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5333 (class 2606 OID 17150)
-- Name: identified_violation determine12; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identified_violation
    ADD CONSTRAINT determine12 FOREIGN KEY (violation_type_id) REFERENCES public.violation_type(violation_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5337 (class 2606 OID 17155)
-- Name: inspection determine13; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT determine13 FOREIGN KEY (inspection_type_status_id) REFERENCES public.check_status_type(check_status_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5329 (class 2606 OID 17160)
-- Name: contact_data determine2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_data
    ADD CONSTRAINT determine2 FOREIGN KEY (contact_type_id) REFERENCES public.contact_type(type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5331 (class 2606 OID 17165)
-- Name: document determine3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT determine3 FOREIGN KEY ("Ключ типа документа") REFERENCES public.document_type(document_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5346 (class 2606 OID 17170)
-- Name: tax_declaration determine4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_declaration
    ADD CONSTRAINT determine4 FOREIGN KEY (period_id) REFERENCES public.tax_period(period_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5347 (class 2606 OID 17175)
-- Name: tax_declaration determine5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_declaration
    ADD CONSTRAINT determine5 FOREIGN KEY (tax_type_id) REFERENCES public.tax_type(tax_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5342 (class 2606 OID 17180)
-- Name: tax_accrual determine6; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_accrual
    ADD CONSTRAINT determine6 FOREIGN KEY (tax_type_id) REFERENCES public.tax_type(tax_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5359 (class 2606 OID 17185)
-- Name: taxable_object determine7; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxable_object
    ADD CONSTRAINT determine7 FOREIGN KEY (object_type_id) REFERENCES public.object_type(object_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5354 (class 2606 OID 17190)
-- Name: tax_reduce_request determine8; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_reduce_request
    ADD CONSTRAINT determine8 FOREIGN KEY (reduce_base_id) REFERENCES public.reduce_base(reduce_base_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5351 (class 2606 OID 17195)
-- Name: tax_payment determine9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_payment
    ADD CONSTRAINT determine9 FOREIGN KEY (kbk_id) REFERENCES public.kbk(kbk_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5375 (class 2606 OID 17448)
-- Name: django_admin_log django_admin_log_content_type_id_c4bce8eb_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_content_type_id_c4bce8eb_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5376 (class 2606 OID 17453)
-- Name: django_admin_log django_admin_log_user_id_c564eba6_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_user_id_c564eba6_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5367 (class 2606 OID 17200)
-- Name: taxpayer_rating has1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer_rating
    ADD CONSTRAINT has1 FOREIGN KEY (taxpayer_id) REFERENCES public.taxpayer(taxpayer_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5332 (class 2606 OID 17205)
-- Name: document has2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT has2 FOREIGN KEY ("Ключ налогоплательщика") REFERENCES public.taxpayer(taxpayer_id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- TOC entry 5362 (class 2606 OID 17210)
-- Name: taxpayer has3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer
    ADD CONSTRAINT has3 FOREIGN KEY (payer_status_id) REFERENCES public.taxpayer_status(status_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5363 (class 2606 OID 17215)
-- Name: taxpayer has4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer
    ADD CONSTRAINT has4 FOREIGN KEY (tax_regime_id) REFERENCES public.tax_regime(regime_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5364 (class 2606 OID 17220)
-- Name: taxpayer has5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer
    ADD CONSTRAINT has5 FOREIGN KEY (payer_type_id) REFERENCES public.taxpayer_type(id_taxpayer_type) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5365 (class 2606 OID 17225)
-- Name: taxpayer has6; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer
    ADD CONSTRAINT has6 FOREIGN KEY (origin_id) REFERENCES public.card_create_source(source_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5330 (class 2606 OID 17230)
-- Name: contact_data has7; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_data
    ADD CONSTRAINT has7 FOREIGN KEY (taxpayer_id) REFERENCES public.taxpayer(taxpayer_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5355 (class 2606 OID 17235)
-- Name: tax_reduce_request shows1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_reduce_request
    ADD CONSTRAINT shows1 FOREIGN KEY (request_status_id) REFERENCES public.report_status(report_status_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5350 (class 2606 OID 17240)
-- Name: tax_officer shows2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_officer
    ADD CONSTRAINT shows2 FOREIGN KEY (role_id) REFERENCES public.role(role_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5356 (class 2606 OID 17245)
-- Name: tax_reduce_request shows3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_reduce_request
    ADD CONSTRAINT shows3 FOREIGN KEY ("Ключ типа снижения") REFERENCES public.reduce_type(reduce_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5334 (class 2606 OID 17250)
-- Name: identified_violation shows4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identified_violation
    ADD CONSTRAINT shows4 FOREIGN KEY (inspection_id) REFERENCES public.inspection(inspection_id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- TOC entry 5383 (class 2606 OID 25016)
-- Name: socialaccount_socialtoken socialaccount_social_account_id_951f210e_fk_socialacc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialtoken
    ADD CONSTRAINT socialaccount_social_account_id_951f210e_fk_socialacc FOREIGN KEY (account_id) REFERENCES public.socialaccount_socialaccount(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5384 (class 2606 OID 25034)
-- Name: socialaccount_socialtoken socialaccount_social_app_id_636a42d7_fk_socialacc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialtoken
    ADD CONSTRAINT socialaccount_social_app_id_636a42d7_fk_socialacc FOREIGN KEY (app_id) REFERENCES public.socialaccount_socialapp(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5381 (class 2606 OID 25009)
-- Name: socialaccount_socialapp_sites socialaccount_social_site_id_2579dee5_fk_django_si; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialapp_sites
    ADD CONSTRAINT socialaccount_social_site_id_2579dee5_fk_django_si FOREIGN KEY (site_id) REFERENCES public.django_site(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5382 (class 2606 OID 25004)
-- Name: socialaccount_socialapp_sites socialaccount_social_socialapp_id_97fb6e7d_fk_socialacc; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialapp_sites
    ADD CONSTRAINT socialaccount_social_socialapp_id_97fb6e7d_fk_socialacc FOREIGN KEY (socialapp_id) REFERENCES public.socialaccount_socialapp(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5380 (class 2606 OID 24996)
-- Name: socialaccount_socialaccount socialaccount_socialaccount_user_id_8146e70c_fk_auth_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socialaccount_socialaccount
    ADD CONSTRAINT socialaccount_socialaccount_user_id_8146e70c_fk_auth_user_id FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5385 (class 2606 OID 25113)
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk FOREIGN KEY (token_id) REFERENCES public.token_blacklist_outstandingtoken(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5386 (class 2606 OID 25079)
-- Name: token_blacklist_outstandingtoken token_blacklist_outs_user_id_83bc629a_fk_auth_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken
    ADD CONSTRAINT token_blacklist_outs_user_id_83bc629a_fk_auth_user FOREIGN KEY (user_id) REFERENCES public.auth_user(id) DEFERRABLE INITIALLY DEFERRED;


--
-- TOC entry 5340 (class 2606 OID 17255)
-- Name: object_ownership кто владеет; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.object_ownership
    ADD CONSTRAINT "кто владеет" FOREIGN KEY (taxpayer_id) REFERENCES public.taxpayer(taxpayer_id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- TOC entry 5348 (class 2606 OID 17260)
-- Name: tax_declaration кто подает; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_declaration
    ADD CONSTRAINT "кто подает" FOREIGN KEY (taxpayer_id) REFERENCES public.taxpayer(taxpayer_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5343 (class 2606 OID 17265)
-- Name: tax_accrual на что начисляют (доход); Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_accrual
    ADD CONSTRAINT "на что начисляют (доход)" FOREIGN KEY (declaration_id) REFERENCES public.tax_declaration(declaration_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5344 (class 2606 OID 17270)
-- Name: tax_accrual на что начисляют (объект); Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_accrual
    ADD CONSTRAINT "на что начисляют (объект)" FOREIGN KEY (ownership_id, taxpayer_id, object_id) REFERENCES public.object_ownership(ownership_id, taxpayer_id, object_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5338 (class 2606 OID 17275)
-- Name: inspection объясняет; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT "объясняет" FOREIGN KEY (inspection_reason) REFERENCES public.inspection_base(inspection_base_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5360 (class 2606 OID 17280)
-- Name: taxable_object определяет (недвижимость); Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxable_object
    ADD CONSTRAINT "определяет (недвижимость)" FOREIGN KEY (real_estate_type_id) REFERENCES public.real_estate_type(real_estate_type_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5335 (class 2606 OID 17285)
-- Name: identified_violation определяет когда; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identified_violation
    ADD CONSTRAINT "определяет когда" FOREIGN KEY (period_id) REFERENCES public.tax_period(period_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5366 (class 2606 OID 17290)
-- Name: taxpayer определяет местонахождение; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.taxpayer
    ADD CONSTRAINT "определяет местонахождение" FOREIGN KEY (region_key) REFERENCES public.region(region_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5345 (class 2606 OID 17295)
-- Name: tax_accrual определяет статус; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_accrual
    ADD CONSTRAINT "определяет статус" FOREIGN KEY (income_status_id) REFERENCES public.accrual_status(accrual_status_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5349 (class 2606 OID 17300)
-- Name: tax_declaration определяет текущий статус; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_declaration
    ADD CONSTRAINT "определяет текущий статус" FOREIGN KEY (declaration_status_id) REFERENCES public.declaration_status(declaration_status_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5357 (class 2606 OID 17305)
-- Name: tax_reduce_request подает; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_reduce_request
    ADD CONSTRAINT "подает" FOREIGN KEY (taxpayer_id) REFERENCES public.taxpayer(taxpayer_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5339 (class 2606 OID 17310)
-- Name: inspection проверяется; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inspection
    ADD CONSTRAINT "проверяется" FOREIGN KEY (taxpayer_id) REFERENCES public.taxpayer(taxpayer_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5358 (class 2606 OID 17315)
-- Name: tax_reduce_request рассматривает; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_reduce_request
    ADD CONSTRAINT "рассматривает" FOREIGN KEY ("Ключ сотрудника") REFERENCES public.tax_officer(tax_officer_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- TOC entry 5352 (class 2606 OID 17320)
-- Name: tax_payment соотносит оплату; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_payment
    ADD CONSTRAINT "соотносит оплату" FOREIGN KEY (tax_income_id) REFERENCES public.tax_accrual(tax_accrual_id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- TOC entry 5341 (class 2606 OID 17325)
-- Name: object_ownership чем владеет; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.object_ownership
    ADD CONSTRAINT "чем владеет" FOREIGN KEY (object_id) REFERENCES public.taxable_object(object_id) ON UPDATE RESTRICT ON DELETE CASCADE;


-- Completed on 2025-11-23 19:50:17

--
-- PostgreSQL database dump complete
--

