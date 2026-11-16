from datetime import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from .db import Base


class GUID(TypeDecorator):
    """Store UUIDs natively on PostgreSQL and as strings on SQLite."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


class Donor(Base):
    __tablename__ = "donors"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    org_type = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)


class Shelter(Base):
    __tablename__ = "shelters"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    capacity_portions = Column(Integer, nullable=False)
    contact = Column(String)
    active = Column(Boolean, default=True, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)


class Volunteer(Base):
    __tablename__ = "volunteers"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    telegram_chat_id = Column(String, unique=True, nullable=False)
    lat = Column(Float)
    lng = Column(Float)
    active = Column(Boolean, default=True, nullable=False)


class Batch(Base):
    __tablename__ = "batches"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    donor_id = Column(GUID(), ForeignKey("donors.id"), nullable=False, index=True)
    items = Column(JSON, nullable=False)
    total_kg = Column(Float, nullable=False)
    portions = Column(Integer, nullable=False)
    tier = Column(String, nullable=False)
    ambient_temp_c = Column(Float)
    humidity_pct = Column(Float)
    weather_source = Column(String)
    safe_window_min = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime)
    status = Column(String, nullable=False, default="draft", index=True)
    shelter_id = Column(GUID(), ForeignKey("shelters.id"))
    volunteer_id = Column(GUID(), ForeignKey("volunteers.id"))
    lat = Column(Float)
    lng = Column(Float)
    is_demo = Column(Boolean, default=False, nullable=False)


class DispatchLog(Base):
    __tablename__ = "dispatch_logs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    batch_id = Column(GUID(), ForeignKey("batches.id"), nullable=False, index=True)
    channel = Column(String)
    payload = Column(JSON)
    status = Column(String)
    attempt = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    password_salt = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "supplier" | "distributor"
    lat = Column(Float)
    lng = Column(Float)
    radius_km = Column(Float, default=10.0)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserToken(Base):
    __tablename__ = "user_tokens"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
