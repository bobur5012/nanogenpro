"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
from pydantic import Field


class Settings(BaseSettings):
    # ========== APP ==========
    app_name: str = "NanoGen API"
    debug: bool = False
    
    # ========== DATABASE ==========
    database_url: str = Field(..., validation_alias="DATABASE_URL")
    
    # ========== REDIS ==========
    redis_url: str = "redis://localhost:6379/0"
    
    # ========== TELEGRAM BOT ==========
    telegram_bot_token: str
    telegram_webhook_url: Optional[str] = None
    
    # Admin channel for payments/withdrawals review
    telegram_admin_channel_id: int = Field(-1001234567890, validation_alias="TELEGRAM_ADMIN_CHANNEL_ID")
    
    # ========== AIML API ==========
    aiml_api_key: str
    aiml_api_base_url: str = "https://api.aimlapi.com/v1"

    # ========== STORAGE (S3 Compatible) ==========
    # Алиасы под Railway переменные
    storage_endpoint_url: Optional[str] = Field(None, validation_alias="ENDPOINT")
    storage_region: str = "auto"
    storage_bucket_name: Optional[str] = Field(None, validation_alias="BUCKET")
    # Предполагаем, что ID ключа называется ACCESS_KEY либо AWS_ACCESS_KEY_ID, 
    # но если в Railway его нет в явном виде (обрезан скриншот), добавим alias на всякий случай
    storage_access_key_id: Optional[str] = Field(None, validation_alias="ACCESS_KEY") 
    storage_secret_access_key: Optional[str] = Field(None, validation_alias="SECRET_ACCESS_KEY")
    storage_public_base_url: Optional[str] = Field(None, validation_alias="PUBLIC_URL")
    storage_signed_url_expires: int = 3600  # seconds
    max_image_upload_mb: int = 10
    
    # ========== WEB APP ==========
    webapp_url: str = "https://app.nanogen.ai"
    
    # ========== SECURITY ==========
    secret_key: str
    
    # ========== PAYMENT CARD ==========
    payment_card_number: str = Field("8600 3304 8588 5154", validation_alias="PAYMENT_CARD_NUMBER")
    payment_card_holder: str = Field("Botirov Bobur", validation_alias="PAYMENT_CARD_HOLDER")
    payment_card_type: str = "UZCARD"
    
    # ========== PRICING (UZS) ==========
    # Base prices (3x markup applied)
    markup_multiplier: float = 3.0
    
    # Credit packages (credits: price_uzs)
    # Calculated as: base_cost * markup_multiplier
    credit_package_100: int = 50_000      # 100 credits = 50,000 UZS
    credit_package_500: int = 225_000     # 500 credits = 225,000 UZS (10% discount)
    credit_package_1000: int = 400_000    # 1000 credits = 400,000 UZS (20% discount)
    credit_package_5000: int = 1_750_000  # 5000 credits = 1,750,000 UZS (30% discount)
    
    # ========== REFERRAL PROGRAM ==========
    referral_commission_percent: int = 25  # 25% of each payment
    min_withdrawal_uzs: int = 300_000      # Minimum withdrawal amount
    
    # ========== MODEL PRICING (UZS per unit) ==========
    # Video models (per second)
    price_kling_pro_per_sec: int = 22050       # $0.0735 * 3 * 100000
    price_kling_audio_per_sec: int = 44100     # $0.147 * 3 * 100000
    price_kling_turbo_per_sec: int = 22050
    price_seedance_pro_per_sec: int = 18900    # $0.063 * 3
    price_seedance_lite_per_sec: int = 9450
    price_wan_per_sec: int = 18900
    price_runway_per_sec: int = 15750
    price_sora_per_sec: int = 94500            # $0.315 * 3
    price_veo_per_sec: int = 63000
    
    # Image models (per image)
    price_gpt_image: int = 12000               # ~$0.04 * 3
    price_imagen_fast: int = 6300
    price_imagen_generate: int = 12600
    price_imagen_ultra: int = 18900
    price_nano_banana: int = 12285
    price_nano_banana_pro: int = 47250
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
