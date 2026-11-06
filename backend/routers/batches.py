from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from uuid import uuid4
from datetime import datetime, timedelta
from .config import settings
from .db import AsyncSessionLocal
from .schemas import ScanRequest, ScanResponse, ConfirmRequest, ConfirmResponse
from .services import vision, weather, safety, dispatch

router = APIRouter()

@router.post("/scan", response_model=ScanResponse)
async def scan_file(
    image: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    donor_token: str = Form(...),
    session=Depends(AsyncSessionLocal),
):
    # Basic scan logic simplified: call vision, weather, safety
    vision_result = await vision.run_vision(image)
    if not vision_result:
        raise HTTPException(status_code=400, detail="Vision extraction failed")
    weather_data = await weather.get_weather(lat, lng)
    safe_window = safety.compute_safe_window(vision_result.perishability_tier, weather_data.temp_c)
    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=safe_window)
    draft_id = str(uuid4())
    # In a full implementation, store draft in DB
    return ScanResponse(
        draft_id=draft_id,
        items=vision_result.items,
        portions=vision_result.estimated_portions,
        tier=vision_result.perishability_tier,
        ambient_temp_c=weather_data.temp_c,
        safe_window_min=safe_window,
        expires_at=expires_at,
        needs_manual_entry=False,
    )

@router.post("/confirm/{draft_id}", response_model=ConfirmResponse)
async def confirm_batch(
    draft_id: str,
    payload: ConfirmRequest,
    session=Depends(AsyncSessionLocal),
):
    # Simplified confirm: create Batch entry; in real code, lookup draft, update vals
    batch_id = str(uuid4())
    return ConfirmResponse(batch_id=batch_id, status="pending")
