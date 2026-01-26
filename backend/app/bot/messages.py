"""
Bot message templates
"""


def welcome_message(first_name: str, credits: int) -> str:
    return f"""👋 <b>Привет, {first_name}!</b>

Добро пожаловать в <b>NanoGen</b> — AI генератор видео и изображений.

💎 <b>Ваш баланс:</b> {credits} кредитов

Выберите действие:"""


def main_menu_message(credits: int) -> str:
    return f"""🤖 <b>NanoGen AI</b>

💎 <b>Баланс:</b> {credits} кредитов

Выберите раздел:"""


def video_menu_message() -> str:
    return """🎬 <b>Генерация видео</b>

Выберите модель для создания видео:

⚡ <b>Kling 2.6 Pro</b> — лучшее качество
🧠 <b>Kling O1</b> — умный режим
🌐 <b>Veo 3.1</b> — от Google
✨ <b>Sora 2</b> — от OpenAI
🎬 <b>Runway Gen4</b> — кинематограф
"""


def image_menu_message() -> str:
    return """🖼 <b>Генерация изображений</b>

Выберите модель для создания изображения:

🤖 <b>GPT Image</b> — от OpenAI
🌈 <b>Imagen 4</b> — от Google
🍌 <b>Nano Banana</b> — быстрый и дешёвый
"""


def profile_message(
    username: str,
    user_id: int,
    credits: int,
    total_generations: int,
) -> str:
    return f"""👤 <b>Профиль</b>

🆔 <b>ID:</b> {user_id}
👤 <b>Username:</b> @{username or 'не указан'}

💎 <b>Баланс:</b> {credits} кредитов
🎨 <b>Генераций:</b> {total_generations}
"""


def referral_message(
    referral_code: str,
    total_referrals: int,
    active_referrals: int,
    total_earnings: int,
    available_balance: int,
) -> str:
    return f"""🤝 <b>Партнёрская программа</b>

📋 <b>Ваш код:</b> <code>{referral_code}</code>

📊 <b>Статистика:</b>
├ Приглашено: {total_referrals}
├ Активных: {active_referrals}
└ Заработано: {total_earnings:,} сум

💰 <b>Доступно к выводу:</b> {available_balance:,} сум

<i>Вы получаете 25% с каждого пополнения ваших рефералов!</i>
"""


def topup_message() -> str:
    return """💎 <b>Пополнение баланса</b>

Выберите количество кредитов:

• 10💎 = 10,000 сум
• 50💎 = 50,000 сум  
• 100💎 = 100,000 сум

Или введите своё количество."""


def model_info_message(model_name: str, price: int, description: str) -> str:
    return f"""🤖 <b>{model_name}</b>

{description}

💎 <b>Стоимость:</b> {price} кредитов

Нажмите кнопку ниже, чтобы открыть генератор и настроить параметры."""
