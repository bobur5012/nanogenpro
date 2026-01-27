"""
API dependencies for authentication and authorization.
"""
from typing import Dict, Any

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.services.telegram import telegram_service


async def require_telegram_user(
    init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
) -> Dict[str, Any]:
    """
    Validate Telegram WebApp init_data and return user payload.
    """
    if not init_data:
        raise HTTPException(
            status_code=401,
            detail={"code": "MISSING_INIT_DATA", "message": "Требуется init_data"},
        )

    if not telegram_service.verify_init_data(init_data):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_SIGNATURE", "message": "Недействительная подпись"},
        )

    user_data = telegram_service.extract_user_from_init_data(init_data)
    if not user_data or "id" not in user_data:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_USER", "message": "Некорректные данные пользователя"},
        )

    return user_data


async def require_current_user(
    db: AsyncSession = Depends(get_db),
    tg_user: Dict[str, Any] = Depends(require_telegram_user),
) -> User:
    """
    Load current user from DB using Telegram verified user id.
    """
    user = await db.get(User, tg_user["id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="User is banned")
    return user


async def require_admin_user(
    current_user: User = Depends(require_current_user),
) -> User:
    """
    Ensure current user is admin.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user
