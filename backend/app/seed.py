"""Seed the database with an admin, demo user, wellness logs, goals and reminders.

Usage:  cd backend && python -m app.seed
"""

from __future__ import annotations

import asyncio
import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from prisma_client import Prisma  # noqa: E402

from app.config import settings  # noqa: E402
from app.security import hash_password  # noqa: E402


async def seed() -> None:
    db = Prisma()
    await db.connect()

    admin = await db.user.find_unique(where={"email": settings.admin_email.lower()})
    if admin is None:
        admin = await db.user.create(
            data={
                "email": settings.admin_email.lower(),
                "passwordHash": hash_password(settings.admin_password),
                "fullName": "System Admin",
                "role": "ADMIN",
            }
        )
        print(f"Created admin: {admin.email} / {settings.admin_password}")
    else:
        print(f"Admin already exists: {admin.email}")

    demo_email = "demo@healthassistant.ai"
    demo = await db.user.find_unique(where={"email": demo_email})
    if demo is None:
        demo = await db.user.create(
            data={
                "email": demo_email,
                "passwordHash": hash_password("Demo@12345"),
                "fullName": "Demo User",
                "role": "USER",
            }
        )
        print(f"Created demo user: {demo.email} / Demo@12345")
    else:
        print(f"Demo user already exists: {demo.email}")

    profile = await db.healthprofile.find_unique(where={"userId": demo.id})
    profile_data = {
        "age": 29,
        "gender": "female",
        "heightCm": 165,
        "weightKg": 62,
        "bloodGroup": "O+",
        "allergies": ["penicillin"],
        "conditions": ["mild asthma"],
        "medications": ["salbutamol inhaler"],
        "activityLevel": "moderate",
    }
    if profile is None:
        await db.healthprofile.create(data={"userId": demo.id, **profile_data})
    else:
        await db.healthprofile.update(where={"userId": demo.id}, data=profile_data)

    existing_logs = await db.wellnesslog.count(where={"userId": demo.id})
    if existing_logs == 0:
        moods = ["great", "good", "okay", "low"]
        for offset in range(13, -1, -1):
            day = (date.today() - timedelta(days=offset)).isoformat()
            await db.wellnesslog.create(
                data={
                    "userId": demo.id,
                    "logDate": day,
                    "waterGlasses": random.randint(4, 10),
                    "sleepHours": round(random.uniform(5.5, 8.5), 1),
                    "steps": random.randint(3000, 12000),
                    "exerciseMinutes": random.randint(0, 60),
                    "mood": random.choice(moods),
                    "weightKg": round(62 + random.uniform(-1.5, 1.5), 1),
                }
            )
        print("Seeded 14 wellness logs for the demo user")

    if await db.goal.count(where={"userId": demo.id}) == 0:
        await db.goal.create_many(
            data=[
                {"userId": demo.id, "type": "water", "title": "Drink 8 glasses of water", "target": 8, "unit": "glasses", "progress": 6, "streak": 3},
                {"userId": demo.id, "type": "sleep", "title": "Sleep 7 hours", "target": 7, "unit": "hours", "progress": 7, "streak": 5},
                {"userId": demo.id, "type": "steps", "title": "Walk 8000 steps", "target": 8000, "unit": "steps", "progress": 5400, "streak": 2},
            ]
        )
        print("Seeded demo goals")

    if await db.reminder.count(where={"userId": demo.id}) == 0:
        await db.reminder.create_many(
            data=[
                {"userId": demo.id, "title": "Drink water", "type": "water", "time": "10:00", "frequency": "daily"},
                {"userId": demo.id, "title": "Take inhaler", "type": "medicine", "time": "08:00", "frequency": "daily"},
                {"userId": demo.id, "title": "Evening walk", "type": "activity", "time": "18:30", "frequency": "weekly", "days": ["mon", "wed", "fri"]},
            ]
        )
        print("Seeded demo reminders")

    if await db.adminsetting.find_unique(where={"key": "safety_rules"}) is None:
        await db.adminsetting.create(
            data={
                "key": "safety_rules",
                "value": json.dumps(
                    {
                        "enabled": True,
                        "escalateOnRedFlag": True,
                        "disclaimerRequired": True,
                    }
                ),
            }
        )
        print("Seeded admin settings")

    await db.disconnect()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
