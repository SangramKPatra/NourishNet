import asyncio
import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker

from .db import engine, AsyncSessionLocal
from .models import Base, Donor, Shelter, Volunteer, Batch, DispatchLog
from .config import settings

async def create_tables():
    # Use sync engine to create tables (SQLite compatibility)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def seed_demo_data():
    async with AsyncSessionLocal() as session:
        # Demo donor
        if not await session.get(Donor, uuid.UUID('0'*32)):  # placeholder check
            demo_donor = Donor(
                name="Demo Canteen",
                org_type="canteen",
                lat=37.7749,
                lng=-122.4194,
                token="demo-donor-token"
            )
            session.add(demo_donor)
            await session.commit()

        # Demo shelters (4 around city center)
        shelter_coords = [
            (37.7749, -122.4194),  # demo donor location
            (37.7800, -122.4200),
            (37.7600, -122.4300),
            (37.7500, -122.4400),
        ]
        for i, (lat, lng) in enumerate(shelter_coords):
            shelter = Shelter(
                name=f"Shelter {i+1}",
                lat=lat,
                lng=lng,
                capacity_portions=100,
                contact=f"shelter{i+1}@example.com",
                active=True,
                verified=True,
            )
            session.add(shelter)
        await session.commit()

        # Demo volunteers
        for i in range(5):
            volunteer = Volunteer(
                name=f"Volunteer {i+1}",
                telegram_chat_id=f"volunteer{i+1}@example.com",
                lat=37.7700 + i * 0.001,
                lng=-122.4150 + i * 0.001,
                active=True,
            )
            session.add(volunteer)
        await session.commit()

        # Demo batch (draft)
        demo_batch = Batch(
            donor_id=await session.get(Donor, uuid.UUID('0'*32)),  # placeholder; in real code fetch by token
            items=[{
                "name": "cooked rice",
                "approx_kg": 2.0
            }],
            total_kg=2.0,
            portions=13,
            tier="HIGH_MOISTURE",
            ambient_temp_c=32.0,
            humidity_pct=60,
            weather_source="fallback",
            safe_window_min=135,  # 2h15m
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=135),
            status="draft",
            is_demo=True,
        )
        session.add(demo_batch)
        await session.commit()

        # Demo dispatch log stub
        log = DispatchLog(
            batch_id=demo_batch.id,
            channel="telegram",
            payload={"message": "claim"},
            status="pending",
            attempt=1,
            created_at=datetime.utcnow(),
        )
        session.add(log)
        await session.commit()

async def main():
    await create_tables()
    await seed_demo_data()
    print("✅ Phase 1 – Data model tables created and demo seed data loaded (idempotent)")

if __name__ == "__main__":
    asyncio.run(main())