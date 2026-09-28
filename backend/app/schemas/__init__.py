"""Pydantic request/response schemas."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------- auth
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    fullName: str = Field(min_length=2, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    fullName: str
    role: str
    isActive: bool = True
    createdAt: Any | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ------------------------------------------------------- health profile
class HealthProfileIn(BaseModel):
    age: int | None = Field(default=None, ge=0, le=130)
    gender: str | None = None
    heightCm: float | None = Field(default=None, ge=0, le=300)
    weightKg: float | None = Field(default=None, ge=0, le=500)
    bloodGroup: str | None = None
    allergies: list[str] = []
    conditions: list[str] = []
    medications: list[str] = []
    activityLevel: Literal["sedentary", "light", "moderate", "active", "very_active"] | None = "moderate"


class HealthProfileOut(HealthProfileIn):
    id: str
    userId: str


# ----------------------------------------------------------- chat
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversationId: str | None = None


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    flagged: bool = False
    createdAt: Any | None = None


class ConversationOut(BaseModel):
    id: str
    title: str
    createdAt: Any | None = None
    updatedAt: Any | None = None
    messageCount: int = 0
    preview: str | None = None


class ChatResponse(BaseModel):
    conversationId: str
    userMessage: MessageOut
    assistantMessage: MessageOut
    redFlag: dict[str, Any]


# ------------------------------------------------------- symptom checker
class SymptomCheckRequest(BaseModel):
    symptoms: list[str] = Field(min_length=1)
    duration: str | None = None
    severity: Literal["mild", "moderate", "severe"] | None = None
    notes: str | None = None


class SymptomCheckOut(BaseModel):
    id: str
    symptoms: list[str]
    duration: str | None = None
    severity: str | None = None
    possibleCauses: list[str] = []
    selfCare: list[str] = []
    whenToSeeDoctor: str | None = None
    urgency: str = "routine"
    redFlag: bool = False
    summary: str | None = None
    createdAt: Any | None = None


# ----------------------------------------------------------- wellness
class WellnessLogIn(BaseModel):
    logDate: str | None = None  # YYYY-MM-DD, defaults to today
    waterGlasses: int | None = Field(default=None, ge=0, le=50)
    sleepHours: float | None = Field(default=None, ge=0, le=24)
    steps: int | None = Field(default=None, ge=0, le=200000)
    exerciseMinutes: int | None = Field(default=None, ge=0, le=1440)
    mood: Literal["great", "good", "okay", "low", "bad"] | None = None
    weightKg: float | None = Field(default=None, ge=0, le=500)
    note: str | None = None


class WellnessLogOut(WellnessLogIn):
    id: str
    logDate: str


class WellnessSummary(BaseModel):
    range: str
    totals: dict[str, float]
    averages: dict[str, float]
    series: list[dict[str, Any]]
    logCount: int


# -------------------------------------------------------------- goals
class GoalIn(BaseModel):
    type: Literal["water", "sleep", "steps", "exercise", "weight", "mood", "custom"] = "custom"
    title: str = Field(min_length=1, max_length=120)
    target: float = Field(gt=0)
    unit: str = ""
    frequency: Literal["daily", "weekly"] = "daily"


class GoalOut(GoalIn):
    id: str
    progress: float = 0
    streak: int = 0
    isActive: bool = True


class GoalProgressIn(BaseModel):
    progress: float = Field(ge=0)


# ---------------------------------------------------------- reminders
class ReminderIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    type: str = "custom"
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    frequency: Literal["daily", "weekly"] = "daily"
    days: list[str] = []
    isActive: bool = True


class ReminderOut(ReminderIn):
    id: str
    lastTriggeredAt: Any | None = None


# -------------------------------------------------------------- admin
class AdminStats(BaseModel):
    totalUsers: int
    activeUsers: int
    totalConversations: int
    totalMessages: int
    totalSymptomChecks: int
    flaggedChats: int
    topTopics: list[dict[str, Any]]
    dailyChats: list[dict[str, Any]]
    userGrowth: list[dict[str, Any]]


class AdminSettingsIn(BaseModel):
    value: Any
