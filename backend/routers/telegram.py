from fastapi import APIRouter, Request
from ..config import settings

router = APIRouter()

@router.post("/webhook")
async def webhook(request: Request):
    payload = await request.json()
    # Handle Telegram callback queries here
    return {"ok": True}
