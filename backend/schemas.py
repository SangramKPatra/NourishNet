from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

Tier = Literal["HIGH_MOISTURE", "MEDIUM_MOISTURE", "DRY"]
BatchStatus = Literal[
    "draft", "pending", "dispatched", "claimed", "picked_up",
    "delivered", "expired", "at_risk",
]


class FoodItem(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    approx_kg: float = Field(gt=0, le=100)


class VisionResult(BaseModel):
    items: list[FoodItem]
    estimated_portions: int = Field(ge=0)
    perishability_tier: Tier
    confidence: float = Field(ge=0, le=1)
    notes: str | None = None


class ScanResponse(BaseModel):
    draft_id: UUID
    items: list[FoodItem]
    portions: int
    tier: Tier
    ambient_temp_c: float
    humidity_pct: float
    weather_source: str
    safe_window_min: int
    expires_at: datetime
    needs_manual_entry: bool


class ConfirmRequest(BaseModel):
    items: list[FoodItem] | None = None
    portions: int | None = Field(default=None, gt=0)
    expires_in_minutes: int | None = Field(default=None, ge=5, le=1440)


class ShelterSummary(BaseModel):
    id: UUID
    name: str
    lat: float
    lng: float
    contact: str | None


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    donor_id: UUID
    items: list[FoodItem]
    total_kg: float
    portions: int
    tier: Tier
    ambient_temp_c: float | None
    humidity_pct: float | None
    weather_source: str | None
    safe_window_min: int | None
    created_at: datetime
    expires_at: datetime | None
    status: str
    shelter_id: UUID | None
    volunteer_id: UUID | None
    lat: float | None
    lng: float | None
    image_url: str | None
    is_demo: bool
    remaining_min: int = 0
    urgency: float | None = None
    urgency_band: str = "normal"
    shelter: ShelterSummary | None = None


class ConfirmResponse(BaseModel):
    batch: BatchResponse
    status: str


class ClaimRequest(BaseModel):
    volunteer_id: UUID | None = None
    telegram_chat_id: str | None = None


class StatusResponse(BaseModel):
    batch: BatchResponse


class StatsResponse(BaseModel):
    meals: int
    kg: float
    co2e_kg: float
    active_batches: int
    delivered_batches: int
    demo: dict[str, float | int]
    real: dict[str, float | int]


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

UserRole = Literal["supplier", "distributor"]


class UserRegister(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8)
    role: UserRole
    lat: float | None = None
    lng: float | None = None
    radius_km: float = Field(default=10.0, gt=0, le=500)


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: str
    lat: float | None
    lng: float | None
    radius_km: float
    active: bool
    created_at: datetime


class UserTokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    token: str
    user: UserResponse
