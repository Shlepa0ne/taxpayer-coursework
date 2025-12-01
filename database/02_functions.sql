-- FUNCTION: public.calculate_risk_score(integer)

-- DROP FUNCTION IF EXISTS public.calculate_risk_score(integer);

CREATE OR REPLACE FUNCTION public.calculate_risk_score(
	p_taxpayer_id integer)
    RETURNS integer
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
 
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
$BODY$;

ALTER FUNCTION public.calculate_risk_score(integer)
    OWNER TO postgres;


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
    RETURN phone ~ '^(\+7|8|7)[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$'
           OR phone ~ '^(\+7|8|7)\([0-9]{3}\)[0-9]{3}[\-]?[0-9]{2}[\-]?[0-9]{2}$';
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