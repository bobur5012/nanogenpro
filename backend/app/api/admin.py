"""
Admin API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import Transaction, TransactionType, User
from app.services.balance import balance_service
from app.services.telegram import telegram_service
from app.config import settings
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/admin", tags=["Admin"])


async def verify_admin(x_admin_key: str = Header(...)):
    """Simple admin auth via header"""
    if x_admin_key != settings.secret_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return True


@router.get("/pending-payments")
async def get_pending_payments(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Get all pending top-up requests"""
    stmt = (
        select(Transaction)
        .where(
            Transaction.type == TransactionType.TOPUP,
            Transaction.payment_status == "pending",
        )
        .order_by(desc(Transaction.created_at))
    )
    
    result = await db.execute(stmt)
    transactions = result.scalars().all()
    
    items = []
    for t in transactions:
        user = await db.get(User, t.user_id)
        items.append({
            "transaction_id": t.id,
            "user_id": t.user_id,
            "username": user.username if user else None,
            "amount_credits": t.amount,
            "amount_uzs": t.amount_uzs,
            "has_screenshot": bool(t.payment_screenshot),
            "created_at": t.created_at.isoformat(),
        })
    
    return {"items": items, "total": len(items)}


@router.post("/approve-payment/{transaction_id}")
async def approve_payment(
    transaction_id: int,
    admin_id: int = 0,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Approve a pending top-up"""
    try:
        result = await balance_service.confirm_topup(db, transaction_id, admin_id)
        
        # Notify user
        await telegram_service.send_payment_confirmed(
            user_id=result["user_id"],
            amount=result["amount"],
            new_balance=result["new_balance"],
        )
        
        return {
            "status": "approved",
            "message": f"Payment approved. User {result['user_id']} received {result['amount']} credits.",
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reject-payment/{transaction_id}")
async def reject_payment(
    transaction_id: int,
    reason: str = "Payment rejected",
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Reject a pending top-up"""
    transaction = await db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction.payment_status = "rejected"
    transaction.description = f"{transaction.description} | Rejected: {reason}"
    await db.commit()
    
    return {"status": "rejected", "message": "Payment rejected"}


@router.get("/pending-withdrawals")
async def get_pending_withdrawals(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Get all pending withdrawal requests"""
    stmt = (
        select(Transaction)
        .where(
            Transaction.type == TransactionType.WITHDRAWAL,
            Transaction.payment_status == "pending",
        )
        .order_by(desc(Transaction.created_at))
    )
    
    result = await db.execute(stmt)
    transactions = result.scalars().all()
    
    items = []
    for t in transactions:
        user = await db.get(User, t.user_id)
        items.append({
            "transaction_id": t.id,
            "user_id": t.user_id,
            "username": user.username if user else None,
            "amount_uzs": t.amount_uzs,
            "card_number": t.payment_method,
            "created_at": t.created_at.isoformat(),
        })
    
    return {"items": items, "total": len(items)}


@router.post("/approve-withdrawal/{transaction_id}")
async def approve_withdrawal(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Approve a pending withdrawal"""
    transaction = await db.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction.payment_status != "pending":
        raise HTTPException(status_code=400, detail="Transaction already processed")
    
    transaction.payment_status = "approved"
    await db.commit()
    
    return {
        "status": "approved",
        "message": f"Withdrawal approved. Send {transaction.amount_uzs:,} UZS to {transaction.payment_method}",
    }


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Get platform statistics"""
    from sqlalchemy import func
    
    # Total users
    total_users = await db.scalar(select(func.count(User.id)))
    
    # Total generations
    from app.models import Generation
    total_generations = await db.scalar(select(func.count(Generation.id)))
    
    # Total revenue (approved top-ups)
    total_revenue = await db.scalar(
        select(func.sum(Transaction.amount_uzs))
        .where(
            Transaction.type == TransactionType.TOPUP,
            Transaction.payment_status == "approved",
        )
    ) or 0
    
    return {
        "total_users": total_users,
        "total_generations": total_generations,
        "total_revenue_uzs": total_revenue,
    }
