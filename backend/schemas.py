from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from datetime import datetime

Tier = Literal["HIGH_MOISTURE", "MEDIUM_MOISTURE", "DRY"]

class FoodItem(BaseModel):
    name: str
    approx_kg: float

class VisionResult(BaseModel):
    items: List[FoodItem]
    estimated_portions: int
    perishability_tier: Tier
    confidence: float
    notes: Optional[str] = None

# Request/Response schemas for API
class ScanRequest(BaseModel):
    image: bytes
    lat: float
    lng: float
    donor_token: str

class ScanResponse(BaseModel):
    draft_id: str
    items: List[FoodItem]
    portions: int
    tier: Tier
    ambient_temp_c: float
    safe_window_min: int
    expires_at: datetime
    needs_manual_entry: bool

class ConfirmRequest(BaseModel):
    items: Optional[List[FoodItem]] = None
    portions: Optional[int] = None

class ConfirmResponse(BaseModel):
    batch_id: str
    status: str
