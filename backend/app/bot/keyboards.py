"""
Telegram Bot Inline Keyboards
"""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from app.config import settings


def main_menu_keyboard() -> InlineKeyboardMarkup:
    """Main menu keyboard"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🎬 Создать видео", callback_data="menu_video")],
        [InlineKeyboardButton("🖼 Создать изображение", callback_data="menu_image")],
        [InlineKeyboardButton("👤 Профиль", callback_data="profile")],
        [InlineKeyboardButton("🤝 Партнёрка", callback_data="referral")],
    ])


def video_models_keyboard() -> InlineKeyboardMarkup:
    """Video generation models selection"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⚡ Kling 2.6 Pro — 15💎", callback_data="model:kling-2-6-pro")],
        [InlineKeyboardButton("🎥 Kling I2V — 15💎", callback_data="model:kling-i2v")],
        [InlineKeyboardButton("🧠 Kling O1 — 10💎", callback_data="model:kling-o1")],
        [InlineKeyboardButton("💨 Kling Turbo — 7💎", callback_data="model:kling-turbo")],
        [InlineKeyboardButton("🌐 Veo 3.1 — 20💎", callback_data="model:veo-3-1")],
        [InlineKeyboardButton("✨ Sora 2 Pro — 20💎", callback_data="model:sora-2-pro")],
        [InlineKeyboardButton("🎬 Runway Gen4 — 15💎", callback_data="model:runway-gen4")],
        [InlineKeyboardButton("🌱 Seedance — 8💎", callback_data="model:seedance")],
        [InlineKeyboardButton("🌊 Wan 2.5 — 5💎", callback_data="model:wan-2-5")],
        [InlineKeyboardButton("🌊 Wan 2.6 — 7💎", callback_data="model:wan-2-6")],
        [InlineKeyboardButton("◀️ Назад", callback_data="back_main")],
    ])


def image_models_keyboard() -> InlineKeyboardMarkup:
    """Image generation models selection"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🤖 GPT Image — 5💎", callback_data="model:gpt-image")],
        [InlineKeyboardButton("🌈 Imagen 4 — 4💎", callback_data="model:imagen-4")],
        [InlineKeyboardButton("🍌 Nano Banana — 1💎", callback_data="model:nano-banana")],
        [InlineKeyboardButton("🔧 Upscale — 2💎", callback_data="model:upscale")],
        [InlineKeyboardButton("◀️ Назад", callback_data="back_main")],
    ])


def profile_keyboard(user_id: int) -> InlineKeyboardMarkup:
    """Profile keyboard"""
    webapp_url = f"{settings.webapp_url}/model/profile?user_id={user_id}"
    
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("💎 Пополнить баланс", callback_data="topup")],
        [InlineKeyboardButton("🤝 Партнёрка", callback_data="referral")],
        [InlineKeyboardButton("📜 История", callback_data="history")],
        [InlineKeyboardButton("◀️ Назад", callback_data="back_main")],
    ])


def referral_keyboard(referral_link: str) -> InlineKeyboardMarkup:
    """Referral program keyboard"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 Скопировать ссылку", callback_data="copy_ref_link")],
        [InlineKeyboardButton("📊 Статистика", callback_data="referral_stats")],
        [InlineKeyboardButton("💰 Вывод средств", callback_data="withdraw")],
        [InlineKeyboardButton("◀️ Назад", callback_data="back_main")],
    ])


def topup_keyboard() -> InlineKeyboardMarkup:
    """Top-up amounts selection"""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("10💎 — 10K", callback_data="topup:10"),
            InlineKeyboardButton("50💎 — 50K", callback_data="topup:50"),
            InlineKeyboardButton("100💎 — 100K", callback_data="topup:100"),
        ],
        [InlineKeyboardButton("◀️ Назад", callback_data="profile")],
    ])


def open_webapp_keyboard(model_slug: str) -> InlineKeyboardMarkup:
    """Open Web App for specific model"""
    webapp_url = f"{settings.webapp_url}/model/{model_slug}"
    
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🚀 Открыть генератор", web_app={"url": webapp_url})],
        [InlineKeyboardButton("◀️ Назад", callback_data="back_main")],
    ])
