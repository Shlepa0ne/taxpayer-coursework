from .base import *

# --- Настройки для продакшен-среды ---

DEBUG = False

ALLOWED_HOSTS = []

CORS_ALLOWED_ORIGINS = []

# TODO: Настроить реальный email-бэкенд для продакшена
# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
# EMAIL_HOST = 'smtp.example.com'
# EMAIL_PORT = 587
# EMAIL_USE_TLS = True
# EMAIL_HOST_USER = os.getenv('EMAIL_USER')
# EMAIL_HOST_PASSWORD = os.getenv('EMAIL_PASSWORD')

# TODO: Настроить логгирование в файлы или внешнюю систему