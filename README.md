# NanoGen - AI Generation Platform

AI-powered image and video generation Telegram Web App.

## Project Structure

```
nanogen/
├── backend/          # Python FastAPI Backend
│   ├── app/          # Application code
│   ├── alembic/      # Database migrations
│   ├── requirements.txt
│   └── Procfile
├── frontend/         # React Vite Frontend
│   ├── src/
│   ├── netlify.toml
│   └── package.json
└── README.md
```

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy (async)
- **Migrations**: Alembic
- **Bot**: python-telegram-bot

### Frontend
- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 6
- **Styling**: Tailwind CSS (inline)
- **SDK**: Telegram Web App API

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Git

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp env.example .env
# Edit .env with your credentials

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp env.example .env
# Edit .env with your API URL

# Start development server
npm run dev
```

---

## Production Deployment

### Backend → Railway

1. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Create new project
   - Add PostgreSQL database

2. **Deploy Backend**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Link project (in backend folder)
   cd backend
   railway link
   
   # Deploy
   railway up
   ```

3. **Configure Environment Variables**
   
   In Railway dashboard, set:
   ```
   DATABASE_URL         # Auto-set by Railway PostgreSQL
   TELEGRAM_BOT_TOKEN   # Your Telegram bot token
   AIML_API_KEY         # Your AIML API key
   SECRET_KEY           # Generate random 32+ char string
   WEBAPP_URL           # Your Netlify frontend URL
   ```

4. **Migrations**
   
   Migrations run automatically on deploy via `railway.toml`:
   ```toml
   [deploy]
   startCommand = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
   ```

### Frontend → Netlify

1. **Connect Repository**
   - Go to [netlify.com](https://app.netlify.com)
   - Import from GitHub
   - Select your repository

2. **Configure Build Settings**
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`

3. **Environment Variables**
   
   Add in Netlify dashboard:
   ```
   VITE_API_URL=https://your-backend.up.railway.app
   ```

4. **Deploy**
   
   Push to main branch - Netlify auto-deploys.

---

## Environment Variables

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token | `123456:ABC...` |
| `AIML_API_KEY` | AIML API key for generation | `sk-...` |
| `SECRET_KEY` | App secret for signing | Random 32+ chars |
| `WEBAPP_URL` | Frontend URL | `https://app.netlify.app` |
| `DEBUG` | Enable debug mode | `false` |

### Frontend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://api.railway.app` |

---

## API Endpoints

### Health
- `GET /` - API info
- `GET /health` - Health check

### User
- `POST /api/user/auth` - Authenticate user
- `GET /api/user/balance/{user_id}` - Get balance
- `POST /api/user/topup` - Request top-up
- `GET /api/user/referral/{user_id}` - Get referral stats

### Generation
- `POST /api/generation/start` - Start generation
- `GET /api/generation/status/{id}` - Check status
- `GET /api/generation/history/{user_id}` - Get history

### Admin
- `GET /api/admin/pending-payments` - List pending
- `POST /api/admin/approve-payment/{id}` - Approve
- `POST /api/admin/reject-payment/{id}` - Reject

---

## Telegram Bot Setup

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Get bot token
3. Set Web App URL:
   ```
   /setmenubutton
   → Select bot
   → Send Web App URL (your Netlify URL)
   ```

---

## Security Checklist

- [ ] Generate strong `SECRET_KEY` (32+ random chars)
- [ ] Use HTTPS everywhere
- [ ] Set proper CORS origins
- [ ] Never commit `.env` files
- [ ] Enable PostgreSQL SSL in production
- [ ] Set up rate limiting
- [ ] Configure webhook verification

---

## Support

- Telegram: [@botiroffb](https://t.me/botiroffb)

---

## License

MIT
