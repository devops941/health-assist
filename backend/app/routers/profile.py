"""Module 2 - Health Profile."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_client
from app.dependencies import get_current_user
from app.schemas import HealthProfileIn, HealthProfileOut
from app.utils.helpers import clean_list, to_dict

router = APIRouter(prefix="/api/profile", tags=["Health Profile"])


def _normalise(payload: HealthProfileIn) -> dict:
    data = payload.model_dump()
    for key in ("allergies", "conditions", "medications"):
        data[key] = clean_list(data.get(key))
    return data


@router.get("", response_model=HealthProfileOut)
async def get_profile(user: dict = Depends(get_current_user)) -> HealthProfileOut:
    db = get_client()
    profile = await db.healthprofile.find_unique(where={"userId": user["id"]})
    if profile is None:
        profile = await db.healthprofile.create(data={"userId": user["id"]})
    return HealthProfileOut(**to_dict(profile))


@router.put("", response_model=HealthProfileOut)
async def update_profile(
    payload: HealthProfileIn, user: dict = Depends(get_current_user)
) -> HealthProfileOut:
    db = get_client()
    data = _normalise(payload)
    existing = await db.healthprofile.find_unique(where={"userId": user["id"]})
    if existing is None:
        profile = await db.healthprofile.create(data={"userId": user["id"], **data})
    else:
        profile = await db.healthprofile.update(where={"userId": user["id"]}, data=data)
    if profile is None:  # pragma: no cover
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not save profile")
    return HealthProfileOut(**to_dict(profile))
