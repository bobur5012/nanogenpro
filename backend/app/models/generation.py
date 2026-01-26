from sqlalchemy import Column, BigInteger, String, Integer, DateTime, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from app.database import Base
import enum


class GenerationStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class Generation(Base):
    __tablename__ = "generations"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, index=True, nullable=False)
    
    # Model info
    model_id = Column(String(100), nullable=False)  # e.g., "kling-video/v2.0/master/text-to-video"
    model_name = Column(String(100), nullable=False)  # e.g., "Kling 2.6 Pro"
    generation_type = Column(String(20), nullable=False)  # "image" or "video"
    
    # Request
    prompt = Column(Text, nullable=False)
    negative_prompt = Column(Text, nullable=True)
    parameters = Column(Text, nullable=True)  # JSON string of all parameters
    
    # AIML API
    aiml_task_id = Column(String(255), nullable=True)
    
    # Result
    status = Column(SQLEnum(GenerationStatus), default=GenerationStatus.PENDING)
    result_url = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Cost
    credits_charged = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
