from sqlalchemy import Column, BigInteger, String, Integer, DateTime, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from app.database import Base
import enum


class TransactionType(str, enum.Enum):
    TOPUP = "topup"           # User bought credits
    GENERATION = "generation"  # Credits spent on generation
    REFUND = "refund"          # Credits refunded
    REFERRAL = "referral"      # Earned from referral
    WITHDRAWAL = "withdrawal"  # Referral balance withdrawn
    BONUS = "bonus"            # Promotional credits


class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, index=True, nullable=False)
    
    type = Column(SQLEnum(TransactionType), nullable=False)
    amount = Column(Integer, nullable=False)  # Positive for income, negative for expense
    
    # For topup
    amount_uzs = Column(Integer, nullable=True)
    payment_method = Column(String(50), nullable=True)
    payment_screenshot = Column(Text, nullable=True)
    payment_status = Column(String(20), default="pending")  # pending, approved, rejected
    
    # Reference
    reference_id = Column(BigInteger, nullable=True)  # generation_id or referral user_id
    description = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
