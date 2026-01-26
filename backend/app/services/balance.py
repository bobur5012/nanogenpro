"""
Balance and Payment Service
"""
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import User, Transaction, TransactionType, Referral
from app.config import settings
import structlog

logger = structlog.get_logger()


class BalanceService:
    """Handles balance operations"""
    
    async def get_balance(self, db: AsyncSession, user_id: int) -> dict:
        """Get user balance info"""
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        
        return {
            "credits": user.credits,
            "referral_balance": user.referral_balance,
            "referral_total_earned": user.referral_total_earned,
        }
    
    async def add_credits(
        self,
        db: AsyncSession,
        user_id: int,
        amount: int,
        transaction_type: TransactionType,
        description: str,
        amount_uzs: Optional[int] = None,
        reference_id: Optional[int] = None,
    ) -> int:
        """
        Add credits to user account
        Returns new balance
        """
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        
        user.credits += amount
        
        # Create transaction
        transaction = Transaction(
            user_id=user_id,
            type=transaction_type,
            amount=amount,
            amount_uzs=amount_uzs,
            reference_id=reference_id,
            description=description,
        )
        db.add(transaction)
        await db.commit()
        
        logger.info(
            "Credits added",
            user_id=user_id,
            amount=amount,
            type=transaction_type.value,
            new_balance=user.credits,
        )
        
        return user.credits
    
    async def process_topup(
        self,
        db: AsyncSession,
        user_id: int,
        amount: int,
        amount_uzs: int,
        screenshot: Optional[str] = None,
    ) -> int:
        """
        Create a pending top-up request
        Returns transaction ID
        """
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        
        transaction = Transaction(
            user_id=user_id,
            type=TransactionType.TOPUP,
            amount=amount,
            amount_uzs=amount_uzs,
            payment_screenshot=screenshot,
            payment_status="pending",
            description=f"Top-up: {amount} credits for {amount_uzs:,} UZS",
        )
        db.add(transaction)
        await db.commit()
        
        logger.info(
            "Top-up request created",
            user_id=user_id,
            amount=amount,
            amount_uzs=amount_uzs,
            transaction_id=transaction.id,
        )
        
        return transaction.id
    
    async def confirm_topup(
        self,
        db: AsyncSession,
        transaction_id: int,
        admin_id: int,
    ) -> dict:
        """
        Confirm a pending top-up (admin action)
        """
        transaction = await db.get(Transaction, transaction_id)
        if not transaction:
            raise ValueError("Transaction not found")
        
        if transaction.type != TransactionType.TOPUP:
            raise ValueError("Not a top-up transaction")
        
        if transaction.payment_status != "pending":
            raise ValueError("Transaction already processed")
        
        # Update transaction
        transaction.payment_status = "approved"
        
        # Add credits
        user = await db.get(User, transaction.user_id)
        user.credits += transaction.amount
        
        # Process referral commission (25%)
        if user.referrer_id:
            commission = transaction.amount // 4  # 25%
            referrer = await db.get(User, user.referrer_id)
            if referrer:
                referrer.referral_total_earned += commission
                referrer.referral_balance += commission
                
                # Update referral record
                stmt = select(Referral).where(
                    Referral.referrer_id == referrer.id,
                    Referral.referred_id == user.id,
                )
                result = await db.execute(stmt)
                referral = result.scalar_one_or_none()
                if referral:
                    referral.total_earned += commission
                
                # Create referral transaction
                ref_transaction = Transaction(
                    user_id=referrer.id,
                    type=TransactionType.REFERRAL,
                    amount=commission,
                    reference_id=user.id,
                    description=f"Referral commission from user {user.id}",
                )
                db.add(ref_transaction)
        
        await db.commit()
        
        logger.info(
            "Top-up confirmed",
            transaction_id=transaction_id,
            user_id=transaction.user_id,
            amount=transaction.amount,
            admin_id=admin_id,
        )
        
        return {
            "user_id": transaction.user_id,
            "amount": transaction.amount,
            "new_balance": user.credits,
        }
    
    async def process_withdrawal(
        self,
        db: AsyncSession,
        user_id: int,
        amount_uzs: int,
        card_number: str,
    ) -> int:
        """
        Create a withdrawal request
        Returns transaction ID
        """
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        
        if user.referral_balance < amount_uzs:
            raise ValueError("Insufficient referral balance")
        
        # Deduct from referral balance
        user.referral_balance -= amount_uzs
        
        # Save card if not saved
        if not user.saved_card_number:
            user.saved_card_number = card_number
        
        # Create withdrawal transaction
        transaction = Transaction(
            user_id=user_id,
            type=TransactionType.WITHDRAWAL,
            amount=-amount_uzs,
            amount_uzs=amount_uzs,
            payment_method=card_number,
            payment_status="pending",
            description=f"Withdrawal: {amount_uzs:,} UZS to {card_number[:4]}****{card_number[-4:]}",
        )
        db.add(transaction)
        await db.commit()
        
        logger.info(
            "Withdrawal request created",
            user_id=user_id,
            amount_uzs=amount_uzs,
            transaction_id=transaction.id,
        )
        
        return transaction.id


# Singleton
balance_service = BalanceService()
