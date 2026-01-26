"""
NanoGen Backend - Main Application
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from telegram.ext import Application

from app.config import settings
from app.database import init_db
from app.api import generation, user, admin
from app.bot.handlers import setup_handlers
import structlog

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()

# Global bot application
bot_app: Application = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    global bot_app
    
    # Startup
    logger.info("Starting NanoGen Backend...")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Initialize Telegram bot
    bot_app = Application.builder().token(settings.telegram_bot_token).build()
    setup_handlers(bot_app)
    
    # Start bot in polling mode (for development)
    # For production, use webhooks
    await bot_app.initialize()
    await bot_app.start()
    
    # Start polling in background
    asyncio.create_task(bot_app.updater.start_polling(drop_pending_updates=True))
    logger.info("Telegram bot started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    if bot_app:
        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="NanoGen AI Generation Backend",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.nanogen.ai",
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(generation.router)
app.include_router(user.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "NanoGen API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    import os
    
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.debug,
    )
