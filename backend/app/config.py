from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "NanoGen API"
    debug: bool = False
    
    # Database
    database_url: str
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # Telegram
    telegram_bot_token: str
    telegram_webhook_url: Optional[str] = None
    
    # AIML API
    aiml_api_key: str
    aiml_api_base_url: str = "https://api.aimlapi.com/v2"
    
    # Web App
    webapp_url: str = "https://app.nanogen.ai"
    
    # Security
    secret_key: str
    
    # Pricing (in diamonds)
    price_image_basic: int = 2
    price_video_basic: int = 7
    price_video_pro: int = 15
    
    # Currency
    diamond_rate_uzs: int = 1000  # 1 diamond = 1000 UZS
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
