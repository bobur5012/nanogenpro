# Используем Python 3.11 Slim
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем переменные окружения
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Устанавливаем системные зависимости (нужны для сборки psycopg2 и других библиотек)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копируем файл зависимостей
COPY requirements.txt .

# Устанавливаем зависимости Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем весь код проекта в контейнер
COPY . .

# Открываем порт 8000
EXPOSE 8000

# Команда запуска (используем shell form для поддержки переменных окружения если нужно)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
