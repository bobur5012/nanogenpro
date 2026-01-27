"""
Script to make a user an admin by Telegram user ID.

Usage:
    # Option 1: Via environment variable (recommended)
    export TELEGRAM_ADMIN_ID=123456789
    python -m scripts.make_admin
    
    # Option 2: Via command line argument
    python -m scripts.make_admin 123456789

Example:
    export TELEGRAM_ADMIN_ID=123456789
    python -m scripts.make_admin
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load .env file if exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"📄 Загружен .env файл: {env_path}")
except ImportError:
    pass  # python-dotenv not installed, skip

from app.database import AsyncSessionLocal
from app.models import User
import structlog

logger = structlog.get_logger()


async def make_admin(telegram_id: int):
    """Make a user an admin by Telegram ID"""
    async with AsyncSessionLocal() as db:
        # In User model, 'id' is the Telegram user ID (primary key)
        user = await db.get(User, telegram_id)
        
        if not user:
            print(f"❌ Пользователь с Telegram ID {telegram_id} не найден в базе данных.")
            print("💡 Пользователь должен сначала запустить бота или открыть WebApp.")
            print("   После первого запуска пользователь будет создан автоматически.")
            return False
        
        if user.is_admin:
            print(f"✅ Пользователь {telegram_id} уже является администратором.")
            print(f"   Telegram ID: {user.id}")
            print(f"   Username: @{user.username or 'N/A'}")
            print(f"   Имя: {user.first_name or 'N/A'}")
            return True
        
        user.is_admin = True
        await db.commit()
        
        print(f"✅ Пользователь {telegram_id} теперь администратор!")
        print(f"   Telegram ID: {user.id}")
        print(f"   Username: @{user.username or 'N/A'}")
        print(f"   Имя: {user.first_name or 'N/A'}")
        print(f"\n📱 Теперь откройте WebApp и перейдите в DebugHub → Админ панель")
        print(f"   Или откройте напрямую: ?screen=admin")
        return True


async def main():
    # Try to get Telegram ID from environment variable first (from .env or system env)
    telegram_id = os.getenv("TELEGRAM_ADMIN_ID")
    
    # If not in env, try command line argument
    if not telegram_id and len(sys.argv) >= 2:
        telegram_id = sys.argv[1]
    
    # If still not found, show help
    if not telegram_id:
        print("❌ Telegram User ID не указан!")
        print("\nСпособы использования:")
        print("\n1️⃣ Через .env файл (рекомендуется):")
        print("   Добавьте в backend/.env:")
        print("   TELEGRAM_ADMIN_ID=123456789")
        print("   Затем запустите: python -m scripts.make_admin")
        print("\n2️⃣ Через переменную окружения:")
        print("   export TELEGRAM_ADMIN_ID=123456789")
        print("   python -m scripts.make_admin")
        print("\n3️⃣ Через аргумент командной строки:")
        print("   python -m scripts.make_admin 123456789")
        print("\n💡 Как узнать свой Telegram User ID:")
        print("  1. Откройте бота @userinfobot в Telegram")
        print("  2. Отправьте команду /start")
        print("  3. Скопируйте ваш ID")
        sys.exit(1)
    
    try:
        user_id = int(telegram_id)
    except ValueError:
        print(f"❌ Неверный формат ID: {telegram_id}")
        print("   ID должен быть числом (например: 123456789)")
        sys.exit(1)
    
    await make_admin(user_id)


if __name__ == "__main__":
    asyncio.run(main())
