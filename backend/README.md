# NanoGen Backend

FastAPI backend for NanoGen AI generation Telegram bot.

## Stack

- Python 3.11+
- FastAPI
- SQLAlchemy (async)
- PostgreSQL
- Alembic (migrations)
- python-telegram-bot

## Local Development

### 1. Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp env.example .env
```

### 2. Configure .env

```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/nanogen
TELEGRAM_BOT_TOKEN=your_bot_token
AIML_API_KEY=your_api_key
SECRET_KEY=your_secret_key
```

### 3. Database

```bash
# Create database
createdb nanogen

# Run migrations
alembic upgrade head
```

### 4. Run

```bash
# Development with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Deploy to Railway

### 1. Create Project

- Go to [railway.app](https://railway.app)
- Create new project
- Add PostgreSQL plugin

### 2. Deploy

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

### 3. Environment Variables

Set in Railway dashboard:

```
DATABASE_URL         # Auto-set by Railway
TELEGRAM_BOT_TOKEN   # Your bot token
AIML_API_KEY         # AIML API key
SECRET_KEY           # Random string 32+ chars
WEBAPP_URL           # Frontend Netlify URL
DEBUG                # false
```

### 4. Migrations

Migrations run automatically on deploy:

```toml
# railway.toml
[deploy]
startCommand = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
```

## Project Structure

```
backend/
├── app/
│   ├── api/           # Route handlers
│   │   ├── admin.py
│   │   ├── generation.py
│   │   └── user.py
│   ├── bot/           # Telegram bot
│   │   ├── handlers.py
│   │   ├── keyboards.py
│   │   └── messages.py
│   ├── models/        # SQLAlchemy models
│   │   ├── user.py
│   │   ├── generation.py
│   │   ├── transaction.py
│   │   └── referral.py
│   ├── schemas/       # Pydantic schemas
│   ├── services/      # Business logic
│   ├── config.py      # Settings
│   ├── database.py    # DB connection
│   └── main.py        # FastAPI app
├── alembic/           # Migrations
├── requirements.txt
├── Procfile
├── railway.toml
└── env.example
```

## API Endpoints

### Health
- `GET /` - API status
- `GET /health` - Health check

### User (`/api/user`)
- `POST /auth` - Authenticate/register
- `GET /balance/{user_id}` - Get balance
- `POST /topup` - Request payment
- `POST /withdraw` - Request withdrawal
- `GET /referral/{user_id}` - Referral stats

### Generation (`/api/generation`)
- `POST /start` - Start generation
- `GET /status/{id}` - Check status
- `GET /history/{user_id}` - History

### Admin (`/api/admin`)
- `GET /pending-payments` - List pending
- `POST /approve-payment/{id}` - Approve
- `POST /reject-payment/{id}` - Reject
- `GET /stats` - Platform stats

## Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Run migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```
