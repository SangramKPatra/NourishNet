"""Authentication routes: sign-up, sign-in, me, logout."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from ..db import get_session
from ..models import User
from ..schemas import UserRegister, UserLogin, UserResponse, UserTokenResponse
from ..services.auth import register_user, login_user, get_current_user, logout_user


router = APIRouter(tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)


@router.post("/signup", response_model=UserTokenResponse)
async def signup(
    payload: UserRegister,
    session=Depends(get_session),
):
    """Register as a new food supplier or distributor."""
    try:
        user = await register_user(
            session,
            email=payload.email,
            password=payload.password,
            role=payload.role,
            lat=payload.lat,
            lng=payload.lng,
            radius_km=payload.radius_km,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    token_record = await login_user(session, payload.email, payload.password)
    if token_record is None:
        raise HTTPException(status_code=500, detail="Could not create session")
    _, token = token_record
    return UserTokenResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )


@router.post("/signin", response_model=UserTokenResponse)
async def signin(
    payload: UserLogin,
    session=Depends(get_session),
):
    """Sign in and receive a bearer token."""
    result = await login_user(session, payload.email, payload.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user, token = result
    return UserTokenResponse(
        token=token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session=Depends(get_session),
):
    """Get the current user."""
    token = credentials.credentials if credentials else None
    user = await get_current_user(session, token)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return UserResponse.model_validate(user)


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session=Depends(get_session),
):
    """Sign out and revoke the current token."""
    token = credentials.credentials if credentials else None
    if not token:
        return {"message": "Logged out"}
    await logout_user(session, token)
    return {"message": "Logged out"}