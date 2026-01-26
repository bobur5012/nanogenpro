"""
Telegram Bot Handlers
Simplified - direct Web App navigation
"""
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler
from telegram.constants import ParseMode

from app.bot.keyboards import (
    main_menu_keyboard,
    video_models_keyboard,
    image_models_keyboard,
)
from app.bot.messages import (
    welcome_message,
    main_menu_message,
    video_menu_message,
    image_menu_message,
)
from app.services.user import user_service
from app.schemas.user import TelegramUser
from app.database import AsyncSessionLocal
import structlog

logger = structlog.get_logger()


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user = update.effective_user
    
    # Check for referral code
    referral_code = None
    if context.args:
        arg = context.args[0]
        if arg.startswith("ref_"):
            referral_code = arg[4:]  # Remove "ref_" prefix
    
    # Get or create user in database
    async with AsyncSessionLocal() as db:
        telegram_user = TelegramUser(
            id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            language_code=user.language_code,
        )
        
        db_user = await user_service.get_or_create_user(db, telegram_user, referral_code)
        credits = db_user.credits
    
    await update.message.reply_text(
        welcome_message(user.first_name, credits),
        parse_mode=ParseMode.HTML,
        reply_markup=main_menu_keyboard(),
    )


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle callback queries - only navigation"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user = update.effective_user
    
    logger.info("Callback", user_id=user.id, data=data)
    
    # Main menu
    if data == "back_main":
        async with AsyncSessionLocal() as db:
            db_user = await user_service.get_or_create_user(
                db,
                TelegramUser(id=user.id, username=user.username, first_name=user.first_name),
            )
            credits = db_user.credits
        
        await query.edit_message_text(
            main_menu_message(credits),
            parse_mode=ParseMode.HTML,
            reply_markup=main_menu_keyboard(),
        )
    
    # Video menu - show models list
    elif data == "menu_video":
        await query.edit_message_text(
            video_menu_message(),
            parse_mode=ParseMode.HTML,
            reply_markup=video_models_keyboard(),
        )
    
    # Image menu - show models list
    elif data == "menu_image":
        await query.edit_message_text(
            image_menu_message(),
            parse_mode=ParseMode.HTML,
            reply_markup=image_models_keyboard(),
        )


async def webapp_data_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle data sent from Web App"""
    import json
    
    user = update.effective_user
    data = json.loads(update.effective_message.web_app_data.data)
    
    logger.info("WebApp data received", user_id=user.id, data_type=data.get("type"))
    
    # Handle different data types
    if data["type"] == "video_gen":
        # Generation request from Web App
        payload = data["payload"]
        # TODO: Process generation via AIML API
        await update.message.reply_text(
            f"🎬 Генерация запущена!\n\n"
            f"Модель: {payload.get('model')}\n"
            f"Стоимость: {payload.get('cost')} 💎\n\n"
            f"Мы отправим результат сюда, когда будет готово.",
            parse_mode=ParseMode.HTML,
        )
    
    elif data["type"] == "image_gen":
        payload = data["payload"]
        await update.message.reply_text(
            f"🖼 Генерация изображения запущена!\n\n"
            f"Модель: {payload.get('model')}\n"
            f"Стоимость: {payload.get('cost')} 💎\n\n"
            f"Результат будет отправлен сюда.",
            parse_mode=ParseMode.HTML,
        )
    
    elif data["type"] == "payment_confirm":
        payload = data["payload"]
        await update.message.reply_text(
            f"💳 Заявка на пополнение получена!\n\n"
            f"Сумма: {payload.get('amount')} 💎\n\n"
            f"Ожидайте подтверждения от администратора.",
            parse_mode=ParseMode.HTML,
        )


def setup_handlers(application):
    """Setup all bot handlers"""
    from telegram.ext import MessageHandler, filters
    
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CallbackQueryHandler(callback_handler))
    application.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, webapp_data_handler))
