"""User authentication: registration, login, token validation."""
import hashlib
import secrets
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, UserToken


def _hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    """Hash a password with PBKDF2-HMAC-SHA256. Returns (hash_hex, salt_hex)."""
    if salt is None:
        salt = secrets.token_bytes(32)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        200_000,
    )
    return key.hex(), salt.hex()


def verify_password(password: str, salt_hex: str, expected_hash: str) -> bool:
    salt = bytes.fromhex(salt_hex)
    actual, _ = _hash_password(password, salt)
    return secrets.compare_digest(actual, expected_hash)


def _generate_token() -> str:
    return secrets.token_urlsafe(48)


async def register_user(
    session: AsyncSession,
    email: str,
    password: str,
    role: str,
    lat: float | None,
    lng: float | None,
    radius_km: float,
) -> User:
    """Create a new user. Raises ValueError if email already exists."""
    existing = await session.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise ValueError("Email already registered")

    password_hash, salt = _hash_password(password)
    user = User(
        id=uuid4(),
        email=email,
        password_hash=password_hash,
        password_salt=salt,
        role=role,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
    )
    session.add(user)
    await session.flush()

    token = _generate_token()
    session.add(UserToken(
        id=uuid4(),
        user_id=user.id,
        token=token,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=30),
    ))
    await session.commit()
    await session.refresh(user)
    return user


async def login_user(
    session: AsyncSession,
    email: str,
    password: str,
) -> tuple[User, str] | None:
    """Authenticate a user and return (user, new_token), or None on failure."""
    user = await session.scalar(select(User).where(User.email == email))
    if user is None or not user.active:
        return None
    if not verify_password(password, user.password_salt, user.password_hash):
        return None

    token = _generate_token()
    record = UserToken(
        id=uuid4(),
        user_id=user.id,
        token=token,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=30),
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return user, token


async def get_current_user(
    session: AsyncSession,
    token: str | None,
) -> User | None:
    """Validate a bearer token and return the associated User, or None."""
    if not token:
        return None
    record = await session.scalar(
        select(UserToken).where(
            UserToken.token == token,
            UserToken.expires_at > datetime.utcnow(),
        )
    )
    if record is None:
        return None
    user = await session.get(User, record.user_id)
    if user is None or not user.active:
        return None
    return user


async def logout_user(session: AsyncSession, token: str) -> bool:
    """Delete a token so it can no longer be used."""
    record = await session.scalar(
        select(UserToken).where(UserToken.token == token)
    )
    if record is None:
        return False
    await session.delete(record)
    await session.commit()
    return True