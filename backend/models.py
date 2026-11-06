from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .models import Base, Tier

class Donor(Base):
    __tablename__ = "donors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    org_type = Column(Enum("canteen", "caterer", "cloud_kitchen", "other"), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    token = Column(String, unique=True, nullable=False)

class Shelter(Base):
    __tablename__ = "shelters"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    capacity_portions = Column(Integer, nullable=False)
    contact = Column(String)
    active = Column(Boolean, default=True)
    verified = Column(Boolean, default=False)

class Volunteer(Base):
    __tablename__ = "volunteers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    telegram_chat_id = Column(String, unique=True, nullable=False)
    lat = Column(Float)
    lng = Column(Float)
    active = Column(Boolean, default=True)

class Batch(Base):
    __tablename__ = "batches"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    donor_id = Column(UUID(as_uuid=True), nullable=False)
    items = Column(JSON, nullable=False)
    total_kg = Column(Float, nullable=False)
    portions = Column(Integer, nullable=False)
    tier = Column(Enum(Tier), nullable=False)
    ambient_temp_c = Column(Float)
    humidity_pct = Column(Float)
    weather_source = Column(String)
    safe_window_min = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    status = Column(String, nullable=False, default="draft")
    shelter_id = Column(UUID(as_uuid=True))
    volunteer_id = Column(UUID(as_uuid=True))
    lat = Column(Float)
    lng = Column(Float)
    is_demo = Column(Boolean, default=False)

class DispatchLog(Base):
    __tablename__ = "dispatch_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), nullable=False)
    channel = Column(String)
    payload = Column(JSON)
    status = Column(String)
    attempt = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
