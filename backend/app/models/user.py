from sqlalchemy import Column, BigInteger, String, Integer, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(BigInteger, primary_key=True, index=True)  # Telegram user ID
    username = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    language_code = Column(String(10), default="ru")
    
    # Balance
    credits = Column(Integer, default=10)  # Starting bonus
    
    # Referral
    referrer_id = Column(BigInteger, nullable=True)
    referral_code = Column(String(32), unique=True, nullable=True)
    referral_earnings = Column(Integer, default=0)  # Total earned from referrals
    referral_balance = Column(Integer, default=0)   # Available for withdrawal
    
    # Payment
    saved_card = Column(String(20), nullable=True)
    
    # Stats
    total_generations = Column(Integer, default=0)
    total_spent = Column(Integer, default=0)
    
    # Status
    is_banned = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now())
