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
