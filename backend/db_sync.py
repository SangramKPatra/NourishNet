import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import uuid

from config import settings

engine = create_engine(settings.DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def seed():
    # Import models after engine creation to avoid circular imports
    from models import Donor, Shelter, Volunteer, Batch, DispatchLog, Base
    
    # Drop and recreate tables (idempotent for dev)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    with get_session() as session:
        # Demo donor
        demo_donor = Donor(
            id=uuid.uuid4(),
            name="Demo Canteen",
            org_type="canteen",
            lat=37.7749,
            lng=-122.4194,
            token="demo-donor-token"
        )
        session.add(demo_donor)

        # Demo shelters
        shelter_coords = [
            (37.7749, -122.4194),
            (37.7800, -122.4200),
            (37.7600, -122.4300),
            (37.7500, -122.4400),
        ]
        for i, (lat, lng) in enumerate(shelter_coords):
            shelter = Shelter(
                id=uuid.uuid4(),
                name=f"Shelter {i+1}",
                lat=lat,
                lng=lng,
                capacity_portions=100,
                contact=f"shelter{i+1}@example.com",
                active=True,
                verified=True,
            )
            session.add(shelter)

        # Demo volunteers
        for i in range(5):
            volunteer = Volunteer(
                id=uuid.uuid4(),
                name=f"Volunteer {i+1}",
                telegram_chat_id=f"volunteer{i+1}@example.com",
                lat=37.7700 + i * 0.001,
                lng=-122.4150 + i * 0.001,
                active=True,
            )
            session.add(volunteer)

        # Demo batch
        demo_batch = Batch(
            id=uuid.uuid4(),
            donor_id=demo_donor.id,
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
            safe_window_min=135,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=135),
            status="draft",
            is_demo=True,
        )
        session.add(demo_batch)

        # Demo dispatch log
        log = DispatchLog(
            id=uuid.uuid4(),
            batch_id=demo_batch.id,
            channel="telegram",
            payload={"message": "claim"},
            status="pending",
            attempt=1,
            created_at=datetime.utcnow(),
        )
        session.add(log)

        session.commit()
        print("✅ Phase 1 – Data model tables created and demo seed data loaded (idempotent)")

if __name__ == "__main__":
    seed()