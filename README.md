# Система учета налогоплательщиков: Веб-интерфейс

Репозиторий содержит full-stack приложение, состоящее из двух частей:
*   `/backend`: API-сервер на Django & Django REST Framework.
*   `/frontend`: Клиентское приложение на React (с использованием Vite).

## Системные требования

*   Python (3.9+)
*   Node.js (18+ LTS) & npm
*   PostgreSQL (12+)
*   Git



## УСТАНОВКА

### 1. Клонирование репозитория
```bash
git clone <URL-адрес-репозитория>
cd <название-папки-проекта>
```

### 2. Настройка базы данных PostgreSQL
Перед запуском приложения необходимо развернуть базу данных:
1.  Создайте пользователя и базу данных в PostgreSQL.
2.  Выполните SQL-скрипты из папки `/database` в следующем порядке: `01_schema.sql`, `02_functions.sql`, `03_initial_data.sql`, `04-authentication.sql`.

**ВАЖНО:** Пароль для входа пользователей генерируется в Django (функция make_password(...)). Пример добавления пользователя:
```bash
INSERT INTO public.taxpayer_auth(inn, password_hash) VALUES
('1234567890', 'pbkdf2_sha256$1000000$AXGVtHDiai2yKTXfS7gsSq$btIFq8uIdrrZWDIvoXxYN4eDzt2T7T0lsqGK3PLgOQ8=');
```

### 3. Настройка Backend
Все команды выполняются из директории `/backend`.

```bash
# Перейти в директорию backend
cd backend

# Создать и активировать виртуальное окружение
# Для Windows:
python -m venv venv
venv\Scripts\activate
# Для macOS/Linux:
# python3 -m venv venv
# source venv/bin/activate

# Установить зависимости
pip install -r requirements.txt

# Создать файл конфигурации .env из примера
# Для Windows:
copy .env.example .env
# Для macOS/Linux:
# cp .env.example .env
```

**ВАЖНО:** Откройте созданный файл `.env` и выполните два шага:
1. Сгенерируйте и вставьте SECRET_KEY. Этот ключ необходим для подписи JWT-токенов. Откройте терминал (виртуальное окружение должно быть активно) и выполните команду:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```
Скопируйте сгенерированную строку и вставьте ее в .env в поле SECRET_KEY.
2. Укажите ваши реальные учетные данные для подключения к базе данных (DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT).
После настройки файла .env можно продолжать.

```bash
# Применить миграции для создания служебных таблиц Django
python manage.py migrate

# Создать суперпользователя для доступа к админ-панели Django
python manage.py createsuperuser
```

### 4. Настройка Frontend
Все команды выполняются из директории `/frontend`.

```bash
# Перейти в директорию frontend
cd ../frontend

# Установить зависимости
npm install
```



## ЗАПУСК В РЕЖИМЕ РАЗРАБОТКИ

Для полноценной работы приложения необходимо запустить два сервера в двух отдельных терминалах.

#### Терминал 1: Запуск Backend
```bash
# Убедитесь, что вы находитесь в директории /backend
# и виртуальное окружение активировано.
python manage.py runserver
```
> API сервер будет доступен по адресу: `http://localhost:8000`

#### Терминал 2: Запуск Frontend
```bash
# Убедитесь, что вы находитесь в директории /frontend
npm run dev
```
> Клиентское приложение будет доступно по адресу: `http://localhost:5173` (или по другому порту, указанному Vite).