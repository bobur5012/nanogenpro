"""
Telegram Bot Handlers
"""
from telegram import Update, WebAppInfo
from telegram.ext import (
    ContextTypes,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
)
import json
import httpx

from app.config import settings
from app.bot.keyboards import main_menu_keyboard, video_models_keyboard, image_models_keyboard, back_keyboard
from app.bot.messages import WELCOME_MESSAGE, VIDEO_MODELS_MESSAGE, IMAGE_MODELS_MESSAGE
import structlog

logger = structlog.get_logger()

API_BASE = settings.webapp_url.replace("https://app.", "https://api.") if "app." in settings.webapp_url else "http://localhost:8000"


# ========== USER COMMANDS ==========

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user = update.effective_user
    args = context.args
    
    logger.info("Start command", user_id=user.id, username=user.username, args=args)
    
    # Check for referral code
    referral_code = None
    if args and args[0].startswith("ref_"):
        referral_code = args[0][4:]  # Remove "ref_" prefix
        logger.info("Referral detected", user_id=user.id, referral_code=referral_code)
    
    # Register user via API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/user/auth",
                json={
                    "telegram_user": {
                        "id": user.id,
                        "username": user.username,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "language_code": user.language_code,
                    },
                    "referral_code": referral_code,
                },
                timeout=10.0,
            )
            response.raise_for_status()
    except Exception as e:
        logger.error("Failed to register user", error=str(e), user_id=user.id)
    
    await update.message.reply_text(
        WELCOME_MESSAGE.format(name=user.first_name or "друг"),
        parse_mode="HTML",
        reply_markup=main_menu_keyboard(),
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    help_text = (
        "🤖 <b>NanoGen Bot</b>\n\n"
        "Генерация AI видео и изображений.\n\n"
        "<b>Команды:</b>\n"
        "/start — Главное меню\n"
        "/help — Справка\n"
        "/balance — Баланс\n\n"
        "<b>Поддержка:</b> @nanogen_support"
    )
    await update.message.reply_text(help_text, parse_mode="HTML")


async def balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /balance command"""
    user = update.effective_user
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{API_BASE}/api/user/balance/{user.id}",
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()
            
            text = (
                f"💎 <b>Ваш баланс:</b> {data['credits']} кредитов\n\n"
                f"💰 <b>Партнёрский баланс:</b> {data['referral_balance']:,} UZS\n"
                f"📊 <b>Всего заработано:</b> {data['referral_total_earned']:,} UZS"
            )
            
            await update.message.reply_text(
                text,
                parse_mode="HTML",
                reply_markup=main_menu_keyboard(),
            )
            
    except Exception as e:
        logger.error("Failed to get balance", error=str(e), user_id=user.id)
        await update.message.reply_text("❌ Ошибка получения баланса. Попробуйте позже.")


# ========== CALLBACK HANDLERS ==========

async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle callback queries"""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    user = update.effective_user
    
    logger.info("Callback", user_id=user.id, data=data)
    
    # Main menu navigation
    if data == "back_main":
        await query.edit_message_text(
            WELCOME_MESSAGE.format(name=user.first_name or "друг"),
            parse_mode="HTML",
            reply_markup=main_menu_keyboard(),
        )
    
    elif data == "menu_video":
        await query.edit_message_text(
            VIDEO_MODELS_MESSAGE,
            parse_mode="HTML",
            reply_markup=video_models_keyboard(),
        )
    
    elif data == "menu_image":
        await query.edit_message_text(
            IMAGE_MODELS_MESSAGE,
            parse_mode="HTML",
            reply_markup=image_models_keyboard(),
        )
    
    # Admin callbacks (from admin channel)
    elif data.startswith("payment_approve:"):
        payment_id = int(data.split(":")[1])
        await handle_payment_admin_callback(query, user.id, payment_id, "approve")
    
    elif data.startswith("payment_reject:"):
        payment_id = int(data.split(":")[1])
        await handle_payment_admin_callback(query, user.id, payment_id, "reject")
    
    elif data.startswith("withdraw_approve:"):
        withdrawal_id = int(data.split(":")[1])
        await handle_withdrawal_admin_callback(query, user.id, withdrawal_id, "approve")
    
    elif data.startswith("withdraw_reject:"):
        withdrawal_id = int(data.split(":")[1])
        await handle_withdrawal_admin_callback(query, user.id, withdrawal_id, "reject")


# ========== ADMIN CALLBACK HELPERS ==========

async def handle_payment_admin_callback(query, admin_id: int, payment_id: int, action: str):
    """Handle payment approval/rejection from admin"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/admin/payment/action",
                json={
                    "payment_id": payment_id,
                    "admin_id": admin_id,
                    "action": action,
                },
                timeout=15.0,
            )
            response.raise_for_status()
            result = response.json()
            
            # Update message
            status_text = "✅ ПОДТВЕРЖДЕНО" if action == "approve" else "❌ ОТКЛОНЕНО"
            original_text = query.message.text or query.message.caption or ""
            
            new_text = original_text + f"\n\n━━━━━━━━━━━━━━━\n<b>{status_text}</b> админом {admin_id}"
            
            if query.message.photo:
                await query.edit_message_caption(
                    caption=new_text,
                    parse_mode="HTML",
                    reply_markup=None,
                )
            else:
                await query.edit_message_text(
                    text=new_text,
                    parse_mode="HTML",
                    reply_markup=None,
                )
            
    except httpx.HTTPStatusError as e:
        error_detail = e.response.json().get("detail", "Unknown error")
        await query.answer(f"Ошибка: {error_detail}", show_alert=True)
    except Exception as e:
        logger.error("Payment admin callback failed", error=str(e))
        await query.answer("Ошибка обработки. Попробуйте позже.", show_alert=True)


async def handle_withdrawal_admin_callback(query, admin_id: int, withdrawal_id: int, action: str):
    """Handle withdrawal approval/rejection from admin"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/admin/withdrawal/action",
                json={
                    "withdrawal_id": withdrawal_id,
                    "admin_id": admin_id,
                    "action": action,
                },
                timeout=15.0,
            )
            response.raise_for_status()
            
            # Update message
            status_text = "✅ ВЫПЛАЧЕНО" if action == "approve" else "❌ ОТКЛОНЕНО"
            original_text = query.message.text or ""
            
            new_text = original_text + f"\n\n━━━━━━━━━━━━━━━\n<b>{status_text}</b> админом {admin_id}"
            
            await query.edit_message_text(
                text=new_text,
                parse_mode="HTML",
                reply_markup=None,
            )
            
    except httpx.HTTPStatusError as e:
        error_detail = e.response.json().get("detail", "Unknown error")
        await query.answer(f"Ошибка: {error_detail}", show_alert=True)
    except Exception as e:
        logger.error("Withdrawal admin callback failed", error=str(e))
        await query.answer("Ошибка обработки. Попробуйте позже.", show_alert=True)


