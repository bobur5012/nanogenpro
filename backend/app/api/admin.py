"""
Admin API endpoints
Handles payment/withdrawal confirmations from Telegram admin channel
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.services.payment import payment_service
from app.services.telegram import telegram_service
from app.services.referral import referral_service
from app.models import User, Payment, Withdrawal, PaymentStatus, WithdrawalStatus
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ========== SCHEMAS ==========

class PaymentActionRequest(BaseModel):
    payment_id: int
    admin_id: int
    action: str  # "approve" or "reject"
    reason: Optional[str] = None


class WithdrawalActionRequest(BaseModel):
    withdrawal_id: int
    admin_id: int
    action: str  # "approve" or "reject"
    reason: Optional[str] = None


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    pending_payments: int
    pending_withdrawals: int
    total_revenue_uzs: int
    total_payouts_uzs: int


# ========== PAYMENT ACTIONS ==========

@router.post("/payment/action")
async def handle_payment_action(
    request: PaymentActionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle payment approval/rejection from admin channel.
    """
    try:
        # Verify admin
        admin = await db.get(User, request.admin_id)
        if not admin or not admin.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        if request.action == "approve":
            result = await payment_service.confirm_topup(
                db, request.payment_id, request.admin_id
            )
            
            # Notify user
            await telegram_service.send_payment_confirmed(
                user_id=result["user_id"],
                credits=result["credits_added"],
                new_balance=result["new_balance"],
            )
            
            # Notify referrer about commission if applicable
            if result.get("commission_info"):
                commission = result["commission_info"]
                user = await db.get(User, result["user_id"])
                referrer = await db.get(User, commission["referrer_id"])
                
                if referrer:
                    await telegram_service.send_referral_commission(
                        referrer_id=referrer.id,
                        referred_name=user.first_name or user.username or f"User #{user.id}",
                        commission=commission["commission"],
                        new_balance=commission["referrer_new_balance"],
                    )
            
            return {"status": "approved", **result}
            
        elif request.action == "reject":
            result = await payment_service.reject_topup(
                db, request.payment_id, request.admin_id, request.reason or "Платёж не подтверждён"
            )
            
            # Notify user
            await telegram_service.send_payment_rejected(
                user_id=result["user_id"],
                reason=result["reason"],
            )
            
            return {"status": "rejected", **result}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== WITHDRAWAL ACTIONS ==========

