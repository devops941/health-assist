"""AI Health Assistant - FastAPI application entry point.

Three-tier architecture: the Next.js frontend calls this REST API only. All
database access, JWT verification, red-flag safety checks and Groq AI calls
happen here, so the Groq key and MongoDB credentials never reach the browser.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import connect, disconnect, is_client_generated
from app.routers import admin, auth, chat, goals, profile, symptoms, wellness
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("healthassistant")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if is_client_generated():
        await connect()
    else:  # pragma: no cover
        logger.error(
            "Prisma client not generated. Run: cd backend && npm run prisma:generate"
        )
    start_scheduler()
    yield
    stop_scheduler()
    await disconnect()


app = FastAPI(
    title="AI Health Assistant API",
    description=(
        "Backend for the AI Health Assistant: authentication, health profile, "
        "Groq-powered health Q&A, symptom checker, red-flag alerts, wellness "
        "tracking, goals, reminders, AI tips and the admin dashboard.\n\n"
        "**Disclaimer:** general health information only - not a diagnosis and "
        "not a substitute for a doctor."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(chat.router)
app.include_router(symptoms.router)
app.include_router(wellness.router)
app.include_router(goals.router)
app.include_router(goals.reminder_router)
app.include_router(admin.router)


@app.get("/", tags=["Meta"])
async def root() -> dict:
    return {
        "service": "AI Health Assistant API",
        "version": "1.0.0",
        "docs": "/docs",
        "disclaimer": "General health information only. Not a diagnosis. Not a substitute for a doctor.",
    }


@app.get("/health", tags=["Meta"])
async def health() -> JSONResponse:
    db_ok = False
    try:
        from app.database import get_client

        db_ok = bool(get_client().is_connected())
    except Exception:  # noqa: BLE001
        db_ok = False

    return JSONResponse(
        {
            "status": "ok",
            "database": "connected" if db_ok else "disconnected",
            "groqConfigured": bool(settings.groq_api_key),
            "model": settings.groq_model,
        }
    )
