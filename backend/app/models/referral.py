from sqlalchemy import Column, BigInteger, Integer, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Referral(Base):
    __tablename__ = "referrals"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    referrer_id = Column(BigInteger, index=True, nullable=False)  # Who referred
    referred_id = Column(BigInteger, index=True, nullable=False)  # Who was referred
    
    # Earnings from this referral
    total_earned = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
