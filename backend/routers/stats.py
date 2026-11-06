from fastapi import APIRouter, Depends
from .db import get_session
from .schemas import ConfirmResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

@router.get("/stats")
async def get_stats(session: AsyncSession = Depends(get_session)):
    # Stub: in real implementation compute stats from DB
    return {"meals": 0, "kg": 0, "co2e_kg": 0, "active_batches": 0, "delivered_batches": 0}
