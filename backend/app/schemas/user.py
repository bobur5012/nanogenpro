from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TelegramUser(BaseModel):
    id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = "ru"


class UserCreate(BaseModel):
    telegram_user: TelegramUser
    referral_code: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: Optional[str]
    first_name: Optional[str]
    credits: int
    referral_code: Optional[str]
    total_generations: int
    is_premium: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserBalance(BaseModel):
    credits: int
    referral_balance: int
    referral_earnings: int
