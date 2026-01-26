# NanoGen Frontend

Telegram Web App для AI-генерации изображений и видео.

## Технологии

- React 19
- TypeScript
- Vite
- Telegram Web App SDK

## Локальная разработка

### 1. Установка зависимостей

```bash
cd frontend
npm install
```

### 2. Настройка окружения

```bash
cp env.example .env
```

Отредактируйте `.env`:
```env
VITE_API_URL=http://localhost:8000
```

### 3. Запуск

```bash
npm run dev
```

Приложение будет доступно на http://localhost:3000

## Сборка для продакшена

```bash
npm run build
```

Статические файлы будут в папке `dist/`.

## Деплой в Netlify

### Вариант 1: Через GitHub

1. Загрузите репозиторий в GitHub
2. Зайдите на [Netlify](https://app.netlify.com)
3. Нажмите "Add new site" → "Import an existing project"
4. Выберите GitHub и ваш репозиторий
5. Настройки сборки:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
6. Добавьте переменные окружения:
   - `VITE_API_URL` = URL вашего backend на Railway

### Вариант 2: Через Netlify CLI

```bash
# Установка CLI
npm install -g netlify-cli

# Логин
netlify login

# Инициализация (в папке frontend)
cd frontend
netlify init

# Деплой
netlify deploy --prod
```

## Переменные окружения

| Переменная | Описание | Пример |
|------------|----------|--------|
| `VITE_API_URL` | URL backend API | `https://nanogen-api.up.railway.app` |

## Структура проекта

```
frontend/
├── src/
│   ├── components/     # UI компоненты
│   ├── views/          # Страницы/экраны
│   ├── utils/          # Утилиты
│   ├── types.ts        # TypeScript типы
│   ├── App.tsx         # Главный компонент
│   └── index.tsx       # Точка входа
├── index.html          # HTML шаблон
├── vite.config.ts      # Конфигурация Vite
├── tsconfig.json       # Конфигурация TypeScript
├── netlify.toml        # Конфигурация Netlify
└── package.json
```

## Telegram Web App

Приложение использует [Telegram Web App API](https://core.telegram.org/bots/webapps).

Основные функции:
- `window.Telegram.WebApp.ready()` - сигнал о готовности
- `window.Telegram.WebApp.expand()` - развернуть на весь экран
- `window.Telegram.WebApp.initDataUnsafe.user` - данные пользователя
- `window.Telegram.WebApp.BackButton` - кнопка "Назад"
- `window.Telegram.WebApp.close()` - закрыть приложение

## Роутинг

Приложение поддерживает два способа навигации:

1. **Query параметр**: `?screen=kling`
2. **URL путь**: `/model/kling-2-6-pro`

Маппинг моделей:
- `kling-2-6-pro` → Kling 2.6 Pro
- `kling-i2v` → Kling Image-to-Video
- `gpt-image` → GPT Image
- `imagen-4` → Imagen 4
- и другие...
