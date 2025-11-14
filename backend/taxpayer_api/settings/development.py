from .base import *

# --- Настройки для среды разработки ---

DEBUG = True

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
]

# Настройки CORS для разработки
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# В разработке удобно выводить письма в консоль
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'