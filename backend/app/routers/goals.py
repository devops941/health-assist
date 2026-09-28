"""Module 7 - Goals & Reminders (streaks, goal progress)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Response

from app.database import get_client
from app.dependencies import get_current_user
from app.schemas import GoalIn, GoalOut, GoalProgressIn, ReminderIn, ReminderOut
from app.utils.helpers import clean_list, to_dict

router = APIRouter(prefix="/api/goals", tags=["Goals & Reminders"])
reminder_router = APIRouter(prefix="/api/reminders", tags=["Goals & Reminders"])


# --------------------------------------------------------------- goals
@router.get("", response_model=list[GoalOut])
async def list_goals(user: dict = Depends(get_current_user)) -> list[GoalOut]:
    db = get_client()
    goals = await db.goal.find_many(where={"userId": user["id"]}, order={"createdAt": "desc"})
    return [GoalOut(**to_dict(goal)) for goal in goals]


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(payload: GoalIn, user: dict = Depends(get_current_user)) -> GoalOut:
    db = get_client()
    goal = await db.goal.create(data={"userId": user["id"], **payload.model_dump()})
    return GoalOut(**to_dict(goal))


@router.put("/{goal_id}/progress", response_model=GoalOut)
async def update_progress(
    goal_id: str, payload: GoalProgressIn, user: dict = Depends(get_current_user)
) -> GoalOut:
    db = get_client()
    goal = await db.goal.find_unique(where={"id": goal_id})
    if goal is None or goal.userId != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")

    progress = min(payload.progress, float(goal.target))
    streak = goal.streak
    # A goal is "met" for the period when progress reaches the target.
    if progress >= float(goal.target):
        streak += 1

    updated = await db.goal.update(
        where={"id": goal_id}, data={"progress": progress, "streak": streak}
    )
    return GoalOut(**to_dict(updated))


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_goal(goal_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    goal = await db.goal.find_unique(where={"id": goal_id})
    if goal is None or goal.userId != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
    await db.goal.delete(where={"id": goal_id})


# ----------------------------------------------------------- reminders
@reminder_router.get("", response_model=list[ReminderOut])
async def list_reminders(user: dict = Depends(get_current_user)) -> list[ReminderOut]:
    db = get_client()
    reminders = await db.reminder.find_many(
        where={"userId": user["id"]}, order={"time": "asc"}
    )
    return [ReminderOut(**to_dict(r)) for r in reminders]


@reminder_router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
async def create_reminder(payload: ReminderIn, user: dict = Depends(get_current_user)) -> ReminderOut:
    db = get_client()
    data = payload.model_dump()
    data["days"] = clean_list(data.get("days"))
    reminder = await db.reminder.create(data={"userId": user["id"], **data})
    return ReminderOut(**to_dict(reminder))


@reminder_router.put("/{reminder_id}", response_model=ReminderOut)
async def update_reminder(
    reminder_id: str, payload: ReminderIn, user: dict = Depends(get_current_user)
) -> ReminderOut:
    db = get_client()
    reminder = await db.reminder.find_unique(where={"id": reminder_id})
    if reminder is None or reminder.userId != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reminder not found")
    data = payload.model_dump()
    data["days"] = clean_list(data.get("days"))
    updated = await db.reminder.update(where={"id": reminder_id}, data=data)
    return ReminderOut(**to_dict(updated))


@reminder_router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    reminder = await db.reminder.find_unique(where={"id": reminder_id})
    if reminder is None or reminder.userId != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reminder not found")
    await db.reminder.delete(where={"id": reminder_id})
