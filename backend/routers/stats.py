from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_session
from ..models import Batch
from ..schemas import StatsResponse

router = APIRouter()


def _metrics(rows: list[Batch]) -> dict[str, float | int]:
    delivered = [row for row in rows if row.status == "delivered"]
    kg = round(sum(row.total_kg for row in delivered), 2)
    return {
        "meals": sum(row.portions for row in delivered),
        "kg": kg,
        "co2e_kg": round(kg * settings.CO2E_FACTOR, 2),
    }


@router.get("", response_model=StatsResponse)
async def get_stats(session: AsyncSession = Depends(get_session)):
    rows = list((await session.scalars(select(Batch))).all())
    demo = _metrics([row for row in rows if row.is_demo])
    real = _metrics([row for row in rows if not row.is_demo])
    active_statuses = {"pending", "dispatched", "claimed", "picked_up", "at_risk"}
    return StatsResponse(
        meals=int(real["meals"] + demo["meals"]),
        kg=float(real["kg"] + demo["kg"]),
        co2e_kg=float(real["co2e_kg"] + demo["co2e_kg"]),
        active_batches=sum(row.status in active_statuses for row in rows),
        delivered_batches=sum(row.status == "delivered" for row in rows),
        demo=demo,
        real=real,
    )
