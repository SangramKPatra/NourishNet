from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .routers import batches, stats, telegram
from .config import settings
import uvicorn

app = FastAPI(title="NourishNet API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.PUBLIC_BASE_URL],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches.router, prefix="/api/batches", tags=["batches"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])

@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