# ========== WEBAPP DATA HANDLER ==========

async def webapp_data_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle data sent from WebApp"""
    user = update.effective_user
    data_str = update.effective_message.web_app_data.data
    
    try:
        data = json.loads(data_str)
        logger.info("WebApp data received", user_id=user.id, type=data.get("type"))
        
        if data["type"] == "video_gen":
            await handle_video_generation(user.id, data["payload"], context)
        elif data["type"] == "image_gen":
            await handle_image_generation(user.id, data["payload"], context)
        elif data["type"] == "payment_confirm":
            await handle_payment_confirm(user.id, data["payload"], context)
        elif data["type"] == "withdraw_request":
            await handle_withdraw_request(user.id, data["payload"], context)
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON from WebApp", data=data_str)
    except Exception as e:
        logger.error("WebApp data handler error", error=str(e), user_id=user.id)


async def handle_video_generation(user_id: int, payload: dict, context: ContextTypes.DEFAULT_TYPE):
    """Handle video generation request from WebApp"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/generation/video",
                json={
                    "user_id": user_id,
                    **payload,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            
    except Exception as e:
        logger.error("Video generation failed", error=str(e), user_id=user_id)
        await context.bot.send_message(
            chat_id=user_id,
            text="❌ Ошибка запуска генерации. Попробуйте позже.",
        )


async def handle_image_generation(user_id: int, payload: dict, context: ContextTypes.DEFAULT_TYPE):
    """Handle image generation request from WebApp"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/generation/image",
                json={
                    "user_id": user_id,
                    **payload,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            
    except Exception as e:
        logger.error("Image generation failed", error=str(e), user_id=user_id)
        await context.bot.send_message(
            chat_id=user_id,
            text="❌ Ошибка запуска генерации. Попробуйте позже.",
        )


async def handle_payment_confirm(user_id: int, payload: dict, context: ContextTypes.DEFAULT_TYPE):
    """Handle payment confirmation from WebApp"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/user/topup",
                json={
                    "user_id": user_id,
                    "credits": payload.get("credits", 100),
                    "amount_uzs": payload.get("amount_uzs", 50000),
                    "screenshot_base64": payload.get("screenshot"),
                },
                timeout=15.0,
            )
            response.raise_for_status()
            
    except Exception as e:
        logger.error("Payment confirm failed", error=str(e), user_id=user_id)


async def handle_withdraw_request(user_id: int, payload: dict, context: ContextTypes.DEFAULT_TYPE):
    """Handle withdrawal request from WebApp"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_BASE}/api/user/withdraw",
                json={
                    "user_id": user_id,
                    "amount_uzs": payload.get("amount"),
                    "card_number": payload.get("card"),
                },
                timeout=15.0,
            )
            response.raise_for_status()
            
    except Exception as e:
        logger.error("Withdraw request failed", error=str(e), user_id=user_id)


# ========== SETUP ==========

def setup_handlers(application):
    """Setup all bot handlers"""
    # Commands
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("balance", balance_command))
    
    # Callbacks
    application.add_handler(CallbackQueryHandler(callback_handler))
    
    # WebApp data
    application.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, webapp_data_handler))
