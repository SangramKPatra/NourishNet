# Phase 4 — Vision extraction using NVIDIA NIM (google/gemma-4-31b-it)
import base64
import io
import json
from typing import Optional

import httpx
from PIL import Image

from ..config import settings
from ..schemas import VisionResult

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

Be conservative with weight estimates. If uncertain about a dish, classify it in the higher perishability tier.

Return ONLY a single JSON object with no markdown fences or extra text, in this exact shape:
{
  "items": [{"name": "<dish>", "approx_kg": <number>}],
  "estimated_portions": <integer>,
  "perishability_tier": "<HIGH_MOISTURE | MEDIUM_MOISTURE | DRY>",
  "confidence": <number between 0 and 1>,
  "notes": "<short note>"
}"""


def _extract_json(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.lstrip().startswith("json"):
            content = content.lstrip()[4:]
    return json.loads(content.strip())


async def run_vision(image_file) -> Optional[VisionResult]:
    """
    Extract food information from an uploaded image using NVIDIA NIM.

    Process:
    1. Resize image to max 1280px (longest side) to reduce token usage
    2. Encode image as a base64 JPEG data URL
    3. POST an OpenAI-compatible chat completion to the NVIDIA NIM endpoint
    4. Parse the JSON content of the first choice with Pydantic validation
    5. Return None on any failure (timeout, API error, validation error)

    Args:
        image_file: UploadFile from FastAPI

    Returns:
        VisionResult with items, portions, tier, confidence, and notes
        None if extraction fails (triggers manual entry flow)
    """
    if not settings.NVIDIA_API_KEY:
        return None

    try:
        image_bytes = await image_file.read()
        image = Image.open(io.BytesIO(image_bytes))

        max_size = 1280
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.Resampling.LANCZOS)

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        b64_image = base64.b64encode(buffer.getvalue()).decode("utf-8")

        headers = {
            "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
            "Accept": "application/json",
        }
        payload = {
            "model": settings.VISION_MODEL,
            "max_tokens": 1024,
            "stream": False,
            "temperature": 0.5,
            "top_p": 1,
            "frequency_penalty": 0,
            "presence_penalty": 0,
            "seed": 0,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze this photo of leftover cooked food and return the JSON result.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"},
                        },
                    ],
                },
            ],
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.NVIDIA_INVOKE_URL,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]

        result_dict = _extract_json(content)

        for item in result_dict.get("items", []):
            if item.get("approx_kg", 0) <= 0 or item.get("approx_kg", 0) > 100:
                return None

        return VisionResult(**result_dict)

    except Exception as e:
        print(f"vision error: {e!r}")
        return None
