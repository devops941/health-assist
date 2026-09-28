"""Module 10 - Admin Dashboard & Reports (users, flagged chats, settings)."""

from __future__ import annotations

import csv
import json
import io
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.database import get_client
from app.dependencies import require_admin
from app.schemas import AdminSettingsIn, AdminStats, UserOut
from app.utils.helpers import date_range, to_dict

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])

STOPWORDS = {
    "the", "and", "for", "you", "your", "with", "what", "how", "can", "have", "has",
    "are", "was", "were", "this", "that", "there", "about", "should", "would", "could",
    "i", "a", "an", "is", "it", "my", "me", "of", "to", "in", "on", "do", "does",
    "please", "help", "tell", "know", "if", "or", "be", "am", "as", "at", "so",
}


@router.get("/stats", response_model=AdminStats)
async def stats(_: dict = Depends(require_admin)) -> AdminStats:
    db = get_client()
    now = datetime.utcnow()

    total_users = await db.user.count()
    active_users = await db.user.count(where={"isActive": True})
    total_conversations = await db.conversation.count()
    total_messages = await db.message.count()
    total_checks = await db.symptomcheck.count()
    flagged = await db.flaggedchat.count()

    # Common health topics from user messages.
    user_messages = await db.message.find_many(where={"role": "user"})
    counter: Counter[str] = Counter()
    for message in user_messages:
        for word in message.content.lower().split():
            token = "".join(ch for ch in word if ch.isalpha())
            if len(token) > 3 and token not in STOPWORDS:
                counter[token] += 1
    top_topics = [{"topic": word, "count": count} for word, count in counter.most_common(10)]

    # Chat volume per day for the last 14 days.
    window = date_range(14)
    daily_counter: Counter[str] = Counter()
    recent_messages = await db.message.find_many(
        where={"createdAt": {"gte": now - timedelta(days=14)}}
    )
    for message in recent_messages:
        daily_counter[message.createdAt.date().isoformat()] += 1
    daily_chats = [{"date": day, "count": daily_counter.get(day, 0)} for day in window]

    # User growth per day for the last 14 days.
    users = await db.user.find_many(where={"createdAt": {"gte": now - timedelta(days=14)}})
    growth_counter: Counter[str] = Counter(u.createdAt.date().isoformat() for u in users)
    user_growth = [{"date": day, "count": growth_counter.get(day, 0)} for day in window]

    return AdminStats(
        totalUsers=total_users,
        activeUsers=active_users,
        totalConversations=total_conversations,
        totalMessages=total_messages,
        totalSymptomChecks=total_checks,
        flaggedChats=flagged,
        topTopics=top_topics,
        dailyChats=daily_chats,
        userGrowth=user_growth,
    )


@router.get("/users", response_model=list[UserOut])
async def list_users(_: dict = Depends(require_admin)) -> list[UserOut]:
    db = get_client()
    users = await db.user.find_many(order={"createdAt": "desc"})
    return [UserOut(**to_dict(u)) for u in users]


@router.patch("/users/{user_id}/status", response_model=UserOut)
async def set_user_status(
    user_id: str, isActive: bool = Query(...), _: dict = Depends(require_admin)
) -> UserOut:
    db = get_client()
    user = await db.user.find_unique(where={"id": user_id})
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    updated = await db.user.update(where={"id": user_id}, data={"isActive": isActive})
    return UserOut(**to_dict(updated))


@router.get("/flagged")
async def list_flagged(_: dict = Depends(require_admin)) -> list[dict]:
    db = get_client()
    records = await db.flaggedchat.find_many(order={"createdAt": "desc"}, take=200)
    return [to_dict(record) for record in records]


@router.patch("/flagged/{flag_id}/review")
async def review_flag(flag_id: str, _: dict = Depends(require_admin)) -> dict:
    db = get_client()
    record = await db.flaggedchat.find_unique(where={"id": flag_id})
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flagged chat not found")
    updated = await db.flaggedchat.update(where={"id": flag_id}, data={"reviewed": True})
    return to_dict(updated)


# -------------------------------------------------------------- settings
@router.get("/settings")
async def get_settings(_: dict = Depends(require_admin)) -> list[dict]:
    db = get_client()
    rows = await db.adminsetting.find_many()
    out: list[dict] = []
    for row in rows:
        data = to_dict(row)
        try:
            data["value"] = json.loads(data.get("value") or "null")
        except (json.JSONDecodeError, TypeError):
            pass
        out.append(data)
    return out


@router.put("/settings/{key}")
async def put_setting(
    key: str, payload: AdminSettingsIn, admin: dict = Depends(require_admin)
) -> dict:
    db = get_client()
    encoded = json.dumps(payload.value, default=str)
    existing = await db.adminsetting.find_unique(where={"key": key})
    if existing is None:
        row = await db.adminsetting.create(
            data={"key": key, "value": encoded, "updatedBy": admin["email"]}
        )
    else:
        row = await db.adminsetting.update(
            where={"key": key}, data={"value": encoded, "updatedBy": admin["email"]}
        )
    data = to_dict(row)
    try:
        data["value"] = json.loads(data.get("value") or "null")
    except (json.JSONDecodeError, TypeError):
        pass
    return data


# --------------------------------------------------------------- reports
@router.get("/reports/flagged.csv")
async def flagged_csv(_: dict = Depends(require_admin)) -> StreamingResponse:
    db = get_client()
    records = await db.flaggedchat.find_many(order={"createdAt": "desc"})
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["created_at", "source", "severity", "matched_rules", "reviewed", "content"])
    for record in records:
        writer.writerow(
            [
                record.createdAt.isoformat(),
                record.source,
                record.severity,
                "; ".join(record.matchedRules or []),
                record.reviewed,
                (record.content or "").replace("\n", " ")[:300],
            ]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=flagged_chats.csv"},
    )


@router.get("/reports/summary.csv")
async def summary_csv(_: dict = Depends(require_admin)) -> StreamingResponse:
    db = get_client()
    data = await stats(_)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["metric", "value"])
    for field in (
        "totalUsers",
        "activeUsers",
        "totalConversations",
        "totalMessages",
        "totalSymptomChecks",
        "flaggedChats",
    ):
        writer.writerow([field, getattr(data, field)])
    writer.writerow([])
    writer.writerow(["top_topic", "count"])
    for topic in data.topTopics:
        writer.writerow([topic["topic"], topic["count"]])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=admin_summary.csv"},
    )
