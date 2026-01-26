from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class GenerationType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"


class GenerationRequest(BaseModel):
    """Request from Web App to start generation"""
    user_id: int
    init_data: str  # Telegram WebApp init data for verification
    
    model_id: str
    model_name: str
    generation_type: GenerationType
    
    prompt: str = Field(..., min_length=1, max_length=2000)
    negative_prompt: Optional[str] = Field(None, max_length=1000)
    
    # Model-specific parameters
    parameters: Optional[Dict[str, Any]] = None
    
    # For image-to-video
    image_url: Optional[str] = None
    
    # Idempotency protection (client-generated UUID)
    idempotency_key: Optional[str] = Field(None, max_length=64)


class GenerationResponse(BaseModel):
    id: int
    status: str  # "pending", "processing", "completed", "failed", "refunded"
    message: str
    credits_charged: int
    estimated_time: Optional[int] = None  # seconds


class GenerationResult(BaseModel):
    id: int
    user_id: int
    model_name: str
    prompt: str
    status: str  # "pending", "processing", "completed", "failed", "refunded"
    result_url: Optional[str]
    error_message: Optional[str]
    credits_charged: int
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True
