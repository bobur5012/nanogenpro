"""
Payment Service
Handles top-ups and withdrawals with Telegram admin channel integration
"""
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models import User, Payment, PaymentStatus, Withdrawal, WithdrawalStatus, CardType
from app.config import settings
from app.services.referral import referral_service
import structlog

logger = structlog.get_logger()


class PaymentService:
    """Handles payments and withdrawals"""
    
    # ========== IDEMPOTENCY ==========
    
    def generate_idempotency_key(self, user_id: int, amount: int, action: str) -> str:
        """Generate idempotency key to prevent double processing"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H")  # Hourly granularity
        raw = f"{user_id}:{amount}:{action}:{timestamp}"
        return hashlib.sha256(raw.encode()).hexdigest()
    
    # ========== TOP-UP ==========
    
    async def create_topup_request(
        self,
        db: AsyncSession,
        user_id: int,
        credits: int,
        amount_uzs: int,
        screenshot_data: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a top-up request.
        Returns payment info for admin channel.
        """
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        
        # Generate idempotency key
        idem_key = self.generate_idempotency_key(user_id, amount_uzs, "topup")
        
        # Check for duplicate
        stmt = select(Payment).where(Payment.idempotency_key == idem_key)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            logger.warning("Duplicate topup request", user_id=user_id, payment_id=existing.id)
            return {
                "payment_id": existing.id,
                "status": existing.status.value,
                "is_duplicate": True,
            }
        
        # Create payment record
        payment = Payment(
            user_id=user_id,
            credits=credits,
            amount_uzs=amount_uzs,
            screenshot_data=screenshot_data,
            status=PaymentStatus.PENDING,
            referrer_id=user.referrer_id,
            idempotency_key=idem_key,
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)
        
        logger.info(
            "Top-up request created",
            payment_id=payment.id,
            user_id=user_id,
            credits=credits,
            amount_uzs=amount_uzs,
        )
        
        return {
            "payment_id": payment.id,
            "user_id": user_id,
            "username": user.username,
            "first_name": user.first_name,
            "credits": credits,
            "amount_uzs": amount_uzs,
            "screenshot_data": screenshot_data,
            "status": "pending",
            "is_duplicate": False,
        }
    
    async def confirm_topup(
        self,
        db: AsyncSession,
        payment_id: int,
        admin_id: int,
    ) -> Dict[str, Any]:
        """
        Confirm top-up (admin action).
        Adds credits and processes referral commission.
        """
        payment = await db.get(Payment, payment_id)
        if not payment:
            raise ValueError("Payment not found")
        
        if payment.status != PaymentStatus.PENDING:
            raise ValueError(f"Payment already processed: {payment.status.value}")
        
        # Lock user for update
        user = await db.get(User, payment.user_id)
        if not user:
            raise ValueError("User not found")
        
        # Update payment status
        payment.status = PaymentStatus.APPROVED
        payment.admin_id = admin_id
        payment.processed_at = datetime.utcnow()
        
        # Add credits
        user.credits += payment.credits
        user.total_spent_uzs += payment.amount_uzs
        
        # Process referral commission
        commission_info = None
        if user.referrer_id:
            commission_info = await referral_service.process_commission(
                db,
                user.id,
                payment.amount_uzs,
            )
            if commission_info:
                payment.referral_commission = commission_info["commission"]
        
        await db.commit()
        
        logger.info(
            "Top-up confirmed",
            payment_id=payment_id,
            user_id=user.id,
            credits=payment.credits,
            admin_id=admin_id,
            commission=commission_info,
        )
        
        return {
            "user_id": user.id,
            "credits_added": payment.credits,
            "new_balance": user.credits,
            "commission_info": commission_info,
        }
    
    async def reject_topup(
        self,
        db: AsyncSession,
        payment_id: int,
        admin_id: int,
        reason: str = "Payment not received",
    ) -> Dict[str, Any]:
        """Reject top-up (admin action)"""
        payment = await db.get(Payment, payment_id)
        if not payment:
            raise ValueError("Payment not found")
        
        if payment.status != PaymentStatus.PENDING:
            raise ValueError(f"Payment already processed: {payment.status.value}")
        
        payment.status = PaymentStatus.REJECTED
        payment.admin_id = admin_id
        payment.admin_message = reason
        payment.processed_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info(
            "Top-up rejected",
            payment_id=payment_id,
            user_id=payment.user_id,
            admin_id=admin_id,
            reason=reason,
        )
        
        return {
            "user_id": payment.user_id,
            "reason": reason,
        }
    
    # ========== WITHDRAWAL ==========
    
    async def create_withdrawal_request(
        self,
        db: AsyncSession,
        user_id: int,
        amount_uzs: int,
        card_number: str,
    ) -> Dict[str, Any]:
        """
        Create withdrawal request.
        Freezes amount in user's referral balance.
        """
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        
        # Validate minimum amount
        if amount_uzs < settings.min_withdrawal_uzs:
            raise ValueError(f"Minimum withdrawal: {settings.min_withdrawal_uzs:,} UZS")
        
        # Check balance
        if user.referral_balance < amount_uzs:
            raise ValueError("Insufficient balance")
        
        # Validate card
        clean_card = card_number.replace(" ", "").replace("-", "")
        if len(clean_card) != 16:
            raise ValueError("Invalid card number")
        
        # Determine card type
        if clean_card.startswith("8600"):
            card_type = CardType.UZCARD
        elif clean_card.startswith("9860"):
            card_type = CardType.HUMO
        else:
            raise ValueError("Only UZCARD (8600) or HUMO (9860) cards accepted")
        
        # Generate idempotency key
        idem_key = self.generate_idempotency_key(user_id, amount_uzs, "withdraw")
        
        # Check for pending withdrawal
        stmt = select(Withdrawal).where(
            and_(
                Withdrawal.user_id == user_id,
                Withdrawal.status.in_([WithdrawalStatus.PENDING, WithdrawalStatus.FROZEN]),
            )
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValueError("You have a pending withdrawal request")
        
        # Freeze balance
        user.referral_balance -= amount_uzs
        
        # Save card if not saved
        if not user.saved_card_number:
            user.saved_card_number = clean_card
            user.saved_card_type = card_type.value
        
        # Create withdrawal
        withdrawal = Withdrawal(
            user_id=user_id,
            amount_uzs=amount_uzs,
            card_number=clean_card,
            card_type=card_type,
            status=WithdrawalStatus.FROZEN,
            idempotency_key=idem_key,
        )
        db.add(withdrawal)
        await db.commit()
        await db.refresh(withdrawal)
        
        logger.info(
            "Withdrawal request created",
            withdrawal_id=withdrawal.id,
            user_id=user_id,
            amount_uzs=amount_uzs,
        )
        
        return {
            "withdrawal_id": withdrawal.id,
            "user_id": user_id,
            "username": user.username,
            "first_name": user.first_name,
            "amount_uzs": amount_uzs,
            "card_number": clean_card,
            "card_type": card_type.value,
            "status": "frozen",
        }
    
    async def confirm_withdrawal(
        self,
        db: AsyncSession,
        withdrawal_id: int,
        admin_id: int,
    ) -> Dict[str, Any]:
        """
        Confirm withdrawal (admin action).
        Marks as paid, updates withdrawn total.
        """
        withdrawal = await db.get(Withdrawal, withdrawal_id)
        if not withdrawal:
            raise ValueError("Withdrawal not found")
        
        if withdrawal.status not in [WithdrawalStatus.PENDING, WithdrawalStatus.FROZEN]:
            raise ValueError(f"Withdrawal already processed: {withdrawal.status.value}")
        
        user = await db.get(User, withdrawal.user_id)
        if not user:
            raise ValueError("User not found")
        
        # Update withdrawal
        withdrawal.status = WithdrawalStatus.APPROVED
        withdrawal.admin_id = admin_id
        withdrawal.processed_at = datetime.utcnow()
        
        # Update user stats
        user.referral_withdrawn += withdrawal.amount_uzs
        
        await db.commit()
        
        logger.info(
            "Withdrawal confirmed",
            withdrawal_id=withdrawal_id,
            user_id=user.id,
            amount_uzs=withdrawal.amount_uzs,
            admin_id=admin_id,
        )
        
        return {
            "user_id": user.id,
            "amount_uzs": withdrawal.amount_uzs,
        }
    
    async def reject_withdrawal(
        self,
        db: AsyncSession,
        withdrawal_id: int,
        admin_id: int,
        reason: str = "Withdrawal rejected",
    ) -> Dict[str, Any]:
        """
        Reject withdrawal (admin action).
        Returns frozen amount to user's balance.
        """
        withdrawal = await db.get(Withdrawal, withdrawal_id)
        if not withdrawal:
            raise ValueError("Withdrawal not found")
        
        if withdrawal.status not in [WithdrawalStatus.PENDING, WithdrawalStatus.FROZEN]:
            raise ValueError(f"Withdrawal already processed: {withdrawal.status.value}")
        
        user = await db.get(User, withdrawal.user_id)
        if not user:
            raise ValueError("User not found")
        
        # Return frozen amount
        user.referral_balance += withdrawal.amount_uzs
        
        # Update withdrawal
        withdrawal.status = WithdrawalStatus.REJECTED
        withdrawal.admin_id = admin_id
        withdrawal.admin_message = reason
        withdrawal.processed_at = datetime.utcnow()
        
        await db.commit()
        
        logger.info(
            "Withdrawal rejected",
            withdrawal_id=withdrawal_id,
            user_id=user.id,
            amount_uzs=withdrawal.amount_uzs,
            admin_id=admin_id,
            reason=reason,
        )
        
        return {
            "user_id": user.id,
            "amount_uzs": withdrawal.amount_uzs,
            "reason": reason,
        }
    
    # ========== CREDIT PACKAGES ==========
    
    def get_credit_packages(self) -> list:
        """Get available credit packages"""
        return [
            {"credits": 100, "price_uzs": settings.credit_package_100, "discount": 0},
            {"credits": 500, "price_uzs": settings.credit_package_500, "discount": 10},
            {"credits": 1000, "price_uzs": settings.credit_package_1000, "discount": 20},
            {"credits": 5000, "price_uzs": settings.credit_package_5000, "discount": 30},
        ]


# Singleton
payment_service = PaymentService()
