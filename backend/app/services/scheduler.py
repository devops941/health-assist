"""Background reminder scheduler (Module 7).

Runs a lightweight APScheduler job every minute that marks reminders due at the
current time and records ``lastTriggeredAt``. Actual delivery (email/push) is a
documented extension point - see docs/DEPLOYMENT.md.
"""

from __future__ import annotations

import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _tick() -> None:
    from app.database import get_client, is_client_generated

    if not is_client_generated():
        return
    db = get_client()
    if not db.is_connected():
        return

    now = datetime.now()
    hhmm = now.strftime("%H:%M")
    weekday = now.strftime("%a").lower()

    try:
        reminders = await db.reminder.find_many(where={"isActive": True, "time": hhmm})
    except Exception as exc:  # noqa: BLE001
        logger.warning("Reminder tick failed: %s", exc)
        return

    for reminder in reminders:
        days = reminder.days or []
        if reminder.frequency == "weekly" and days and weekday not in [d.lower() for d in days]:
            continue
        try:
            await db.reminder.update(
                where={"id": reminder.id}, data={"lastTriggeredAt": now}
            )
            logger.info("Reminder due: %s (%s)", reminder.title, reminder.time)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not update reminder %s: %s", reminder.id, exc)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(_tick, "interval", minutes=1, id="reminder_tick", replace_existing=True)
    _scheduler.start()
    logger.info("Reminder scheduler started")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:  # noqa: BLE001
            pass
        _scheduler = None
