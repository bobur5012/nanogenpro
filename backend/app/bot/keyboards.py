"""
Telegram Bot Inline Keyboards
Direct Web App opening - no intermediate screens
"""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from app.config import settings


def main_menu_keyboard() -> InlineKeyboardMarkup:
    """Main menu - 2x2 grid"""
    webapp_url = settings.webapp_url
    
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🎬 Создать видео", callback_data="menu_video"),
            InlineKeyboardButton("🖼 Создать изображение", callback_data="menu_image"),
        ],
        [
            InlineKeyboardButton("👤 Профиль", web_app=WebAppInfo(url=f"{webapp_url}?screen=profile")),
            InlineKeyboardButton("🤝 Партнёрка", web_app=WebAppInfo(url=f"{webapp_url}?screen=referral")),
        ],
    ])


def video_models_keyboard() -> InlineKeyboardMarkup:
    """Video models - each button opens Web App directly"""
    webapp_url = settings.webapp_url
    
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⚡ Kling 2.6 Pro — 15💎", web_app=WebAppInfo(url=f"{webapp_url}/model/kling-2-6-pro"))],
        [InlineKeyboardButton("🎥 Kling I2V — 15💎", web_app=WebAppInfo(url=f"{webapp_url}/model/kling-i2v"))],
        [InlineKeyboardButton("🧠 Kling O1 — 10💎", web_app=WebAppInfo(url=f"{webapp_url}/model/kling-o1"))],
        [InlineKeyboardButton("💨 Kling Turbo — 7💎", web_app=WebAppInfo(url=f"{webapp_url}/model/kling-turbo"))],
        [InlineKeyboardButton("🌐 Veo 3.1 — 20💎", web_app=WebAppInfo(url=f"{webapp_url}/model/veo-3-1"))],
        [InlineKeyboardButton("✨ Sora 2 Pro — 20💎", web_app=WebAppInfo(url=f"{webapp_url}/model/sora-2-pro"))],
        [InlineKeyboardButton("🎬 Runway Gen4 — 15💎", web_app=WebAppInfo(url=f"{webapp_url}/model/runway-gen4"))],
        [InlineKeyboardButton("🌱 Seedance — 8💎", web_app=WebAppInfo(url=f"{webapp_url}/model/seedance"))],
        [InlineKeyboardButton("🌊 Wan 2.5 — 5💎", web_app=WebAppInfo(url=f"{webapp_url}/model/wan-2-5"))],
        [InlineKeyboardButton("🌊 Wan 2.6 — 7💎", web_app=WebAppInfo(url=f"{webapp_url}/model/wan-2-6"))],
        [InlineKeyboardButton("◀️ Назад", callback_data="back_main")],
    ])


def image_models_keyboard() -> InlineKeyboardMarkup:
    """Image models - each button opens Web App directly"""
    webapp_url = settings.webapp_url
    
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🤖 GPT Image — 5💎", web_app=WebAppInfo(url=f"{webapp_url}/model/gpt-image"))],
        [InlineKeyboardButton("🌈 Imagen 4 — 4💎", web_app=WebAppInfo(url=f"{webapp_url}/model/imagen-4"))],
        [InlineKeyboardButton("🍌 Nano Banana — 1💎", web_app=WebAppInfo(url=f"{webapp_url}/model/nano-banana"))],
        [InlineKeyboardButton("🔧 Upscale — 2💎", web_app=WebAppInfo(url=f"{webapp_url}/model/upscale"))],
        [InlineKeyboardButton("◀️ Назад", callback_data="back_main")],
    ])


def back_keyboard() -> InlineKeyboardMarkup:
    """Simple back button"""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("◀️ Назад", callback_data="back_main")],
    ])
