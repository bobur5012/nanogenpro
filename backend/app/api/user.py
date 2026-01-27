"""
User API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.schemas.user import UserCreate, UserResponse, UserBalance, TelegramUser
from app.api.deps import require_telegram_user, require_current_user
from app.services.user import user_service
from app.services.referral import referral_service
from app.services.payment import payment_service
from app.services.telegram import telegram_service
from app.config import settings
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/user", tags=["User"])


# ========== SCHEMAS ==========

class TopUpRequest(BaseModel):
    user_id: int
    credits: int
    amount_uzs: int
    screenshot_base64: Optional[str] = None


class WithdrawRequest(BaseModel):
    user_id: int
    amount_uzs: int
    card_number: str


class PartnerStatsResponse(BaseModel):
    referral_code: str
    referral_link: str
    total_earned: int
    available_balance: int
    total_withdrawn: int
    referrals_total: int
    referrals_active: int
    saved_card: Optional[str]
    saved_card_type: Optional[str]
    min_withdrawal: int
    commission_percent: int


# ========== ENDPOINTS ==========

@router.post("/auth")
async def authenticate_user(
    data: UserCreate,
    tg_user: dict = Depends(require_telegram_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate or register user from Telegram WebApp.
    Handles referral linking on first registration.
    """
    try:
        tg_payload = TelegramUser(
            id=tg_user["id"],
            username=tg_user.get("username"),
            first_name=tg_user.get("first_name"),
            last_name=tg_user.get("last_name"),
            language_code=tg_user.get("language_code") or "ru",
        )

        if data.telegram_user.id != tg_payload.id:
            logger.warning(
                "Telegram user mismatch in auth payload",
                body_user_id=data.telegram_user.id,
                tg_user_id=tg_payload.id,
            )

        user = await user_service.get_or_create_user(db, tg_payload, data.referral_code)
        
        # Process referral if provided and not already linked
        if data.referral_code and not user.referrer_id:
            await referral_service.process_referral(db, user.id, data.referral_code)
        
        # Return format expected by frontend
        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "language_code": user.language_code,
            },
            "credits": user.credits,
        }
        
    except Exception as e:
        logger.error("User auth failed", error=str(e))
        raise HTTPException(status_code=500, detail="Authentication failed")


@router.get("/balance/{user_id}")
async def get_user_balance(
    user_id: int,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user balance"""
    from app.models import User
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "credits": user.credits,
        "referral_balance": user.referral_balance,
        "referral_total_earned": user.referral_total_earned,
    }


# ========== TOP-UP ==========

@router.get("/packages")
async def get_credit_packages():
    """Get available credit packages"""
    return {
        "packages": payment_service.get_credit_packages(),
        "card": {
            "number": settings.payment_card_number,
            "holder": settings.payment_card_holder,
            "type": settings.payment_card_type,
        },
    }


@router.post("/topup")
async def request_topup(
    request: TopUpRequest,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Request balance top-up.
    Creates pending payment for admin approval.
    """
    try:
        # Create payment record
        if request.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

        payment_info = await payment_service.create_topup_request(
            db,
            request.user_id,
            request.credits,
            request.amount_uzs,
            request.screenshot_base64,
        )
        
        if payment_info.get("is_duplicate"):
            return {
                "payment_id": payment_info["payment_id"],
                "status": payment_info["status"],
                "message": "Заявка уже существует",
            }
        
        # Send to admin channel
        message_id = await telegram_service.send_payment_to_channel(
            payment_id=payment_info["payment_id"],
            user_id=request.user_id,
            username=payment_info["username"],
            first_name=payment_info["first_name"],
            credits=request.credits,
            amount_uzs=request.amount_uzs,
            screenshot_data=request.screenshot_base64,
        )
        
        # Update payment with message_id
        from app.models import Payment
        payment = await db.get(Payment, payment_info["payment_id"])
        if payment:
            payment.telegram_message_id = message_id
            await db.commit()
        
        # Notify user
        await telegram_service.send_payment_pending(
            user_id=request.user_id,
            credits=request.credits,
            amount_uzs=request.amount_uzs,
        )
        
        return {
            "payment_id": payment_info["payment_id"],
            "status": "pending",
            "message": "Заявка создана. Ожидайте подтверждения.",
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== WITHDRAWAL ==========

@router.post("/withdraw")
async def request_withdrawal(
    request: WithdrawRequest,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Request withdrawal from referral balance.
    Freezes amount and sends request to admin channel.
    """
    try:
        # Create withdrawal record
        if request.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

        withdrawal_info = await payment_service.create_withdrawal_request(
            db,
            request.user_id,
            request.amount_uzs,
            request.card_number,
        )
        
        # Send to admin channel
        message_id = await telegram_service.send_withdrawal_to_channel(
            withdrawal_id=withdrawal_info["withdrawal_id"],
            user_id=request.user_id,
            username=withdrawal_info["username"],
            first_name=withdrawal_info["first_name"],
            amount_uzs=request.amount_uzs,
            card_number=withdrawal_info["card_number"],
            card_type=withdrawal_info["card_type"],
        )
        
        # Update withdrawal with message_id
        from app.models import Withdrawal
        withdrawal = await db.get(Withdrawal, withdrawal_info["withdrawal_id"])
        if withdrawal:
            withdrawal.telegram_message_id = message_id
            await db.commit()
        
        # Notify user
        await telegram_service.send_withdrawal_pending(
            user_id=request.user_id,
            amount_uzs=request.amount_uzs,
            card_number=withdrawal_info["card_number"],
        )
        
        return {
            "withdrawal_id": withdrawal_info["withdrawal_id"],
            "status": "frozen",
            "message": "Заявка на вывод создана.",
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== REFERRAL / PARTNER ==========

@router.get("/partner/{user_id}", response_model=PartnerStatsResponse)
async def get_partner_stats(
    user_id: int,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's partner program statistics"""
    try:
        if user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        stats = await referral_service.get_partner_stats(db, user_id)
        return PartnerStatsResponse(**stats)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/partner/{user_id}/referrals")
async def get_partner_referrals(
    user_id: int,
    current_user=Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get list of user's referrals"""
    try:
        if user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        referrals = await referral_service.get_referral_list(db, user_id)
        return {"referrals": referrals}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
