"""Module 4 - Symptom Checker + Module 5 red-flag alert."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Response

from app.database import get_client
from app.dependencies import get_current_user
from app.schemas import SymptomCheckOut, SymptomCheckRequest
from app.services import groq_service
from app.services.safety import check_red_flags
from app.utils.helpers import clean_list, to_dict

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/symptoms", tags=["Symptom Checker"])

GUIDED_QUESTIONS = [
    {"id": "symptoms", "question": "What symptoms are you experiencing?", "type": "multi"},
    {"id": "duration", "question": "How long have you had these symptoms?", "type": "text"},
    {
        "id": "severity",
        "question": "How severe are they?",
        "type": "choice",
        "options": ["mild", "moderate", "severe"],
    },
    {"id": "notes", "question": "Anything else we should know? (optional)", "type": "text"},
]


@router.get("/questions")
async def questions() -> dict:
    return {"questions": GUIDED_QUESTIONS}


@router.post("/check", response_model=SymptomCheckOut)
async def run_check(
    payload: SymptomCheckRequest, user: dict = Depends(get_current_user)
) -> SymptomCheckOut:
    db = get_client()
    symptoms = clean_list(payload.symptoms)
    if not symptoms:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one symptom is required")

    combined = " ".join([*symptoms, payload.duration or "", payload.notes or ""])
    red_flag = check_red_flags(combined)

    profile = await db.healthprofile.find_unique(where={"userId": user["id"]})
    profile_data = to_dict(profile) if profile else None

    analysis: dict = {}
    try:
        analysis = groq_service.symptom_analysis(
            symptoms=symptoms,
            duration=payload.duration,
            severity=payload.severity,
            extra_notes=payload.notes,
            profile=profile_data,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Groq symptom analysis failed: %s", exc)
        analysis = {
            "possible_causes": [],
            "self_care": [],
            "when_to_see_doctor": "Please consult a doctor to discuss these symptoms.",
            "urgency": "soon",
            "summary": "The AI analysis is temporarily unavailable. Please consult a doctor.",
        }

    urgency = analysis.get("urgency", "routine")
    if red_flag.triggered and urgency not in ("urgent", "emergency"):
        urgency = "urgent"

    record = await db.symptomcheck.create(
        data={
            "userId": user["id"],
            "symptoms": symptoms,
            "duration": payload.duration,
            "severity": payload.severity,
            "answers": json.dumps(payload.model_dump(), default=str),
            "possibleCauses": analysis.get("possible_causes", []),
            "selfCare": analysis.get("self_care", []),
            "whenToSeeDoctor": analysis.get("when_to_see_doctor", ""),
            "urgency": urgency,
            "redFlag": red_flag.triggered,
            "summary": analysis.get("summary", ""),
        }
    )

    if red_flag.triggered:
        await db.flaggedchat.create(
            data={
                "userId": user["id"],
                "content": combined[:1000],
                "matchedRules": red_flag.matched,
                "severity": red_flag.severity,
                "source": "symptom_check",
            }
        )

    data = to_dict(record)
    return SymptomCheckOut(
        id=data["id"],
        symptoms=data.get("symptoms", []),
        duration=data.get("duration"),
        severity=data.get("severity"),
        possibleCauses=data.get("possibleCauses", []),
        selfCare=data.get("selfCare", []),
        whenToSeeDoctor=data.get("whenToSeeDoctor"),
        urgency=data.get("urgency", "routine"),
        redFlag=data.get("redFlag", False),
        summary=data.get("summary"),
        createdAt=data.get("createdAt"),
    )


@router.get("/history", response_model=list[SymptomCheckOut])
async def history(user: dict = Depends(get_current_user)) -> list[SymptomCheckOut]:
    db = get_client()
    records = await db.symptomcheck.find_many(
        where={"userId": user["id"]}, order={"createdAt": "desc"}
    )
    out: list[SymptomCheckOut] = []
    for record in records:
        data = to_dict(record)
        out.append(
            SymptomCheckOut(
                id=data["id"],
                symptoms=data.get("symptoms", []),
                duration=data.get("duration"),
                severity=data.get("severity"),
                possibleCauses=data.get("possibleCauses", []),
                selfCare=data.get("selfCare", []),
                whenToSeeDoctor=data.get("whenToSeeDoctor"),
                urgency=data.get("urgency", "routine"),
                redFlag=data.get("redFlag", False),
                summary=data.get("summary"),
                createdAt=data.get("createdAt"),
            )
        )
    return out


@router.delete("/history/{check_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_check(check_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    record = await db.symptomcheck.find_unique(where={"id": check_id})
    if record is None or record.userId != user["id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Symptom check not found")
    await db.symptomcheck.delete(where={"id": check_id})


@router.get("/emergency-info")
async def emergency_info() -> dict:
    from app.services.safety import EMERGENCY_NUMBERS

    return {
        "numbers": EMERGENCY_NUMBERS,
        "message": (
            "If you or someone else has a life-threatening symptom, call your local "
            "emergency number immediately. Do not wait for an online answer."
        ),
    }
