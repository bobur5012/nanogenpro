"""
Telegram Bot Service
Handles notifications to users and admin channel
"""
import httpx
from datetime import datetime
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup, InputFile
from telegram.constants import ParseMode
from io import BytesIO
import base64
import hmac
import hashlib
from urllib.parse import parse_qsl
from typing import Optional, Dict, Any

from app.config import settings
import structlog

logger = structlog.get_logger()


class TelegramService:
    """Service for interacting with Telegram"""
    
    def __init__(self):
        self.bot = Bot(token=settings.telegram_bot_token)
        self.webapp_url = settings.webapp_url
        self.admin_channel_id = settings.telegram_admin_channel_id
        self.bot_token = settings.telegram_bot_token
    
    def verify_init_data(self, init_data: str, user_id: Optional[int] = None) -> bool:
        """
        Verify Telegram WebApp init_data signature.
        
        Algorithm:
        1. Parse init_data into key-value pairs
        2. Extract 'hash' parameter
        3. Create data_check_string from all params except 'hash', sorted alphabetically
        4. Create secret_key = HMAC_SHA256(bot_token, "WebAppData")
        5. Calculate hash = HMAC_SHA256(secret_key, data_check_string)
        6. Compare with provided hash
        
        Args:
            init_data: Raw init_data string from Telegram WebApp
            user_id: Optional user_id to verify matches
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            # Parse init_data
            parsed = dict(parse_qsl(init_data))
            
            # Extract hash
            provided_hash = parsed.pop('hash', None)
            if not provided_hash:
                logger.warning("No hash in init_data")
                return False
            
            # Verify user_id if provided
            if user_id is not None:
                parsed_user_id = parsed.get('user')
                if parsed_user_id:
                    # user is JSON string, parse it
                    import json
                    try:
                        user_data = json.loads(parsed_user_id)
                        if user_data.get('id') != user_id:
                            logger.warning("User ID mismatch", expected=user_id, got=user_data.get('id'))
                            return False
                    except json.JSONDecodeError:
                        logger.warning("Invalid user JSON in init_data")
                        return False
            
            # Create data_check_string (sorted alphabetically)
            data_check_string = '\n'.join(
                f"{key}={value}"
                for key, value in sorted(parsed.items())
            )
            
            # Create secret_key
            secret_key = hmac.new(
                "WebAppData".encode(),
                self.bot_token.encode(),
                hashlib.sha256
            ).digest()
            
            # Calculate hash
            calculated_hash = hmac.new(
                secret_key,
                data_check_string.encode(),
                hashlib.sha256
            ).hexdigest()
            
            # Compare
            is_valid = hmac.compare_digest(calculated_hash, provided_hash)
            
            if not is_valid:
                logger.warning("Invalid init_data signature")
            
            return is_valid
            
        except Exception as e:
            logger.error("Error verifying init_data", error=str(e), error_type=type(e).__name__)
            return False
    
    def extract_user_from_init_data(self, init_data: str) -> Optional[Dict[str, Any]]:
        """
        Extract user data from init_data (after verification).
        
        Returns:
            User dict with id, first_name, username, etc. or None if invalid
        """
        try:
            parsed = dict(parse_qsl(init_data))
            user_str = parsed.get('user')
            if not user_str:
                return None
            
            import json
            return json.loads(user_str)
        except Exception as e:
            logger.error("Error extracting user from init_data", error=str(e))
            return None
    
    # ========== ADMIN CHANNEL: PAYMENTS ==========
    
    async def send_payment_to_channel(
        self,
        payment_id: int,
        user_id: int,
        username: str | None,
        first_name: str | None,
        credits: int,
        amount_uzs: int,
        screenshot_data: str | None = None,
    ) -> int:
        """
        Send payment request to admin channel for review.
        Returns message_id for callback tracking.
        """
        user_display = f"@{username}" if username else (first_name or f"ID: {user_id}")
        
        text = (
            f"💳 <b>ЗАЯВКА НА ПОПОЛНЕНИЕ</b>\n"
            f"━━━━━━━━━━━━━━━\n\n"
            f"👤 <b>Пользователь:</b> {user_display}\n"
            f"🆔 <b>User ID:</b> <code>{user_id}</code>\n"
            f"💎 <b>Кредиты:</b> {credits}\n"
            f"💵 <b>Сумма:</b> {amount_uzs:,} UZS\n"
            f"📅 <b>Дата:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}\n"
            f"🔢 <b>Заявка:</b> #{payment_id}\n"
        )
        
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ Подтвердить", callback_data=f"payment_approve:{payment_id}"),
                InlineKeyboardButton("❌ Отклонить", callback_data=f"payment_reject:{payment_id}"),
            ]
        ])
        
        try:
            if screenshot_data and screenshot_data.startswith("data:image"):
                # Extract base64 data
                base64_data = screenshot_data.split(",")[1] if "," in screenshot_data else screenshot_data
                image_bytes = base64.b64decode(base64_data)
                
                message = await self.bot.send_photo(
                    chat_id=self.admin_channel_id,
                    photo=BytesIO(image_bytes),
                    caption=text,
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                )
            else:
                message = await self.bot.send_message(
                    chat_id=self.admin_channel_id,
                    text=text + "\n⚠️ <i>Скриншот не прикреплён</i>",
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                )
            
            logger.info("Payment sent to admin channel", payment_id=payment_id, message_id=message.message_id)
            return message.message_id
            
        except Exception as e:
            logger.error("Failed to send payment to channel", error=str(e), payment_id=payment_id)
            raise
    
    # ========== ADMIN CHANNEL: WITHDRAWALS ==========
    
    async def send_withdrawal_to_channel(
        self,
        withdrawal_id: int,
        user_id: int,
        username: str | None,
        first_name: str | None,
        amount_uzs: int,
        card_number: str,
        card_type: str,
    ) -> int:
        """
        Send withdrawal request to admin channel for review.
        Returns message_id for callback tracking.
        """
        user_display = f"@{username}" if username else (first_name or f"ID: {user_id}")
        
        # Mask card number
        masked_card = f"{card_number[:4]} **** **** {card_number[-4:]}"
        
        text = (
            f"💸 <b>ЗАЯВКА НА ВЫВОД</b>\n"
            f"━━━━━━━━━━━━━━━\n\n"
            f"👤 <b>Партнёр:</b> {user_display}\n"
            f"🆔 <b>User ID:</b> <code>{user_id}</code>\n"
            f"💵 <b>Сумма:</b> {amount_uzs:,} UZS\n"
            f"💳 <b>Карта:</b> <code>{card_number}</code>\n"
            f"🏦 <b>Тип:</b> {card_type.upper()}\n"
            f"📅 <b>Дата:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}\n"
            f"🔢 <b>Заявка:</b> #{withdrawal_id}\n"
        )
        
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("✅ Выплачено", callback_data=f"withdraw_approve:{withdrawal_id}"),
                InlineKeyboardButton("❌ Отклонить", callback_data=f"withdraw_reject:{withdrawal_id}"),
            ]
        ])
        
        try:
            message = await self.bot.send_message(
                chat_id=self.admin_channel_id,
                text=text,
                parse_mode=ParseMode.HTML,
                reply_markup=keyboard,
            )
            
            logger.info("Withdrawal sent to admin channel", withdrawal_id=withdrawal_id, message_id=message.message_id)
            return message.message_id
            
        except Exception as e:
            logger.error("Failed to send withdrawal to channel", error=str(e), withdrawal_id=withdrawal_id)
            raise
    
    # ========== USER NOTIFICATIONS ==========
    
    async def send_payment_pending(
        self,
        user_id: int,
        credits: int,
        amount_uzs: int,
    ):
        """Notify user that payment is pending review"""
        text = (
            f"⏳ <b>Заявка на пополнение</b>\n\n"
            f"💎 Сумма: {credits} кредитов\n"
            f"💵 Стоимость: {amount_uzs:,} сум\n\n"
            f"Ожидайте подтверждения оператором (обычно 5-30 минут)."
        )
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
        )
    
    async def send_payment_confirmed(
        self,
        user_id: int,
        credits: int,
        new_balance: int,
    ):
        """Notify user that payment was confirmed"""
        text = (
            f"✅ <b>Баланс пополнен!</b>\n\n"
            f"💎 +{credits} кредитов\n"
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
    
    async def send_payment_rejected(
        self,
        user_id: int,
        reason: str = "Платёж не подтверждён",
    ):
        """Notify user that payment was rejected"""
        text = (
            f"❌ <b>Заявка отклонена</b>\n\n"
            f"Причина: {reason}\n\n"
            f"Если вы уверены, что оплата была произведена, "
            f"обратитесь в поддержку: @nanogen_support"
        )
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
        )
    
    async def send_withdrawal_pending(
        self,
        user_id: int,
        amount_uzs: int,
        card_number: str,
    ):
        """Notify user that withdrawal request is created"""
        masked = f"{card_number[:4]} **** **** {card_number[-4:]}"
        
        text = (
            f"⏳ <b>Заявка на вывод</b>\n\n"
            f"💵 Сумма: {amount_uzs:,} сум\n"
            f"💳 Карта: {masked}\n\n"
            f"Выплата будет произведена в течение 24 часов."
        )
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
        )
    
    async def send_withdrawal_confirmed(
        self,
        user_id: int,
        amount_uzs: int,
    ):
        """Notify user that withdrawal was completed"""
        text = (
            f"✅ <b>Выплата выполнена!</b>\n\n"
            f"💵 Сумма: {amount_uzs:,} сум\n\n"
            f"Деньги переведены на вашу карту."
        )
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
        )
    
    async def send_withdrawal_rejected(
        self,
        user_id: int,
        amount_uzs: int,
        reason: str = "Заявка отклонена",
    ):
        """Notify user that withdrawal was rejected"""
        text = (
            f"❌ <b>Заявка на вывод отклонена</b>\n\n"
            f"💵 Сумма: {amount_uzs:,} сум\n"
            f"Причина: {reason}\n\n"
            f"Средства возвращены на ваш партнёрский баланс."
        )
        
        await self.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.HTML,
        )
    
    # ========== GENERATION NOTIFICATIONS ==========
    
    async def send_generation_result(
        self,
        user_id: int,
        result_url: str,
        model_name: str,
        prompt: str,
        generation_type: str,
        generation_id: int,
    ):
        """Send generation result to user"""
        caption = (
            f"✨ <b>Генерация завершена!</b>\n\n"
            f"🤖 <b>Модель:</b> {model_name}\n"
            f"📝 <b>Промпт:</b> {prompt[:200]}{'...' if len(prompt) > 200 else ''}\n\n"
            f"🆔 #{generation_id}"
        )
        
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🔄 Ещё раз", callback_data=f"regenerate:{generation_id}"),
                InlineKeyboardButton("💎 Баланс", callback_data="profile"),
            ]
        ])
        
        try:
            if generation_type == "image":
                await self.bot.send_photo(
                    chat_id=user_id,
                    photo=result_url,
                    caption=caption,
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                )
            else:
                await self.bot.send_video(
                    chat_id=user_id,
                    video=result_url,
                    caption=caption,
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                    supports_streaming=True,
                )
            
        except Exception as e:
            logger.error("Failed to send result", error=str(e), user_id=user_id)
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
    
    # ========== REFERRAL NOTIFICATIONS ==========
    
    async def send_referral_commission(
        self,
        referrer_id: int,
        referred_name: str,
        commission: int,
        new_balance: int,
    ):
        """Notify partner about commission earned"""
        text = (
            f"🎉 <b>Партнёрское начисление!</b>\n\n"
            f"👤 Ваш реферал: {referred_name}\n"
            f"💵 Комиссия: +{commission:,} UZS\n"
            f"💰 Баланс: {new_balance:,} UZS"
        )
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("📊 Статистика", callback_data="referral_stats")],
        ])
        
        await self.bot.send_message(
            chat_id=referrer_id,
            text=text,
            parse_mode=ParseMode.HTML,
            reply_markup=keyboard,
        )


# Singleton
telegram_service = TelegramService()
