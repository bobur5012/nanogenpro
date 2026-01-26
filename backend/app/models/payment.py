"""
Payment Model for top-up requests
"""
from sqlalchemy import Column, BigInteger, String, Integer, DateTime, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from app.database import Base
import enum


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"      # Awaiting admin review
    APPROVED = "approved"    # Payment confirmed, credits added
    REJECTED = "rejected"    # Payment rejected


class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, index=True, nullable=False)
    
    # Amount
    credits = Column(Integer, nullable=False)       # Credits to add
    amount_uzs = Column(Integer, nullable=False)    # Price in UZS
    
    # Screenshot
    screenshot_url = Column(Text, nullable=True)    # S3/CDN URL
    screenshot_data = Column(Text, nullable=True)   # Base64 fallback
    
    # Status
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # Admin processing
    admin_id = Column(BigInteger, nullable=True)
    admin_message = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Telegram message ID for callback
    telegram_message_id = Column(BigInteger, nullable=True)
    
    # Referral commission (if applicable)
    referrer_id = Column(BigInteger, nullable=True)
    referral_commission = Column(Integer, default=0)
    
    # Idempotency key
    idempotency_key = Column(String(64), unique=True, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
