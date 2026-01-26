"""
User Model with full referral program support
"""
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
    
    # Balance (credits for generation)
    credits = Column(Integer, default=10)  # Starting bonus
    
    # ========== REFERRAL PROGRAM ==========
    # Who referred this user (set ONCE, never changes)
    referrer_id = Column(BigInteger, nullable=True, index=True)
    
    # User's own referral code (auto-generated)
    referral_code = Column(String(32), unique=True, nullable=True)
    
    # Partner earnings (in UZS)
    referral_total_earned = Column(Integer, default=0)    # Lifetime total earned
    referral_balance = Column(Integer, default=0)         # Available for withdrawal
    referral_withdrawn = Column(Integer, default=0)       # Total withdrawn
    
    # Partner stats
    referrals_count = Column(Integer, default=0)          # Total referred users
    referrals_active = Column(Integer, default=0)         # Users with at least 1 payment
    
    # ========== PAYMENT ==========
    # Saved withdrawal card
    saved_card_number = Column(String(20), nullable=True)
    saved_card_type = Column(String(10), nullable=True)   # uzcard / humo
    
    # Total user spending (in UZS)
    total_spent_uzs = Column(Integer, default=0)
    
    # ========== STATS ==========
    total_generations = Column(Integer, default=0)
    total_spent_credits = Column(Integer, default=0)
    
    # ========== STATUS ==========
    is_banned = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    
    # ========== TIMESTAMPS ==========
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now())
    first_payment_at = Column(DateTime(timezone=True), nullable=True)  # When became "active"
