from pydantic import BaseModel, Field
from typing import Optional


class TopUpRequest(BaseModel):
    user_id: int
    amount: int = Field(..., gt=0, description="Amount of credits to buy")
    amount_uzs: int = Field(..., gt=0, description="Price in UZS")
    screenshot_base64: Optional[str] = None


class WithdrawRequest(BaseModel):
    user_id: int
    amount: int = Field(..., gt=0, description="Amount in UZS to withdraw")
    card_number: str = Field(..., min_length=16, max_length=16)


class PaymentStatus(BaseModel):
    transaction_id: int
    status: str
    message: str
