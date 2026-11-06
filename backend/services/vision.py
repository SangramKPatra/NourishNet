# Simplified vision stub
import aiofiles
from .schemas import VisionResult, FoodItem

async def run_vision(file):
    # In real use, send to Gemini; return dummy
    return VisionResult(
        items=[FoodItem(name="rice", approx_kg=1.5)],
        estimated_portions=10,
        perishability_tier="HIGH_MOISTURE",
        confidence=0.9,
        notes=None,
    )