@router.post("/withdrawal/action")
async def handle_withdrawal_action(
    request: WithdrawalActionRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle withdrawal approval/rejection from admin channel.
    """
    try:
        # Verify admin
        admin = await db.get(User, request.admin_id)
        if not admin or not admin.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        if request.action == "approve":
            result = await payment_service.confirm_withdrawal(
                db, request.withdrawal_id, request.admin_id
            )
            
            # Notify user
            await telegram_service.send_withdrawal_confirmed(
                user_id=result["user_id"],
                amount_uzs=result["amount_uzs"],
            )
            
            return {"status": "approved", **result}
            
        elif request.action == "reject":
            result = await payment_service.reject_withdrawal(
                db, request.withdrawal_id, request.admin_id, request.reason or "Заявка отклонена"
            )
            
            # Notify user
            await telegram_service.send_withdrawal_rejected(
                user_id=result["user_id"],
                amount_uzs=result["amount_uzs"],
                reason=result["reason"],
            )
            
            return {"status": "rejected", **result}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ========== ADMIN STATISTICS ==========

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get admin dashboard statistics"""
    from sqlalchemy import select, func
    
    # Verify admin
    admin = await db.get(User, admin_id)
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Total users
    result = await db.execute(select(func.count(User.id)))
    total_users = result.scalar()
    
    # Active users (with at least 1 generation)
    result = await db.execute(
        select(func.count(User.id)).where(User.total_generations > 0)
    )
    active_users = result.scalar()
    
    # Pending payments
    result = await db.execute(
        select(func.count(Payment.id)).where(Payment.status == PaymentStatus.PENDING)
    )
    pending_payments = result.scalar()
    
    # Pending withdrawals
    result = await db.execute(
        select(func.count(Withdrawal.id)).where(
            Withdrawal.status.in_([WithdrawalStatus.PENDING, WithdrawalStatus.FROZEN])
        )
    )
    pending_withdrawals = result.scalar()
    
    # Total revenue
    result = await db.execute(
        select(func.sum(Payment.amount_uzs)).where(Payment.status == PaymentStatus.APPROVED)
    )
    total_revenue = result.scalar() or 0
    
    # Total payouts
    result = await db.execute(
        select(func.sum(Withdrawal.amount_uzs)).where(Withdrawal.status == WithdrawalStatus.APPROVED)
    )
    total_payouts = result.scalar() or 0
    
    return AdminStatsResponse(
        total_users=total_users,
        active_users=active_users,
        pending_payments=pending_payments,
        pending_withdrawals=pending_withdrawals,
        total_revenue_uzs=total_revenue,
        total_payouts_uzs=total_payouts,
    )


@router.get("/payments/pending")
async def get_pending_payments(
    admin_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get list of pending payments"""
    from sqlalchemy import select
    from datetime import datetime
    
    # Verify admin
    admin = await db.get(User, admin_id)
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.execute(
        select(Payment)
        .where(Payment.status == PaymentStatus.PENDING)
        .order_by(Payment.created_at.desc())
        .limit(50)
    )
    payments = result.scalars().all()
    
    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "amount_uzs": p.amount_uzs,
            "credits": p.credits,
            "screenshot_url": p.screenshot_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payments
    ]


@router.get("/withdrawals/pending")
async def get_pending_withdrawals(
    admin_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get list of pending withdrawals"""
    from sqlalchemy import select
    
    # Verify admin
    admin = await db.get(User, admin_id)
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.execute(
        select(Withdrawal)
        .where(Withdrawal.status.in_([WithdrawalStatus.PENDING, WithdrawalStatus.FROZEN]))
        .order_by(Withdrawal.created_at.desc())
        .limit(50)
    )
    withdrawals = result.scalars().all()
    
    return [
        {
            "id": w.id,
            "user_id": w.user_id,
            "amount_uzs": w.amount_uzs,
            "card_number": w.card_number,
            "card_type": w.card_type.value if w.card_type else None,
            "status": w.status.value,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in withdrawals
    ]


# ========== USER MANAGEMENT ==========

@router.post("/user/{user_id}/credits")
async def adjust_user_credits(
    user_id: int,
    admin_id: int,
    amount: int,
    reason: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Manually adjust user credits (add or remove).
    Amount can be positive (add) or negative (remove).
    """
    # Verify admin
    admin = await db.get(User, admin_id)
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_balance = user.credits
    user.credits += amount
    
    if user.credits < 0:
        raise HTTPException(status_code=400, detail="Cannot set negative balance")
    
    await db.commit()
    
    logger.info(
        "Admin credits adjustment",
        user_id=user_id,
        admin_id=admin_id,
        amount=amount,
        reason=reason,
        old_balance=old_balance,
        new_balance=user.credits,
    )
    
    return {
        "user_id": user_id,
        "old_balance": old_balance,
        "new_balance": user.credits,
        "adjustment": amount,
        "reason": reason,
    }


@router.post("/user/{user_id}/ban")
async def ban_user(
    user_id: int,
    admin_id: int,
    reason: str,
    db: AsyncSession = Depends(get_db),
):
    """Ban a user"""
    admin = await db.get(User, admin_id)
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_banned = True
    await db.commit()
    
    logger.info("User banned", user_id=user_id, admin_id=admin_id, reason=reason)
    
    return {"user_id": user_id, "is_banned": True}


@router.post("/user/{user_id}/unban")
async def unban_user(
    user_id: int,
    admin_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Unban a user"""
    admin = await db.get(User, admin_id)
    if not admin or not admin.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_banned = False
    await db.commit()
    
    logger.info("User unbanned", user_id=user_id, admin_id=admin_id)
    
    return {"user_id": user_id, "is_banned": False}
