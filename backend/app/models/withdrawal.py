"""
Withdrawal Model for partner program payouts
"""
from sqlalchemy import Column, BigInteger, String, Integer, DateTime, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from app.database import Base
import enum


class WithdrawalStatus(str, enum.Enum):
    PENDING = "pending"      # Awaiting admin review
    FROZEN = "frozen"        # Amount frozen, processing
    APPROVED = "approved"    # Payout completed
    REJECTED = "rejected"    # Payout rejected


class CardType(str, enum.Enum):
    UZCARD = "uzcard"
    HUMO = "humo"


class Withdrawal(Base):
    __tablename__ = "withdrawals"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, index=True, nullable=False)
    
    # Amount
    amount_uzs = Column(Integer, nullable=False)
    
    # Card details
    card_number = Column(String(20), nullable=False)
    card_type = Column(SQLEnum(CardType), nullable=False)
    card_holder = Column(String(100), nullable=True)
    
    # Status
    status = Column(SQLEnum(WithdrawalStatus), default=WithdrawalStatus.PENDING)
    
    # Admin processing
    admin_id = Column(BigInteger, nullable=True)
    admin_message = Column(Text, nullable=True)  # Reason for rejection
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Telegram message ID for callback
    telegram_message_id = Column(BigInteger, nullable=True)
    
    # Idempotency key to prevent duplicates
    idempotency_key = Column(String(64), unique=True, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
