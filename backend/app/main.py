import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select

from ..config import settings
from ..db import AsyncSessionLocal, Base, engine
from ..models import Batch, DispatchLog, User
from ..routers import batches, stats, telegram, auth
from ..services import storage


async def expire_batches() -> None:
    """Remove expired food and its related records from the active system."""
    while True:
        try:
            async with AsyncSessionLocal() as session:
                now = datetime.utcnow()
                expired_batches = list((
                    await session.scalars(
                        select(Batch).where(
                            Batch.expires_at <= now,
                            Batch.status != "delivered",
                        )
                    )
                ).all())
                if expired_batches:
                    batch_ids = [batch.id for batch in expired_batches]
                    for batch in expired_batches:
                        await storage.delete_batch_image(batch.id)
                    await session.execute(delete(DispatchLog).where(DispatchLog.batch_id.in_(batch_ids)))
                    await session.execute(delete(Batch).where(Batch.id.in_(batch_ids)))
                await session.commit()
        except Exception:
            # Maintenance must never take down the API process.
            import logging
            logging.getLogger(__name__).exception("Expired batch cleanup failed")
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    task = asyncio.create_task(expire_batches())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="NourishNet API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.PUBLIC_BASE_URL, "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(batches.router, prefix="/api/batches", tags=["batches"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
