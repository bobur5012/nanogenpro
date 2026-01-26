"""
Telegram Bot Handlers
"""
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler, MessageHandler, filters
from telegram.constants import ParseMode

from app.bot.keyboards import (
    main_menu_keyboard,
    video_models_keyboard,
    image_models_keyboard,
    profile_keyboard,
    referral_keyboard,
    topup_keyboard,
    open_webapp_keyboard,
)
from app.bot.messages import (
    welcome_message,
    main_menu_message,
    video_menu_message,
    image_menu_message,
    profile_message,
    referral_message,
    topup_message,
    model_info_message,
)
from app.services.user import user_service
from app.schemas.user import TelegramUser
from app.database import AsyncSessionLocal
import structlog

logger = structlog.get_logger()


# Model info dictionary
MODEL_INFO = {
    "kling-2-6-pro": ("Kling 2.6 Pro", 15, "Лучшее качество видео от Kling AI. Поддержка длинных промптов и высокого разрешения."),
    "kling-i2v": ("Kling Image to Video", 15, "Анимация изображений в видео. Загрузите изображение и опишите движение."),
    "kling-o1": ("Kling O1", 10, "Умный режим с продвинутым пониманием промптов."),
    "kling-turbo": ("Kling Turbo", 7, "Быстрая генерация с хорошим качеством."),
    "veo-3-1": ("Veo 3.1", 20, "От Google. Отличная физика и реалистичность."),
    "sora-2-pro": ("Sora 2 Pro", 20, "От OpenAI. Кинематографическое качество."),
    "runway-gen4": ("Runway Gen4", 15, "Профессиональный инструмент для кино."),
    "seedance": ("Seedance", 8, "От ByteDance. Танцевальные видео и движения."),
    "wan-2-5": ("Wan 2.5", 5, "Быстрый и доступный генератор."),
    "wan-2-6": ("Wan 2.6", 7, "Улучшенная версия с лучшим качеством."),
    "gpt-image": ("GPT Image", 5, "Генерация изображений от OpenAI."),
    "imagen-4": ("Imagen 4", 4, "От Google. Фотореалистичные изображения."),
    "nano-banana": ("Nano Banana", 1, "Быстрый и дешёвый генератор."),
    "upscale": ("Upscale", 2, "Улучшение качества изображений."),
}


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
    """Handle all callback queries"""
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
    
    # Video menu
    elif data == "menu_video":
        await query.edit_message_text(
            video_menu_message(),
            parse_mode=ParseMode.HTML,
            reply_markup=video_models_keyboard(),
        )
    
    # Image menu
    elif data == "menu_image":
        await query.edit_message_text(
            image_menu_message(),
            parse_mode=ParseMode.HTML,
            reply_markup=image_models_keyboard(),
        )
    
    # Profile
    elif data == "profile":
        async with AsyncSessionLocal() as db:
            db_user = await user_service.get_or_create_user(
                db,
                TelegramUser(id=user.id, username=user.username, first_name=user.first_name),
            )
        
        await query.edit_message_text(
            profile_message(
                username=user.username,
                user_id=user.id,
                credits=db_user.credits,
                total_generations=db_user.total_generations,
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=profile_keyboard(user.id),
        )
    
    # Referral
    elif data == "referral":
        async with AsyncSessionLocal() as db:
            stats = await user_service.get_referral_stats(db, user.id)
        
        await query.edit_message_text(
            referral_message(
                referral_code=stats["referral_code"],
                total_referrals=stats["total_referrals"],
                active_referrals=stats["active_referrals"],
                total_earnings=stats["total_earnings"],
                available_balance=stats["available_balance"],
            ),
            parse_mode=ParseMode.HTML,
            reply_markup=referral_keyboard(stats["referral_link"]),
        )
    
    # Top-up
    elif data == "topup":
        await query.edit_message_text(
            topup_message(),
            parse_mode=ParseMode.HTML,
            reply_markup=topup_keyboard(),
        )
    
    # Model selection
    elif data.startswith("model:"):
        model_slug = data.split(":")[1]
        
        if model_slug in MODEL_INFO:
            name, price, description = MODEL_INFO[model_slug]
            
            await query.edit_message_text(
                model_info_message(name, price, description),
                parse_mode=ParseMode.HTML,
                reply_markup=open_webapp_keyboard(model_slug),
            )
    
    # Regenerate
    elif data.startswith("regenerate:"):
        generation_id = data.split(":")[1]
        # TODO: Fetch generation and reopen webapp with same params
        await query.answer("Функция в разработке", show_alert=True)


def setup_handlers(application):
    """Setup all bot handlers"""
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CallbackQueryHandler(callback_handler))
