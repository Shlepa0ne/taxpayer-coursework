# tests/test_base.py
from django.test import TransactionTestCase
from django.db import connection

class BaseTestCase(TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.create_test_tables()
    
    def create_test_tables(self):
        """Создаем тестовые таблицы вручную"""
        with connection.cursor() as cursor:
            # Создаем таблицу reduce_base
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reduce_base (
                    reduce_base_id SERIAL PRIMARY KEY,
                    reduce_base_name TEXT
                )
            """)
            
            # Создаем таблицу taxpayer
            cursor.execute("""
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
            """)
            
            # Добавьте другие таблицы по необходимости для тестов

    def tearDown(self):
        """Очищаем таблицы после тестов"""
        with connection.cursor() as cursor:
            cursor.execute("DROP TABLE IF EXISTS reduce_base, taxpayer CASCADE")
        super().tearDown()