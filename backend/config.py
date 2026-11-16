from pydantic_settings import BaseSettings
from typing import Literal
from enum import Enum

Tier = Literal["HIGH_MOISTURE", "MEDIUM_MOISTURE", "DRY"]

class TierEnum(str, Enum):
    HIGH_MOISTURE = "HIGH_MOISTURE"
    MEDIUM_MOISTURE = "MEDIUM_MOISTURE"
    DRY = "DRY"

class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    VISION_MODEL: str = "gemini-3.6-flash"
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    DATABASE_URL: str = "postgresql+asyncpg://postgres:YOUR_SUPABASE_PWD@aws-aws-pool-1.go.supabase.co:5452/postgres"
    PUBLIC_BASE_URL: str = "http://localhost:5173"
    STORE_IMAGES: bool = False
    MIN_WINDOW: int = 30
    AVG_SPEED_KMPH: float = 20.0
    MAX_RADIUS_KM: float = 8.0
    CO2E_FACTOR: float = 2.5
    URGENCY_ESCALATE: float = 0.6
    BASE_WINDOWS: dict[str, int] = {
        "HIGH_MOISTURE": 240,
        "MEDIUM_MOISTURE": 360,
        "DRY": 480,
    }
    # Supabase configuration
    SUPABASE_URL: str = "https://pyxwimmoqlcqxnnfskwa.supabase.co"
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    MODEL_CONFIG: str = "model_config"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

settings = Settings()
