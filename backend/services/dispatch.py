from math import asin, cos, radians, sin, sqrt
from uuid import UUID
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import Batch, DispatchLog, Shelter
from .safety import remaining_minutes, urgency


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * radius * asin(sqrt(a))


async def dispatch_batch(session: AsyncSession, batch: Batch) -> bool:
    """Select the nearest feasible verified shelter for a pending batch."""
    if batch.lat is None or batch.lng is None:
        batch.status = "at_risk"
        return False

    shelters = list((await session.scalars(
        select(Shelter).where(Shelter.active.is_(True), Shelter.verified.is_(True))
    )).all())
    remaining = remaining_minutes(batch.expires_at, datetime.utcnow())
    candidates = []
    for shelter in shelters:
        distance = haversine_km(batch.lat, batch.lng, shelter.lat, shelter.lng)
        travel_min = distance / settings.AVG_SPEED_KMPH * 60
        if distance <= settings.MAX_RADIUS_KM and shelter.capacity_portions >= batch.portions and travel_min < remaining * 0.8:
            candidates.append((urgency(distance, remaining), distance, shelter))

    if not candidates:
        batch.status = "at_risk"
        return False

    _, _, shelter = min(candidates, key=lambda item: (item[0], item[1]))
    batch.shelter_id = shelter.id
    batch.status = "dispatched"
    session.add(DispatchLog(
        batch_id=batch.id,
        channel="dispatch",
        payload={"shelter_id": str(shelter.id), "shelter_name": shelter.name},
        status="selected",
        attempt=1,
    ))
    return True


# Kept for compatibility with the initial scaffold.
def dispatch(batch_id: UUID, shelter_id: UUID) -> bool:
    return True
