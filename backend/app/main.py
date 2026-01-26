"""
NanoGen Backend - Main Application
ONLY API - Telegram bot runs separately or via webhook only
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from telegram import Update
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

# Global bot application (webhook only)
bot_app: Application = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events.
    
    IMPORTANT: Telegram bot runs in WEBHOOK-ONLY mode.
    No polling - production-ready architecture.
    """
    global bot_app
    
    # Startup
    logger.info("Starting NanoGen Backend...")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Initialize Telegram bot (WEBHOOK ONLY)
    bot_app = Application.builder().token(settings.telegram_bot_token).build()
    setup_handlers(bot_app)
    
    await bot_app.initialize()
    await bot_app.start()
    
    # Set webhook (production only)
    if settings.telegram_webhook_url:
        webhook_url = f"{settings.telegram_webhook_url}/webhook/telegram"
        await bot_app.bot.set_webhook(
            url=webhook_url,
            drop_pending_updates=True,
            allowed_updates=["message", "callback_query"],  # Only what we need
        )
        logger.info("Telegram webhook set", url=webhook_url)
    else:
        logger.warning("TELEGRAM_WEBHOOK_URL not set - bot will not receive updates!")
        logger.warning("For development, run bot separately: python -m app.bot.polling")
    
    yield
    
    # Graceful shutdown
    logger.info("Shutting down...")
    
    if bot_app:
        # Delete webhook
        if settings.telegram_webhook_url:
            try:
                await bot_app.bot.delete_webhook(drop_pending_updates=True)
                logger.info("Webhook deleted")
            except Exception as e:
                logger.error("Failed to delete webhook", error=str(e))
        
        # Stop bot
        await bot_app.stop()
        await bot_app.shutdown()
        logger.info("Telegram bot stopped")
    
    logger.info("Shutdown complete")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="NanoGen AI Generation Backend",
    lifespan=lifespan,
)

# CORS - FIXED: Cannot use "*" with allow_credentials=True
# Telegram WebApp doesn't need credentials, so we disable them
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nanogenbot.netlify.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=False,  # ← FIXED: Telegram WebApp doesn't send credentials
    allow_methods=["*"],
    allow_headers=["*"],
    # Note: Wildcard origins not needed - Telegram validates on their side
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


# ========== TELEGRAM WEBHOOK ENDPOINT ==========

@app.post("/webhook/telegram")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Handle Telegram webhook updates.
    
    IMPORTANT:
    - Validates update
    - Processes in background (non-blocking)
    - Returns 200 immediately (Telegram requirement)
    - Has error handling to prevent update loss
    """
    global bot_app
    
    if not bot_app:
        logger.error("Webhook received but bot not initialized")
        return {"ok": False, "error": "Bot not initialized"}
    
    try:
        # Parse update
        data = await request.json()
        update = Update.de_json(data, bot_app.bot)
        
        if not update:
            logger.warning("Invalid update data")
            return {"ok": False, "error": "Invalid update"}
        
        # Process update in background (non-blocking)
        # This prevents slow handlers from blocking Telegram webhook
        background_tasks.add_task(process_telegram_update, update)
        
        # Return immediately (Telegram requires fast response)
        return {"ok": True}
        
    except Exception as e:
        # Log error but return ok=True to prevent Telegram retries
        logger.error(
            "Webhook processing error",
            error=str(e),
            error_type=type(e).__name__,
        )
        return {"ok": True}  # Prevent Telegram from retrying


async def process_telegram_update(update: Update):
    """
    Process Telegram update in background.
    
    Separated from webhook endpoint to:
    - Return fast response to Telegram
    - Handle errors without losing updates
    - Isolate slow operations
    """
    global bot_app
    
    try:
        await bot_app.process_update(update)
    except Exception as e:
        logger.error(
            "Update processing failed",
            update_id=update.update_id,
            error=str(e),
            error_type=type(e).__name__,
        )
        # Errors are logged but not propagated
        # Update is considered processed (no retry)


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
