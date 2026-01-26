"""
Referral Program Service
Handles partner commissions, statistics, and protection
"""
import hashlib
import secrets
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models import User, Referral, Payment, PaymentStatus
from app.config import settings
import structlog

logger = structlog.get_logger()


class ReferralService:
    """Handles referral program logic"""
    
    # ========== REFERRAL CODE GENERATION ==========
    
    def generate_referral_code(self, user_id: int) -> str:
        """Generate unique referral code for user"""
        # Use user_id + random suffix for uniqueness
        raw = f"{user_id}_{secrets.token_hex(4)}"
        return hashlib.md5(raw.encode()).hexdigest()[:8].upper()
    
    # ========== REFERRAL LINKING ==========
    
    async def process_referral(
        self,
        db: AsyncSession,
        new_user_id: int,
        referral_code: str,
    ) -> Optional[int]:
        """
        Process referral when new user joins.
        Returns referrer_id if successful, None otherwise.
        
        Protection:
        - No self-referral
        - One referrer per user (lifetime)
        - Referrer must exist
        """
        # Get referrer by code
        stmt = select(User).where(User.referral_code == referral_code)
        result = await db.execute(stmt)
        referrer = result.scalar_one_or_none()
        
        if not referrer:
            logger.warning("Referral code not found", code=referral_code)
            return None
        
        # Self-referral protection
        if referrer.id == new_user_id:
            logger.warning("Self-referral attempt blocked", user_id=new_user_id)
            return None
        
        # Get new user
        new_user = await db.get(User, new_user_id)
        if not new_user:
            logger.error("New user not found", user_id=new_user_id)
            return None
        
        # Already has referrer protection
        if new_user.referrer_id is not None:
            logger.info(
                "User already has referrer",
                user_id=new_user_id,
                existing_referrer=new_user.referrer_id,
            )
            return new_user.referrer_id
        
        # Link referral
        new_user.referrer_id = referrer.id
        
        # Create referral record
        referral = Referral(
            referrer_id=referrer.id,
            referred_id=new_user_id,
            total_earned=0,
        )
        db.add(referral)
        
        # Update referrer stats
        referrer.referrals_count += 1
        
        await db.commit()
        
        logger.info(
            "Referral linked",
            new_user_id=new_user_id,
            referrer_id=referrer.id,
            referral_code=referral_code,
        )
        
        return referrer.id
    
    # ========== COMMISSION PROCESSING ==========
    
    async def process_commission(
        self,
        db: AsyncSession,
        user_id: int,
        payment_amount_uzs: int,
    ) -> Optional[Dict[str, Any]]:
        """
        Process referral commission when user makes payment.
        Commission is 25% of payment amount.
        
        Returns commission info if processed, None otherwise.
        """
        user = await db.get(User, user_id)
        if not user or not user.referrer_id:
            return None
        
        referrer = await db.get(User, user.referrer_id)
        if not referrer:
            logger.error("Referrer not found", referrer_id=user.referrer_id)
            return None
        
        # Calculate commission (25%)
        commission = int(payment_amount_uzs * settings.referral_commission_percent / 100)
        
        # Update referrer balances
        referrer.referral_total_earned += commission
        referrer.referral_balance += commission
        
        # Check if this is user's first payment (makes them "active")
        if not user.first_payment_at:
            user.first_payment_at = datetime.utcnow()
            referrer.referrals_active += 1
        
        # Update referral record
        stmt = select(Referral).where(
            and_(
                Referral.referrer_id == referrer.id,
                Referral.referred_id == user_id,
            )
        )
        result = await db.execute(stmt)
        referral = result.scalar_one_or_none()
        
        if referral:
            referral.total_earned += commission
        
        await db.commit()
        
        logger.info(
            "Referral commission processed",
            user_id=user_id,
            referrer_id=referrer.id,
            payment_amount=payment_amount_uzs,
            commission=commission,
        )
        
        return {
            "referrer_id": referrer.id,
            "commission": commission,
            "referrer_new_balance": referrer.referral_balance,
        }
    
    # ========== STATISTICS ==========
    
    async def get_partner_stats(
        self,
        db: AsyncSession,
        user_id: int,
    ) -> Dict[str, Any]:
        """Get partner program statistics for user"""
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        
        # Ensure user has referral code
        if not user.referral_code:
            user.referral_code = self.generate_referral_code(user_id)
            await db.commit()
        
        return {
            "referral_code": user.referral_code,
            "referral_link": f"https://t.me/nanogenprobot?start=ref_{user.referral_code}",
            
            # Earnings
            "total_earned": user.referral_total_earned,       # Ваш доход
            "available_balance": user.referral_balance,       # Баланс партнёра
            "total_withdrawn": user.referral_withdrawn,       # Всего выведено
            
            # Referrals
            "referrals_total": user.referrals_count,          # Всего приглашено
            "referrals_active": user.referrals_active,        # С хотя бы 1 платежом
            
            # Card
            "saved_card": user.saved_card_number,
            "saved_card_type": user.saved_card_type,
            
            # Settings
            "min_withdrawal": settings.min_withdrawal_uzs,
            "commission_percent": settings.referral_commission_percent,
        }
    
    async def get_referral_list(
        self,
        db: AsyncSession,
        user_id: int,
        limit: int = 50,
    ) -> list:
        """Get list of user's referrals"""
        stmt = (
            select(Referral, User)
            .join(User, User.id == Referral.referred_id)
            .where(Referral.referrer_id == user_id)
            .order_by(Referral.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        rows = result.all()
        
        return [
            {
                "id": referral.referred_id,
                "name": user.first_name or user.username or f"User {user.id}",
                "is_active": user.first_payment_at is not None,
                "total_earned": referral.total_earned,
                "joined_at": referral.created_at.isoformat(),
            }
            for referral, user in rows
        ]


# Singleton
referral_service = ReferralService()
