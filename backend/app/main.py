import asyncio
from contextlib import asynccontextmanager, suppress
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, update

from ..config import settings
from ..db import AsyncSessionLocal, Base, engine
from ..models import Batch
from ..routers import batches, stats, telegram


async def expire_batches() -> None:
    """Background maintenance for expired and at-risk unclaimed batches."""
    while True:
        try:
            async with AsyncSessionLocal() as session:
                now = datetime.utcnow()
                await session.execute(
                    update(Batch)
                    .where(
                        Batch.expires_at <= now,
                        Batch.status.in_(["draft", "pending", "dispatched", "at_risk"]),
                    )
                    .values(status="expired")
                )
                await session.commit()
        except Exception:
            # Maintenance must never take down the API process.
            pass
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

app.include_router(batches.router, prefix="/api/batches", tags=["batches"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
