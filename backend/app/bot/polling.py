"""
Telegram Bot - Development Polling Mode

Use this ONLY for local development.
Production uses webhooks through main.py.

Usage:
    python -m app.bot.polling

Requirements:
    - DATABASE_URL must be set
    - TELEGRAM_BOT_TOKEN must be set
    - Do NOT set TELEGRAM_WEBHOOK_URL (will conflict)
"""
import asyncio
from telegram.ext import Application

from app.config import settings
from app.bot.handlers import setup_handlers
import structlog

logger = structlog.get_logger()


async def main():
    """Run bot in polling mode (development only)"""
    
    logger.info("Starting Telegram Bot in POLLING mode (development)")
    logger.warning("Do NOT use polling in production - use webhooks!")
    
    # Create application
    app = Application.builder().token(settings.telegram_bot_token).build()
    
    # Setup handlers
    setup_handlers(app)
    
    # Initialize
    await app.initialize()
    await app.start()
    
    logger.info("Bot started, polling for updates...")
    
    try:
        # Run polling (blocking)
        await app.updater.start_polling(
            drop_pending_updates=True,
            allowed_updates=["message", "callback_query"],
        )
        
        # Keep running
        await asyncio.Event().wait()
        
    except KeyboardInterrupt:
        logger.info("Stopping bot...")
    finally:
        # Cleanup
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
        logger.info("Bot stopped")


if __name__ == "__main__":
    asyncio.run(main())
