"""
Telegram Bot Service for sending results to users
"""
import httpx
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.constants import ParseMode
from app.config import settings
import structlog

logger = structlog.get_logger()


class TelegramService:
    """Service for interacting with Telegram"""
    
    def __init__(self):
        self.bot = Bot(token=settings.telegram_bot_token)
        self.webapp_url = settings.webapp_url
    
    async def send_generation_result(
        self,
        user_id: int,
        result_url: str,
        model_name: str,
        prompt: str,
        generation_type: str,  # "image" or "video"
        generation_id: int,
    ):
        """Send generation result to user"""
        
        # Build caption
        caption = (
            f"✨ <b>Генерация завершена!</b>\n\n"
            f"🤖 <b>Модель:</b> {model_name}\n"
            f"📝 <b>Промпт:</b> {prompt[:200]}{'...' if len(prompt) > 200 else ''}\n\n"
            f"🆔 #{generation_id}"
        )
        
        # Keyboard with actions
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🔄 Ещё раз", callback_data=f"regenerate:{generation_id}"),
                InlineKeyboardButton("💎 Баланс", callback_data="profile"),
            ]
        ])
        
        try:
            if generation_type == "image":
                # Download and send image
                async with httpx.AsyncClient() as client:
                    response = await client.get(result_url)
                    response.raise_for_status()
                    
                await self.bot.send_photo(
                    chat_id=user_id,
                    photo=result_url,
                    caption=caption,
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                )
            else:
                # Download and send video
                await self.bot.send_video(
                    chat_id=user_id,
                    video=result_url,
                    caption=caption,
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                    supports_streaming=True,
                )
            
            logger.info("Result sent to user", user_id=user_id, generation_id=generation_id)
            
        except Exception as e:
            logger.error("Failed to send result", error=str(e), user_id=user_id)
            # Try to send as document if direct send fails
            try:
                await self.bot.send_document(
                    chat_id=user_id,
                    document=result_url,
                    caption=caption,
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                )
            except Exception as e2:
                logger.error("Failed to send as document", error=str(e2))
                raise
    
    async def send_generation_error(
        self,
        user_id: int,
        model_name: str,
        error_message: str,
        credits_refunded: int,
    ):
        """Notify user about failed generation"""
        
        text = (
            f"❌ <b>Ошибка генерации</b>\n\n"
            f"🤖 Модель: {model_name}\n"
            f"⚠️ {error_message}\n\n"
            f"💎 Возвращено: {credits_refunded} кредитов"
        )
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔄 Попробовать снова", callback_data="menu_video")],
            [InlineKeyboardButton("💬 Поддержка", url="https://t.me/nanogen_support")],
        ])
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
            reply_markup=keyboard,
        )
    
    async def send_generation_started(
        self,
        user_id: int,
        model_name: str,
        estimated_time: int,
    ):
        """Notify user that generation has started"""
        
        text = (
            f"⏳ <b>Генерация началась!</b>\n\n"
            f"🤖 Модель: {model_name}\n"
            f"⏱ Примерное время: ~{estimated_time // 60} мин.\n\n"
            f"Результат придёт в этот чат."
        )
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
        )
    
    async def send_payment_pending(
        self,
        user_id: int,
        amount: int,
        amount_uzs: int,
    ):
        """Notify user that payment is pending review"""
        
        text = (
            f"⏳ <b>Заявка на пополнение</b>\n\n"
            f"💎 Сумма: {amount} кредитов\n"
            f"💵 Стоимость: {amount_uzs:,} сум\n\n"
            f"Ожидайте подтверждения оператором."
        )
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
        )
    
    async def send_payment_confirmed(
        self,
        user_id: int,
        amount: int,
        new_balance: int,
    ):
        """Notify user that payment was confirmed"""
        
        text = (
            f"✅ <b>Баланс пополнен!</b>\n\n"
            f"💎 +{amount} кредитов\n"
            f"💰 Текущий баланс: {new_balance} 💎"
        )
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🎬 Создать видео", callback_data="menu_video")],
            [InlineKeyboardButton("🖼 Создать изображение", callback_data="menu_image")],
        ])
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
            reply_markup=keyboard,
        )


# Singleton
telegram_service = TelegramService()
