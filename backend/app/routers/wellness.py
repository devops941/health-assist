"""Module 6 - Wellness Tracker (+ Module 8 AI wellness tips)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi import Response

from app.database import get_client
from app.dependencies import get_current_user
from app.schemas import WellnessLogIn, WellnessLogOut, WellnessSummary
from app.services import groq_service
from app.utils.helpers import date_range, to_dict, today_str

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wellness", tags=["Wellness Tracker"])

NUMERIC_FIELDS = ("waterGlasses", "sleepHours", "steps", "exerciseMinutes", "weightKg")


@router.get("/logs", response_model=list[WellnessLogOut])
async def list_logs(
    days: int = Query(default=30, ge=1, le=365), user: dict = Depends(get_current_user)
) -> list[WellnessLogOut]:
    db = get_client()
    start = date_range(days)[0]
    logs = await db.wellnesslog.find_many(
        where={"userId": user["id"], "logDate": {"gte": start}},
        order={"logDate": "asc"},
    )
    return [WellnessLogOut(**to_dict(log)) for log in logs]


@router.post("/logs", response_model=WellnessLogOut, status_code=status.HTTP_201_CREATED)
async def upsert_log(
    payload: WellnessLogIn, user: dict = Depends(get_current_user)
) -> WellnessLogOut:
    db = get_client()
    log_date = payload.logDate or today_str()
    data = payload.model_dump()
    data["logDate"] = log_date

    existing = await db.wellnesslog.find_unique(
        where={"userId_logDate": {"userId": user["id"], "logDate": log_date}}
    )
    if existing is None:
        log = await db.wellnesslog.create(data={"userId": user["id"], **data})
    else:
        log = await db.wellnesslog.update(where={"id": existing.id}, data=data)
    if log is None:  # pragma: no cover
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not save log")
    return WellnessLogOut(**to_dict(log))


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_log(log_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    log = await db.wellnesslog.find_unique(where={"id": log_id})
    if log is None or log.userId != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log not found")
    await db.wellnesslog.delete(where={"id": log_id})


@router.get("/summary", response_model=WellnessSummary)
async def summary(
    days: int = Query(default=7, ge=1, le=90), user: dict = Depends(get_current_user)
) -> WellnessSummary:
    db = get_client()
    window = date_range(days)
    start = window[0]
    logs = await db.wellnesslog.find_many(
        where={"userId": user["id"], "logDate": {"gte": start}}, order={"logDate": "asc"}
    )
    records = [to_dict(log) for log in logs]
    by_date = {rec["logDate"]: rec for rec in records}

    series: list[dict] = []
    totals: dict[str, float] = {field: 0.0 for field in NUMERIC_FIELDS}
    counts: dict[str, int] = {field: 0 for field in NUMERIC_FIELDS}

    for day in window:
        rec = by_date.get(day, {})
        point: dict = {"date": day}
        for field in NUMERIC_FIELDS:
            value = rec.get(field)
            point[field] = value if value is not None else 0
            if value is not None:
                totals[field] += float(value)
                counts[field] += 1
        point["mood"] = rec.get("mood")
        series.append(point)

    averages = {
        field: round(totals[field] / counts[field], 2) if counts[field] else 0.0
        for field in NUMERIC_FIELDS
    }
    return WellnessSummary(
        range=f"last {days} days",
        totals={k: round(v, 2) for k, v in totals.items()},
        averages=averages,
        series=series,
        logCount=len(records),
    )


@router.get("/tips")
async def tips(user: dict = Depends(get_current_user)) -> dict:
    """Module 8 - AI reviews tracked data and suggests simple improvements."""
    db = get_client()
    profile = await db.healthprofile.find_unique(where={"userId": user["id"]})
    logs = await db.wellnesslog.find_many(
        where={"userId": user["id"]}, order={"logDate": "desc"}, take=14
    )
    goals = await db.goal.find_many(where={"userId": user["id"], "isActive": True})

    try:
        result = groq_service.wellness_tips(
            profile=to_dict(profile) if profile else None,
            logs=[to_dict(log) for log in reversed(logs)],
            goals=[to_dict(goal) for goal in goals],
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Groq wellness tips failed: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "AI tips are temporarily unavailable. Please try again.",
        ) from exc
    return result
