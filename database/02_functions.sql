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
