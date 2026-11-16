
from pathlib import Path
from typing import Literal
from enum import Enum

from pydantic import model_validator
from pydantic_settings import BaseSettings

# Resolve .env from the repo root so it loads no matter where the server is started from.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

Tier = Literal["HIGH_MOISTURE", "MEDIUM_MOISTURE", "DRY"]


class TierEnum(str, Enum):
    HIGH_MOISTURE = "HIGH_MOISTURE"
    MEDIUM_MOISTURE = "MEDIUM_MOISTURE"
    DRY = "DRY"


class Settings(BaseSettings):
    # Database & URLs
    DATABASE_URL: str  # required — no fallback, must come from .env
    PUBLIC_BASE_URL: str = ""

    # Vision LLM (NVIDIA NIM)
    NVIDIA_API_KEY: str = ""
    NVIDIA_INVOKE_URL: str = "https://integrate.api.nvidia.com/v1/chat/completions"
    VISION_MODEL: str = "google/gemma-4-31b-it"

    # Telegram volunteer bot
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Image storage
    STORE_IMAGES: bool = True
    STORAGE_BUCKET: str = "food-images"

    # Dispatch & safety tuning (neutral fallbacks; real values live in .env)
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

    @model_validator(mode="after")
    def _resolve_sqlite_path(self):
        prefix = "sqlite+aiosqlite:///"
        if self.DATABASE_URL.startswith(prefix):
            path = self.DATABASE_URL[len(prefix):]
            if not Path(path).is_absolute():
                self.DATABASE_URL = prefix + str((ENV_FILE.parent / path).resolve())
        return self

    model_config = {"env_file": str(ENV_FILE), "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
