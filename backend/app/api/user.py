"""
User API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.user import UserCreate, UserResponse, UserBalance, TelegramUser
from app.schemas.payment import TopUpRequest, WithdrawRequest
from app.services.user import user_service
from app.services.balance import balance_service
from app.services.telegram import telegram_service
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/user", tags=["User"])


@router.post("/auth", response_model=UserResponse)
async def authenticate_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate or register user from Telegram
    Called when Web App opens
    """
    try:
        user = await user_service.get_or_create_user(
            db,
            data.telegram_user,
            data.referral_code,
        )
        
        return UserResponse(
            id=user.id,
            username=user.username,
            first_name=user.first_name,
            credits=user.credits,
            referral_code=user.referral_code,
            total_generations=user.total_generations,
            is_premium=user.is_premium,
            created_at=user.created_at,
        )
        
    except Exception as e:
        logger.error("User auth failed", error=str(e))
        raise HTTPException(status_code=500, detail="Authentication failed")


@router.get("/balance/{user_id}", response_model=UserBalance)
async def get_user_balance(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get user balance"""
    try:
        return await balance_service.get_balance(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/topup")
async def request_topup(
    request: TopUpRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Request balance top-up
    Creates pending transaction for admin approval
    """
    try:
        transaction_id = await balance_service.process_topup(
            db,
            request.user_id,
            request.amount,
            request.amount_uzs,
            request.screenshot_base64,
        )
        
        # Notify user
        await telegram_service.send_payment_pending(
            user_id=request.user_id,
            amount=request.amount,
            amount_uzs=request.amount_uzs,
        )
        
        return {
            "transaction_id": transaction_id,
            "status": "pending",
            "message": "Заявка создана. Ожидайте подтверждения.",
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/withdraw")
async def request_withdrawal(
    request: WithdrawRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Request withdrawal from referral balance
    """
    try:
        transaction_id = await balance_service.process_withdrawal(
            db,
            request.user_id,
            request.amount,
            request.card_number,
        )
        
        return {
            "transaction_id": transaction_id,
            "status": "pending",
            "message": "Заявка на вывод создана.",
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/referral/{user_id}")
async def get_referral_stats(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get user's referral statistics"""
    try:
        return await user_service.get_referral_stats(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
