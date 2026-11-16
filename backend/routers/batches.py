import asyncio
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Batch, DispatchLog, Donor, Shelter, User, Volunteer
from ..services.auth import get_current_user
from ..schemas import (
    BatchResponse,
    ClaimRequest,
    ConfirmRequest,
    ConfirmResponse,
    ScanResponse,
    StatusResponse,
)
from ..services import dispatch, safety, storage, vision, weather

router = APIRouter()
bearer_scheme = HTTPBearer(auto_error=False)


def _now() -> datetime:
    return datetime.utcnow()


def _urgency_band(score: float | None) -> str:
    if score is None:
        return "normal"
    if score >= 0.6:
        return "urgent"
    if score >= 0.3:
        return "watch"
    return "normal"


def _batch_response(
    batch: Batch,
    shelter: Shelter | None = None,
    image_url: str | None = None,
    now: datetime | None = None,
) -> BatchResponse:
    now = now or _now()
    remaining = safety.remaining_minutes(batch.expires_at, now) if batch.expires_at else 0
    score = None
    if batch.lat is not None and batch.lng is not None and batch.shelter_id:
        # Dispatch stores the selected shelter coordinates in its route metadata;
        # list responses use a conservative zero-distance fallback until then.
        score = safety.urgency(0, remaining)
    return BatchResponse(
        id=batch.id,
        donor_id=batch.donor_id,
        items=batch.items,
        total_kg=batch.total_kg,
        portions=batch.portions,
        tier=batch.tier,
        ambient_temp_c=batch.ambient_temp_c,
        humidity_pct=batch.humidity_pct,
        weather_source=batch.weather_source,
        safe_window_min=batch.safe_window_min,
        created_at=batch.created_at,
        expires_at=batch.expires_at,
        status=batch.status,
        shelter_id=batch.shelter_id,
        volunteer_id=batch.volunteer_id,
        lat=batch.lat,
        lng=batch.lng,
        image_url=image_url,
        is_demo=batch.is_demo,
        remaining_min=remaining,
        urgency=score,
        urgency_band=_urgency_band(score),
        shelter=(
            {
                "id": shelter.id,
                "name": shelter.name,
                "lat": shelter.lat,
                "lng": shelter.lng,
                "contact": shelter.contact,
            }
            if shelter
            else None
        ),
    )


async def _require_distributor(
    credentials: HTTPAuthorizationCredentials | None,
    session: AsyncSession,
) -> User:
    token = credentials.credentials if credentials else None
    user = await get_current_user(session, token)
    if user is None or user.role != "distributor":
        raise HTTPException(status_code=403, detail="A distributor account is required")
    return user


async def _get_batch(session: AsyncSession, batch_id: UUID) -> Batch:
    batch = await session.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/scan", response_model=ScanResponse)
