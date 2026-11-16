"""Upload donor images to Supabase Storage."""
import logging
from uuid import UUID

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


async def store_batch_image(
    image_bytes: bytes,
    content_type: str | None,
    batch_id: UUID,
) -> str | None:
    if not settings.STORE_IMAGES or not settings.SUPABASE_URL:
        return None

    access_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    if not access_key:
        logger.warning("Image storage is enabled but no Supabase storage key is configured")
        return None

    path = f"batches/{batch_id}"
    endpoint = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{settings.STORAGE_BUCKET}/{path}"
    headers = {
        "Authorization": f"Bearer {access_key}",
        "apikey": access_key,
        "Content-Type": content_type or "application/octet-stream",
        "x-upsert": "true",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(endpoint, content=image_bytes, headers=headers)
            response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("Could not store image for batch %s", batch_id)
        return None

    return f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{settings.STORAGE_BUCKET}/{path}"


async def delete_batch_image(batch_id: UUID) -> None:
    if not settings.STORE_IMAGES or not settings.SUPABASE_URL:
        return

    access_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    if not access_key:
        logger.warning("Cannot delete image for batch %s: no Supabase storage key is configured", batch_id)
        return

    endpoint = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{settings.STORAGE_BUCKET}/batches/{batch_id}"
    headers = {"Authorization": f"Bearer {access_key}", "apikey": access_key}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.delete(endpoint, headers=headers)
            if response.status_code not in {200, 204, 404}:
                response.raise_for_status()
    except httpx.HTTPError:
        logger.exception("Could not delete image for expired batch %s", batch_id)
