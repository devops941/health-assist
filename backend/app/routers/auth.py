"""Module 1 - Login & Authentication."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_client
from app.dependencies import get_current_user
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.security import create_access_token, hash_password, verify_password
from app.utils.helpers import to_dict

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> TokenResponse:
    db = get_client()
    email = payload.email.lower()

    existing = await db.user.find_unique(where={"email": email})
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = await db.user.create(
        data={
            "email": email,
            "passwordHash": hash_password(payload.password),
            "fullName": payload.fullName.strip(),
            "role": "USER",
        }
    )
    # Every user gets an empty health profile so the profile page always works.
    await db.healthprofile.create(data={"userId": user.id})

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut(**to_dict(user)))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    db = get_client()
    user = await db.user.find_unique(where={"email": payload.email.lower()})
    if user is None or not verify_password(payload.password, user.passwordHash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.isActive:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut(**to_dict(user)))


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)) -> UserOut:
    db = get_client()
    record = await db.user.find_unique(where={"id": user["id"]})
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return UserOut(**to_dict(record))