async def scan_file(
    image: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    donor_token: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    donor = await session.scalar(select(Donor).where(Donor.token == donor_token))
    if not donor:
        raise HTTPException(status_code=401, detail="Invalid donor token")

    image_bytes = await image.read()
    await image.seek(0)
    vision_result, weather_data = await asyncio.gather(
        vision.run_vision(image),
        weather.get_weather(lat, lng),
    )

    # A failed vision call is a manual-entry draft, not a failed scan.
    items = vision_result.items if vision_result else []
    portions = vision_result.estimated_portions if vision_result else 0
    tier = vision_result.perishability_tier if vision_result else "HIGH_MOISTURE"
    safe_window = safety.compute_safe_window(tier, weather_data.temp_c)
    now = _now()
    batch = Batch(
        id=uuid4(),
        donor_id=donor.id,
        items=[item.model_dump() for item in items],
        total_kg=sum(item.approx_kg for item in items),
        portions=portions,
        tier=tier,
        ambient_temp_c=weather_data.temp_c,
        humidity_pct=weather_data.humidity_pct,
        weather_source=weather_data.source,
        safe_window_min=safe_window,
        created_at=now,
        expires_at=now + timedelta(minutes=safe_window),
        status="draft",
        lat=lat,
        lng=lng,
    )
    session.add(batch)
    image_url = await storage.store_batch_image(
        image_bytes,
        image.content_type,
        batch.id,
    )
    if image_url:
        session.add(DispatchLog(
            id=uuid4(),
            batch_id=batch.id,
            channel="image_storage",
            payload={"url": image_url},
            status="stored",
            attempt=1,
        ))
    await session.commit()

    return ScanResponse(
        draft_id=batch.id,
        items=items,
        portions=portions,
        tier=tier,
        ambient_temp_c=weather_data.temp_c,
        humidity_pct=weather_data.humidity_pct,
        weather_source=weather_data.source,
        safe_window_min=safe_window,
        expires_at=batch.expires_at,
        needs_manual_entry=vision_result is None,
    )


@router.post("/{batch_id}/confirm", response_model=ConfirmResponse)
async def confirm_batch(
    batch_id: UUID,
    payload: ConfirmRequest,
    session: AsyncSession = Depends(get_session),
):
    batch = await _get_batch(session, batch_id)
    if batch.status != "draft":
        raise HTTPException(status_code=409, detail="Only draft batches can be confirmed")

    if payload.items is not None:
        batch.items = [item.model_dump() for item in payload.items]
        batch.total_kg = sum(item.approx_kg for item in payload.items)
    if payload.portions is not None:
        batch.portions = payload.portions
    if payload.tier is not None:
        batch.tier = payload.tier
        temp_c = batch.ambient_temp_c if batch.ambient_temp_c is not None else 30.0
        batch.safe_window_min = safety.compute_safe_window(payload.tier, temp_c)
    if not batch.items or batch.portions <= 0:
        raise HTTPException(status_code=422, detail="Food items and portions are required")

    expiry_minutes = payload.expires_in_minutes or batch.safe_window_min or 30
    batch.safe_window_min = expiry_minutes
    batch.expires_at = _now() + timedelta(minutes=expiry_minutes)
    batch.status = "pending"
    await session.commit()
    await session.refresh(batch)

    # Dispatch is intentionally best-effort; a pending batch remains visible if
    # no shelter or Telegram credentials are available.
    await dispatch.dispatch_batch(session, batch)
    await session.commit()
    await session.refresh(batch)
    return ConfirmResponse(batch=_batch_response(batch), status=batch.status)


@router.post("/{batch_id}/claim", response_model=StatusResponse)
async def claim_batch(
    batch_id: UUID,
    payload: ClaimRequest,
    session: AsyncSession = Depends(get_session),
):
    if not payload.volunteer_id and not payload.telegram_chat_id:
        raise HTTPException(status_code=422, detail="volunteer_id or telegram_chat_id is required")

    batch = await _get_batch(session, batch_id)
    if batch.status not in {"pending", "dispatched", "at_risk"}:
        raise HTTPException(status_code=409, detail="Batch is no longer claimable")

    if batch.expires_at and safety.remaining_minutes(batch.expires_at, _now()) <= 0:
        batch.status = "expired"
        await session.commit()
        raise HTTPException(status_code=409, detail="Batch has expired")

    volunteer = None
    if payload.volunteer_id:
        volunteer = await session.get(Volunteer, payload.volunteer_id)
    else:
        volunteer = await session.scalar(
            select(Volunteer).where(Volunteer.telegram_chat_id == payload.telegram_chat_id)
        )
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    # Conditional update makes the claim atomic under concurrent requests.
    result = await session.execute(
        update(Batch)
        .where(Batch.id == batch_id, Batch.status.in_(["pending", "dispatched", "at_risk"]))
        .values(status="claimed", volunteer_id=volunteer.id)
    )
    if result.rowcount != 1:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Batch was already claimed")
    await session.commit()
    batch = await _get_batch(session, batch_id)
    return StatusResponse(batch=_batch_response(batch))


@router.post("/{batch_id}/pickup", response_model=StatusResponse)
async def pickup_batch(
    batch_id: UUID,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
):
    await _require_distributor(credentials, session)
    batch = await _get_batch(session, batch_id)
    if batch.status not in {"pending", "dispatched", "at_risk", "claimed"}:
        raise HTTPException(status_code=409, detail="This request is no longer available for pickup")
    result = await session.execute(
        update(Batch)
        .where(
            Batch.id == batch_id,
            Batch.status.in_(["pending", "dispatched", "at_risk", "claimed"]),
        )
        .values(status="picked_up")
    )
    if result.rowcount != 1:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Another distributor already picked up this request")
    await session.commit()
    batch = await _get_batch(session, batch_id)
    shelter = await session.get(Shelter, batch.shelter_id) if batch.shelter_id else None
    image_log = await session.scalar(
        select(DispatchLog).where(
            DispatchLog.batch_id == batch.id,
            DispatchLog.channel == "image_storage",
        ).order_by(DispatchLog.created_at.desc())
    )
    return StatusResponse(batch=_batch_response(batch, shelter, image_log.payload.get("url") if image_log else None))


@router.post("/{batch_id}/deliver", response_model=StatusResponse)
async def deliver_batch(batch_id: UUID, session: AsyncSession = Depends(get_session)):
    batch = await _get_batch(session, batch_id)
    if batch.status != "picked_up":
        raise HTTPException(status_code=409, detail="Only picked-up batches can be delivered")
    batch.status = "delivered"
    await session.commit()
    return StatusResponse(batch=_batch_response(batch))


@router.get("", response_model=list[BatchResponse])
async def list_batches(
    status: str | None = None,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
):
    limit = max(1, min(limit, 100))
    query = select(Batch).order_by(Batch.created_at.desc()).limit(limit)
    if status:
        query = query.where(Batch.status == status)
    batches = list((await session.scalars(query)).all())
    shelters = {
        shelter.id: shelter
        for shelter in (
            await session.scalars(
                select(Shelter).where(Shelter.id.in_(
                    [batch.shelter_id for batch in batches if batch.shelter_id]
                ))
            )
        ).all()
    }
    image_logs = {
        log.batch_id: log.payload.get("url")
        for log in (
            await session.scalars(
                select(DispatchLog).where(
                    DispatchLog.batch_id.in_([batch.id for batch in batches]),
                    DispatchLog.channel == "image_storage",
                )
            )
        ).all()
        if log.payload
    }
    return [_batch_response(batch, shelters.get(batch.shelter_id), image_logs.get(batch.id)) for batch in batches]


@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(batch_id: UUID, session: AsyncSession = Depends(get_session)):
    batch = await _get_batch(session, batch_id)
    shelter = await session.get(Shelter, batch.shelter_id) if batch.shelter_id else None
    image_log = await session.scalar(
        select(DispatchLog).where(
            DispatchLog.batch_id == batch.id,
            DispatchLog.channel == "image_storage",
        ).order_by(DispatchLog.created_at.desc())
    )
    return _batch_response(batch, shelter, image_log.payload.get("url") if image_log else None)
