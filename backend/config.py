from pydantic_settings import BaseSettings
from typing import Literal

class Tier(str, Literal):
    HIGH_MOISTURE = 'HIGH_MOISTURE'
    MEDIUM_MOISTURE = 'MEDIUM_MOISTURE'
    DRY = 'DRY'

class Settings(BaseSettings):
    GEMINI_API_KEY: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_CHAT_ID: str
    DATABASE_URL: str
    PUBLIC_BASE_URL: str
    STORE_IMAGES: bool = False
    MIN_WINDOW: int = 30
    AVG_SPEED_KMPH: float = 20.0
    MAX_RADIUS_KM: float = 8.0
    CO2E_FACTOR: float = 2.5
    URGENCY_ESCALATE: float = 0.6
    BASE_WINDOWS: dict[Tier, int] = {
        Tier.HIGH_MOISTURE: 240,
        Tier.MEDIUM_MOISTURE: 360,
        Tier.DRY: 480,
    }

    class Config:
        env_file = ".env"

settings = Settings()
