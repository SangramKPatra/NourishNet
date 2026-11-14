import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from .config import settings
from .db import AsyncSessionLocal, Base, engine
from .models import Batch, DispatchLog, Donor, Shelter, Volunteer


async def create_tables() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def seed_demo_data() -> None:
    async with AsyncSessionLocal() as session:
        donor = await session.scalar(
            select(Donor).where(Donor.token == "demo-donor-token")
        )
        if donor is None:
            donor = Donor(
                name="Demo Canteen",
                org_type="canteen",
                lat=37.7749,
                lng=-122.4194,
                token="demo-donor-token",
            )
            session.add(donor)
            await session.flush()

        shelter_coords = [
            (37.7749, -122.4194),
            (37.7800, -122.4200),
            (37.7600, -122.4300),
            (37.7500, -122.4400),
        ]
        for index, (lat, lng) in enumerate(shelter_coords, start=1):
            name = f"Shelter {index}"
            shelter = await session.scalar(
                select(Shelter).where(Shelter.name == name)
            )
            if shelter is None:
                session.add(
                    Shelter(
                        name=name,
                        lat=lat,
                        lng=lng,
                        capacity_portions=100,
                        contact=f"shelter{index}@example.com",
                        active=True,
                        verified=True,
                    )
                )

        for index in range(1, 6):
            chat_id = f"volunteer{index}@example.com"
            volunteer = await session.scalar(
                select(Volunteer).where(Volunteer.telegram_chat_id == chat_id)
            )
            if volunteer is None:
                session.add(
                    Volunteer(
                        name=f"Volunteer {index}",
                        telegram_chat_id=chat_id,
                        lat=37.7700 + index * 0.001,
                        lng=-122.4150 + index * 0.001,
                        active=True,
                    )
                )

        demo_batch = await session.scalar(
            select(Batch).where(
                Batch.donor_id == donor.id,
                Batch.is_demo.is_(True),
            )
        )
        if demo_batch is None:
            now = datetime.utcnow()
            demo_batch = Batch(
                donor_id=donor.id,
                items=[{"name": "cooked rice", "approx_kg": 2.0}],
                total_kg=2.0,
                portions=13,
                tier="HIGH_MOISTURE",
                ambient_temp_c=32.0,
                humidity_pct=60.0,
                weather_source="fallback",
                safe_window_min=135,
                created_at=now,
                expires_at=now + timedelta(minutes=135),
                status="draft",
                lat=donor.lat,
                lng=donor.lng,
                is_demo=True,
            )
            session.add(demo_batch)
            await session.flush()

        log = await session.scalar(
            select(DispatchLog).where(
                DispatchLog.batch_id == demo_batch.id,
                DispatchLog.channel == "telegram",
            )
        )
        if log is None:
            session.add(
                DispatchLog(
                    batch_id=demo_batch.id,
                    channel="telegram",
                    payload={"message": "claim"},
                    status="pending",
                    attempt=1,
                )
            )

        await session.commit()


async def main() -> None:
    await create_tables()
    await seed_demo_data()
    print("Demo donor, shelters, volunteers, and batch seeded idempotently")


if __name__ == "__main__":
    asyncio.run(main())
