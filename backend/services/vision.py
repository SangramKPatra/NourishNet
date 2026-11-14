# Phase 4 — Vision extraction using Gemini 2.5 Flash
import io
from PIL import Image
from typing import Optional
from google import genai
from google.genai import types
from pydantic import ValidationError

from ..config import settings
from ..schemas import VisionResult, FoodItem, Tier


# System prompt for Gemini
SYSTEM_PROMPT = """You are a food safety assistant analyzing photos of leftover cooked food for donation.

Your task:
- Identify only VISIBLE cooked/ready-to-eat food in the photo
- Estimate weight conservatively using tray/container size cues
- Assume one portion is about 150-200g cooked weight
- Choose the MOST PERISHABLE tier if the photo shows mixed dishes
- Never invent dishes not visible in the photo
- Return an empty items list if no food is clearly visible

Perishability tiers:
- HIGH_MOISTURE: curries, gravies, soups, cooked rice, dal, pasta with sauce, stews
- MEDIUM_MOISTURE: cooked vegetables, roasted meats, fried items, noodles, cooked beans
- DRY: bread, roti, chapati, baked goods, dry snacks, crackers

Be conservative with weight estimates. If uncertain about a dish, classify it in the higher perishability tier."""


async def run_vision(image_file) -> Optional[VisionResult]:
    """
    Extract food information from an uploaded image using Gemini Vision.
    
    Process:
    1. Resize image to max 1280px (longest side) to reduce token usage
    2. Send to Gemini 2.5 Flash with structured JSON schema
    3. Validate response with Pydantic
    4. Return None on any failure (timeout, API error, validation error)
    
    Args:
        image_file: UploadFile from FastAPI
    
    Returns:
        VisionResult with items, portions, tier, confidence, and notes
        None if extraction fails (triggers manual entry flow)
    """
    if not settings.GEMINI_API_KEY:
        return None
    
    try:
        # Read and resize image
        image_bytes = await image_file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # Resize to max 1280px on longest side
        max_size = 1280
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Convert to bytes
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        resized_bytes = buffer.getvalue()
        
        # Configure Gemini client
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        # Define response schema
        response_schema = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema={
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "approx_kg": {"type": "number", "minimum": 0, "maximum": 100}
                            },
                            "required": ["name", "approx_kg"]
                        }
                    },
                    "estimated_portions": {"type": "integer", "minimum": 0},
                    "perishability_tier": {
                        "type": "string",
                        "enum": ["HIGH_MOISTURE", "MEDIUM_MOISTURE", "DRY"]
                    },
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "notes": {"type": "string"}
                },
                "required": ["items", "estimated_portions", "perishability_tier", "confidence"]
            }
        )
        
        # Call Gemini with timeout
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_text(text=SYSTEM_PROMPT),
                types.Part.from_bytes(data=resized_bytes, mime_type="image/jpeg")
            ],
            config=response_schema,
        )
        
        # Parse and validate with Pydantic
        import json
        result_dict = json.loads(response.text)
        
        # Validate weights (reject absurd values)
        for item in result_dict.get("items", []):
            if item.get("approx_kg", 0) <= 0 or item.get("approx_kg", 0) > 100:
                return None
        
        # Build VisionResult
        vision_result = VisionResult(**result_dict)
        
        return vision_result
    
    except Exception as e:
        print(f"vision error: {e!r}")
        # Any failure returns None to trigger manual entry
        return None
