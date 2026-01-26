"""
User Service
"""
import secrets
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import User, Referral
from app.schemas.user import TelegramUser
import structlog

logger = structlog.get_logger()


class UserService:
    """Handles user operations"""
    
    async def get_or_create_user(
        self,
        db: AsyncSession,
        telegram_user: TelegramUser,
        referral_code: Optional[str] = None,
    ) -> User:
        """
        Get existing user or create new one
        """
        user = await db.get(User, telegram_user.id)
        
        if user:
            # Update user info
            user.username = telegram_user.username
            user.first_name = telegram_user.first_name
            user.last_name = telegram_user.last_name
            user.last_active_at = datetime.utcnow()
            await db.commit()
            return user
        
        # Create new user
        user = User(
            id=telegram_user.id,
            username=telegram_user.username,
            first_name=telegram_user.first_name,
            last_name=telegram_user.last_name,
            language_code=telegram_user.language_code or "ru",
            credits=10,  # Welcome bonus
            referral_code=self._generate_referral_code(),
        )
        
        # Process referral
        if referral_code:
            referrer = await self._get_user_by_referral_code(db, referral_code)
            if referrer and referrer.id != telegram_user.id:
                user.referrer_id = referrer.id
                
                # Create referral record
                referral = Referral(
                    referrer_id=referrer.id,
                    referred_id=telegram_user.id,
                )
                db.add(referral)
                
                logger.info(
                    "Referral registered",
                    referrer_id=referrer.id,
                    referred_id=telegram_user.id,
                )
        
        db.add(user)
        await db.commit()
        
        logger.info(
            "New user created",
            user_id=telegram_user.id,
            username=telegram_user.username,
        )
        
        return user
    
    async def _get_user_by_referral_code(
        self,
        db: AsyncSession,
        code: str,
    ) -> Optional[User]:
        """Find user by referral code"""
        stmt = select(User).where(User.referral_code == code)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    def _generate_referral_code(self) -> str:
        """Generate unique referral code"""
        return secrets.token_urlsafe(8)
    
    async def get_referral_stats(
        self,
        db: AsyncSession,
        user_id: int,
    ) -> dict:
        """Get user's referral statistics"""
        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")
        
        # Count referrals
        stmt = select(Referral).where(Referral.referrer_id == user_id)
        result = await db.execute(stmt)
        referrals = result.scalars().all()
        
        # Count active referrals (those who made at least one generation)
        active_count = 0
        for ref in referrals:
            referred_user = await db.get(User, ref.referred_id)
            if referred_user and referred_user.total_generations > 0:
                active_count += 1
        
        return {
            "referral_code": user.referral_code,
            "referral_link": f"https://t.me/nanogenprobot?start=ref_{user.id}",
            "total_referrals": len(referrals),
            "active_referrals": active_count,
            "total_earnings": user.referral_earnings,
            "available_balance": user.referral_balance,
            "saved_card": user.saved_card,
        }


# Singleton
user_service = UserService()
