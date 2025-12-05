from .development import *
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Фиксированное имя тестовой БД
TEST_DB_NAME = 'test_taxpayer_db'

def create_test_database():
    """Создает тестовую базу данных если она не существует"""
    db_config = {
        'dbname': 'postgres',
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', '123'),
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5432')
    }
    
    try:
        # Подключаемся к postgres БД для администрирования
        conn = psycopg2.connect(**db_config)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Завершаем все активные подключения к тестовой БД
        cursor.execute("""
            SELECT pg_terminate_backend(pg_stat_activity.pid) 
            FROM pg_stat_activity 
            WHERE pg_stat_activity.datname = %s 
            AND pid <> pg_backend_pid();
        """, [TEST_DB_NAME])
        
        # Удаляем базу данных если существует
        cursor.execute(f"DROP DATABASE IF EXISTS {TEST_DB_NAME}")
        print(f"Database {TEST_DB_NAME} dropped successfully")
        
        # Создаем заново
        cursor.execute(f"CREATE DATABASE {TEST_DB_NAME}")
        print(f"Database {TEST_DB_NAME} created successfully")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error managing test database: {e}")
        raise

def delete_test_database():
    """Удаляет тестовую базу данных после тестов"""
    db_config = {
        'dbname': 'postgres',
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', '123'),
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5432')
    }
    
    try:
        conn = psycopg2.connect(**db_config)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Завершаем все активные подключения
        cursor.execute("""
            SELECT pg_terminate_backend(pg_stat_activity.pid) 
            FROM pg_stat_activity 
            WHERE pg_stat_activity.datname = %s 
            AND pid <> pg_backend_pid();
        """, [TEST_DB_NAME])
        
        # Удаляем базу данных
        cursor.execute(f"DROP DATABASE IF EXISTS {TEST_DB_NAME}")
        print(f"Database {TEST_DB_NAME} dropped after tests")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error deleting test database: {e}")

# Создаем тестовую БД при импорте настроек
create_test_database()

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': TEST_DB_NAME,
        'USER': os.getenv('DB_USER', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', '123'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
        'TEST': {
            'NAME': TEST_DB_NAME,
        }
    }
}

# Ускоряем тесты
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

DEBUG = False

# Отключаем миграции корректно
class DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None

MIGRATION_MODULES = DisableMigrations()

# Импортируем и настраиваем фикстуру для удаления БД после тестов
import atexit
atexit.register(delete_test_database)