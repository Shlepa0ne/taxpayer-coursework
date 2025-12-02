import pytest
import os
from django.core.management import call_command
from django.contrib.auth.hashers import make_password
from django.db import connection
from django.db.utils import OperationalError
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'taxpayer_api.settings.testing')

def close_db_connections():
    """Принудительно закрывает все соединения с БД"""
    try:
        connection.close()
    except Exception:
        pass

@pytest.fixture(scope='session', autouse=True)
def django_db_setup(django_db_setup, django_db_blocker):
    """Настраивает тестовую БД с повторными попытками"""
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            with django_db_blocker.unblock():
                close_db_connections()
                # Даем время на закрытие соединений
                time.sleep(1)
                create_test_tables()
                create_test_data()
            break
        except OperationalError as e:
            if attempt < max_retries - 1:
                print(f"Database setup failed, retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                continue
            else:
                raise e

def create_test_tables():
    """Создает тестовые таблицы с обработкой ошибок"""
    print("Creating test tables...")
    
    tables_sql = [
        # region table
        """
        CREATE TABLE IF NOT EXISTS region (
            region_id SERIAL PRIMARY KEY,
            name TEXT,
            code VARCHAR(3)
        )
        """,
        
        # tax_regime table
        """
        CREATE TABLE IF NOT EXISTS tax_regime (
            regime_id SERIAL PRIMARY KEY,
            name TEXT,
            description TEXT
        )
        """,
        
        # reduce_base
        """
        CREATE TABLE IF NOT EXISTS reduce_base (
            reduce_base_id SERIAL PRIMARY KEY,
            reduce_base_name TEXT
        )
        """,
        
        # taxpayer
        """
        CREATE TABLE IF NOT EXISTS taxpayer (
            taxpayer_id SERIAL PRIMARY KEY,
            inn VARCHAR(12) UNIQUE,
            creation_date TIMESTAMP,
            notes TEXT,
            update_date TIMESTAMP,
            fio TEXT,
            birth_date DATE,
            registration_address TEXT,
            fact_address TEXT,
            ogrn VARCHAR(15),
            registration_date DATE,
            bank_detals VARCHAR(20),
            start_date DATE,
            end_date DATE,
            full_name TEXT,
            short_name TEXT,
            executive_list TEXT,
            payer_status_id INTEGER,
            region_key INTEGER,
            opf_id INTEGER,
            tax_regime_id INTEGER,
            payer_type_id INTEGER,
            origin_id INTEGER
        )
        """,
        
        # tax_type
        """
        CREATE TABLE IF NOT EXISTS tax_type (
            tax_type_id SERIAL PRIMARY KEY,
            tax_type_name TEXT
        )
        """,
        
        # tax_accrual
        """
        CREATE TABLE IF NOT EXISTS tax_accrual (
            tax_accrual_id SERIAL PRIMARY KEY,
            taxpayer_id INTEGER,
            accrual_date TIMESTAMP,
            accrual_amount DECIMAL(20,2),
            percent_amount DECIMAL(20,2),
            due_date DATE,
            income_status_id INTEGER,
            object_id INTEGER,
            tax_type_id INTEGER,
            declaration_id INTEGER
        )
        """,
        
        # tax_payment
        """
        CREATE TABLE IF NOT EXISTS tax_payment (
            payment_id SERIAL PRIMARY KEY,
            payment_date TIMESTAMP,
            payment_amount DECIMAL(20,2),
            debit_account VARCHAR(20),
            credit_account VARCHAR(20),
            kbk_id INTEGER,
            tax_income_id INTEGER
        )
        """,
        
        # tax_reduce_request (используем правильные имена колонок)
        """
        CREATE TABLE IF NOT EXISTS tax_reduce_request (
            request_id SERIAL PRIMARY KEY,
            taxpayer_id INTEGER,
            send_date TIMESTAMP,
            requested_reduce_amount DECIMAL(20,2),
            full_description TEXT,
            reduce_base_id INTEGER,
            verdict_date TIMESTAMP,
            verdict_comment TEXT,
            request_status_id INTEGER,
            "Ключ сотрудника" INTEGER,
            "Ключ типа снижения" INTEGER
        )
        """,
        
        # taxpayer_auth
        """
        CREATE TABLE IF NOT EXISTS taxpayer_auth (
            inn VARCHAR(32) PRIMARY KEY,
            password_hash VARCHAR(512)
        )
        """,
        
        # tax_officer
        """
        CREATE TABLE IF NOT EXISTS tax_officer (
            tax_officer_id SERIAL PRIMARY KEY,
            tax_officer_name TEXT,
            unit TEXT,
            role_id INTEGER
        )
        """,
        
        # worker_auth
        """
        CREATE TABLE IF NOT EXISTS worker_auth (
            inn VARCHAR(32) PRIMARY KEY,
            password_hash VARCHAR(512),
            tax_officer_id INTEGER
        )
        """,
        
        # reduce_type
        """
        CREATE TABLE IF NOT EXISTS reduce_type (
            reduce_type_id SERIAL PRIMARY KEY,
            reduce_type_name TEXT
        )
        """,
        
        # report_status
        """
        CREATE TABLE IF NOT EXISTS report_status (
            report_status_id SERIAL PRIMARY KEY,
            report_status_name TEXT
        )
        """,
        
        # object_type
        """
        CREATE TABLE IF NOT EXISTS object_type (
            object_type_id SERIAL PRIMARY KEY,
            object_type_name TEXT
        )
        """,
        
        # real_estate_type
        """
        CREATE TABLE IF NOT EXISTS real_estate_type (
            real_estate_type_id SERIAL PRIMARY KEY,
            real_estate_type_name TEXT
        )
        """,
        
        # taxable_object
        """
        CREATE TABLE IF NOT EXISTS taxable_object (
            object_id SERIAL PRIMARY KEY,
            object_name TEXT,
            cadastral_number VARCHAR(16),
            object_address TEXT,
            cadastral_value DECIMAL(20,2),
            transport_vin VARCHAR(17),
            registration_plate VARCHAR(9),
            transport_model TEXT,
            extra_value DECIMAL(20,2),
            object_type_id INTEGER,
            real_estate_type_id INTEGER,
            engine_power INTEGER
        )
        """,

        """
        CREATE TABLE IF NOT EXISTS inspection (
            inspection_id SERIAL PRIMARY KEY,
            taxpayer_id INTEGER,
            inspection_date DATE
        )
        """,
        
        """
        CREATE TABLE IF NOT EXISTS identified_violation (
            violation_id SERIAL PRIMARY KEY,
            inspection_id INTEGER,
            description TEXT
        )
        """,
        
        # object_ownership
        """
        CREATE TABLE IF NOT EXISTS object_ownership (
            ownership_id SERIAL PRIMARY KEY,
            ownership_start_date DATE,
            ownership_end_date DATE,
            taxpayer_id INTEGER,
            object_id INTEGER
        )
        """,

        # Промежуточная таблица для связи заявлений с типами налогов
        """
        CREATE TABLE IF NOT EXISTS tax_reduce_request_tax_type (
            id SERIAL PRIMARY KEY,
            request_id INTEGER,
            tax_type_id INTEGER
        )
        """,
        
        # Промежуточная таблица для связи заявлений с периодами
        """
        CREATE TABLE IF NOT EXISTS rax_period_tax_reduce_request (
            id SERIAL PRIMARY KEY,
            period_id INTEGER,
            request_id INTEGER
        )
        """,
        
        # Таблица периодов (если еще нет)
        """
        CREATE TABLE IF NOT EXISTS tax_period (
            period_id SERIAL PRIMARY KEY,
            start_date DATE,
            end_date DATE,
            period_type_id INTEGER
        )
        """,
        
        # Таблица типов периодов
        """
        CREATE TABLE IF NOT EXISTS period_type (
            type_period_id SERIAL PRIMARY KEY,
            name TEXT
        )
        """,
        
        # Таблица документов
        """
        CREATE TABLE IF NOT EXISTS document (
            document_id SERIAL PRIMARY KEY,
            series VARCHAR(15),
            number VARCHAR(30),
            issued_by TEXT,
            issued_date DATE,
            additional_info TEXT,
            expire_date DATE,
            "Ключ типа документа" INTEGER,
            "Ключ налогоплательщика" INTEGER
        )
        """,
        
        # Таблица типов документов
        """
        CREATE TABLE IF NOT EXISTS document_type (
            document_type_id SERIAL PRIMARY KEY,
            name TEXT
        )
        """,
        
        # Таблица контактов
        """
        CREATE TABLE IF NOT EXISTS contact_data (
            contact_id SERIAL PRIMARY KEY,
            value TEXT,
            contact_type_id INTEGER,
            taxpayer_id INTEGER
        )
        """,
        
        # Таблица типов контактов
        """
        CREATE TABLE IF NOT EXISTS contact_type (
            type_id SERIAL PRIMARY KEY,
            name TEXT
        )
        """,

        """
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
        """
    ]
    
    with connection.cursor() as cursor:
        for sql in tables_sql:
            try:
                cursor.execute(sql)
            except Exception as e:
                print(f"Warning: Could not create table: {e}")

def create_test_data():
    """Создает базовые тестовые данные с высокими ID"""
    from api.models import (
        ReduceBase, ReduceType, TaxType, ReportStatus, 
        TaxOfficer, Region, TaxRegime, ObjectType, RealEstateType,
        PeriodType, TaxPeriod, DocumentType, ContactType  # ДОБАВИТЬ ИМПОРТЫ
    )
    
    # Сначала очищаем таблицы от старых тестовых данных
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM reduce_base WHERE reduce_base_id >= 9990")
        cursor.execute("DELETE FROM reduce_type WHERE reduce_type_id >= 9990")
        cursor.execute("DELETE FROM report_status WHERE report_status_id >= 9990")
        cursor.execute("DELETE FROM tax_officer WHERE tax_officer_id >= 9990")
        cursor.execute("DELETE FROM region WHERE region_id >= 9990")
        cursor.execute("DELETE FROM tax_regime WHERE regime_id >= 9990")
        cursor.execute("DELETE FROM object_type WHERE object_type_id >= 9990")
        cursor.execute("DELETE FROM real_estate_type WHERE real_estate_type_id >= 9990")
        cursor.execute("DELETE FROM tax_period WHERE period_id >= 9990")
        cursor.execute("DELETE FROM period_type WHERE type_period_id >= 9990")
        cursor.execute("DELETE FROM document_type WHERE document_type_id >= 9990")
        cursor.execute("DELETE FROM contact_type WHERE type_id >= 9990")
    
    # Регионы
    Region.objects.get_or_create(
        region_id=9991,
        defaults={'name': 'Москва', 'code': '77'}
    )
    Region.objects.get_or_create(
        region_id=9992,
        defaults={'name': 'Санкт-Петербург', 'code': '78'}
    )
    
    # Налоговые режимы
    TaxRegime.objects.get_or_create(
        regime_id=9991,
        defaults={'name': 'Общий режим', 'description': 'Общая система налогообложения'}
    )
    TaxRegime.objects.get_or_create(
        regime_id=9992,
        defaults={'name': 'Упрощенная система', 'description': 'УСН'}
    )
    
    # Основания для снижения
    ReduceBase.objects.get_or_create(
        reduce_base_id=9991,
        defaults={'reduce_base_name': 'Медицинские расходы'}
    )
    ReduceBase.objects.get_or_create(
        reduce_base_id=9992, 
        defaults={'reduce_base_name': 'Образовательные расходы'}
    )
    
    # Типы снижения
    ReduceType.objects.get_or_create(
        reduce_type_id=9991,
        defaults={'reduce_type_name': 'Социальный вычет'}
    )
    ReduceType.objects.get_or_create(
        reduce_type_id=9992,
        defaults={'reduce_type_name': 'Имущественный вычет'}
    )
    
    # Типы налогов
    TaxType.objects.get_or_create(
        tax_type_id=13,
        defaults={'tax_type_name': 'НДФЛ'}
    )
    TaxType.objects.get_or_create(
        tax_type_id=14,
        defaults={'tax_type_name': 'Транспортный налог'}
    )
    
    # Статусы отчетов
    ReportStatus.objects.get_or_create(
        report_status_id=9991,
        defaults={'report_status_name': 'На рассмотрении'}
    )
    ReportStatus.objects.get_or_create(
        report_status_id=9992,
        defaults={'report_status_name': 'Одобрено'}
    )
    
    # Налоговые сотрудники
    TaxOfficer.objects.get_or_create(
        tax_officer_id=9991,
        defaults={
            'tax_officer_name': 'Тестовый сотрудник',
            'unit': 'Тестовый отдел',
            'role_id': 1
        }
    )
    
    # Типы объектов
    ObjectType.objects.get_or_create(
        object_type_id=9991,
        defaults={'object_type_name': 'Недвижимость'}
    )
    ObjectType.objects.get_or_create(
        object_type_id=9992,
        defaults={'object_type_name': 'Транспорт'}
    )
    
    # Типы недвижимости
    RealEstateType.objects.get_or_create(
        real_estate_type_id=9991,
        defaults={'real_estate_type_name': 'Квартира'}
    )
    RealEstateType.objects.get_or_create(
        real_estate_type_id=9992,
        defaults={'real_estate_type_name': 'Земельный участок'}
    )

    # Типы периодов
    PeriodType.objects.get_or_create(
        type_period_id=1,
        defaults={'name': 'Годовой'}
    )
    PeriodType.objects.get_or_create(
        type_period_id=2,
        defaults={'name': 'Квартальный'}
    )
    PeriodType.objects.get_or_create(
        type_period_id=3,
        defaults={'name': 'Месячный'}
    )
    
    # Периоды
    TaxPeriod.objects.get_or_create(
        period_id=9991,
        defaults={
            'start_date': '2024-01-01',
            'end_date': '2024-03-31',
            'period_type_id': 2  # Квартальный
        }
    )
    
    # Типы документов
    DocumentType.objects.get_or_create(
        document_type_id=9991,
        defaults={'name': 'Паспорт'}
    )
    
    # Типы контактов
    ContactType.objects.get_or_create(
        type_id=9991,
        defaults={'name': 'Телефон'}
    )

@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """Обеспечивает доступ к БД для всех тестов"""
    pass

@pytest.fixture
def db_setup():
    """Фикстура для настройки БД перед каждым тестом"""
    close_db_connections()
    yield
    close_db_connections()

@pytest.fixture
def taxpayer_user():
    """Создает тестового пользователя-налогоплательщика"""
    from api.models import Taxpayer, TaxpayerAuth
    
    taxpayer = Taxpayer.objects.create(
        taxpayer_id=10001,
        inn='123456789012',
        fio='Тестовый пользователь',
        payer_type_id=1,
        region_key=9991,
        tax_regime_id=9991,
        payer_status_id=1,
        opf_id=1,
        origin_id=1
    )
    TaxpayerAuth.objects.create(
        inn='123456789012',
        password_hash=make_password('testpassword')
    )
    return taxpayer

@pytest.fixture
def authenticated_taxpayer_client(taxpayer_user):
    """Создает аутентифицированного клиента для налогоплательщика"""
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken
    
    client = APIClient()
    refresh = RefreshToken()
    refresh['inn'] = taxpayer_user.inn
    refresh['user_type'] = 'taxpayer'
    
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client

@pytest.fixture
def worker_user():
    """Создает тестового пользователя-сотрудника"""
    from api.models import TaxOfficer, WorkerAuth
    
    officer = TaxOfficer.objects.get(tax_officer_id=9991)
    WorkerAuth.objects.create(
        inn='987654321098',
        password_hash=make_password('testpassword'),
        tax_officer=officer
    )
    return officer

@pytest.fixture
def authenticated_worker_client(worker_user):
    """Создает аутентифицированного клиента для сотрудника"""
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import RefreshToken
    
    client = APIClient()
    refresh = RefreshToken()
    refresh['inn'] = '987654321098'
    refresh['user_type'] = 'worker'
    refresh['role_id'] = worker_user.role_id
    
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client