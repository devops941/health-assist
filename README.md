# AI Health Assistant

Health questions, symptom checking and day-to-day wellness management in one web app.
A user chats with a Groq-powered AI assistant, runs a guided symptom check, and tracks
water, sleep, steps, exercise, mood and weight. A rule-based safety layer detects
emergency warning signs (for example chest pain or breathing trouble) and shows urgent-care
advice with local emergency numbers.

> **Disclaimer:** this app provides general health information only. It does not diagnose
> conditions and is not a substitute for a doctor. In an emergency, contact local emergency
> services immediately.

## Architecture

Three tiers, with the AI key kept strictly on the server:

```
Next.js (frontend)  ──REST──▶  FastAPI (backend)  ──▶  MongoDB (Prisma)
                                      │
                                      └──▶  Groq API (LLM, streaming)
```

The browser only ever calls the Next.js server, which proxies `/api/*` to FastAPI. The Groq
API key and MongoDB credentials live in the backend environment and never reach the frontend.

## Project layout

Exactly two source folders, as required by the specification:

```
project/
├── frontend/   Next.js 15 (App Router) + TypeScript + Tailwind UI components
└── backend/    FastAPI + Prisma (MongoDB) + Groq service + red-flag safety
```

## Modules

| # | Module | Where |
|---|--------|-------|
| 1 | Login & authentication (JWT, bcrypt, role-based access) | `backend/app/routers/auth.py` |
| 2 | Health profile (age, allergies, conditions, medicines) | `backend/app/routers/profile.py` |
| 3 | Health Q&A chatbot (Groq, streaming, conversation memory) | `backend/app/routers/chat.py` |
| 4 | Symptom checker (guided questions, AI summary) | `backend/app/routers/symptoms.py` |
| 5 | Red-flag & emergency alert (rule-based) | `backend/app/services/safety.py` |
| 6 | Wellness tracker (logs, daily/weekly charts) | `backend/app/routers/wellness.py` |
| 7 | Goals & reminders (targets, streaks) | `backend/app/routers/goals.py` |
| 8 | Personalised wellness tips (AI) | `backend/app/routers/wellness.py` (`/tips`) |
| 9 | Chat & symptom history (search, review, delete) | `backend/app/routers/chat.py`, `symptoms.py` |
| 10 | Admin dashboard & CSV reports | `backend/app/routers/admin.py` |

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- A MongoDB Atlas cluster (or any MongoDB instance)
- A Groq API key

## Backend setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then fill in DATABASE_URL and GROQ_API_KEY
npm install                 # Prisma CLI + client
npm run prisma:generate     # generate the Prisma client into prisma_client/
python -m app.seed          # create the admin and demo users

uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Environment variables (`backend/.env`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MongoDB connection string used by Prisma |
| `GROQ_API_KEY` | Groq API key (backend only) |
| `GROQ_MODEL` | Groq model id (default `openai/gpt-oss-120b`) |
| `JWT_SECRET` | Signing secret for access tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (default 1440) |
| `FRONTEND_ORIGINS` | Comma-separated CORS allow-list |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seeded admin account |

Interactive API docs are served at `http://127.0.0.1:8000/docs`.

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local   # BACKEND_URL, defaults to http://127.0.0.1:8000
npm run dev                  # http://localhost:3000
```

## Seeded accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@healthassistant.ai` | `Admin@12345` |
| User | `demo@healthassistant.ai` | `Demo@12345` |

Change these before any real deployment.

## API overview

All endpoints are under `/api` and require a `Bearer` token except register/login.

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Profile | `GET /api/profile`, `PUT /api/profile` |
| Chat | `POST /api/chat`, `POST /api/chat/stream` (SSE), `GET /api/chat/conversations`, `GET /api/chat/conversations/{id}`, `DELETE /api/chat/conversations/{id}`, `GET /api/chat/search` |
| Symptoms | `GET /api/symptoms/questions`, `POST /api/symptoms/check`, `GET /api/symptoms/history`, `DELETE /api/symptoms/history/{id}`, `GET /api/symptoms/emergency-info` |
| Wellness | `GET /api/wellness/logs`, `POST /api/wellness/logs`, `DELETE /api/wellness/logs/{id}`, `GET /api/wellness/summary`, `GET /api/wellness/tips` |
| Goals | `GET /api/goals`, `POST /api/goals`, `PUT /api/goals/{id}/progress`, `DELETE /api/goals/{id}` |
| Reminders | `GET /api/reminders`, `POST /api/reminders`, `PUT /api/reminders/{id}`, `DELETE /api/reminders/{id}` |
| Admin | `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/{id}/status`, `GET /api/admin/flagged`, `PATCH /api/admin/flagged/{id}/review`, `GET/PUT /api/admin/settings`, `GET /api/admin/reports/summary.csv`, `GET /api/admin/reports/flagged.csv` |

The chat stream emits Server-Sent Events: a `meta` event (conversation id, safety flags),
then `token` events, then a final `done` event.

## Safety design

- Red-flag keyword rules run **before** the AI call, so urgent symptoms never depend on the model.
- Every AI reply carries a "not medical advice" disclaimer.
- Flagged content is recorded for admin review and surfaced in the admin dashboard.
- JWT auth and role checks gate all user and admin routes.

## Deployment

- **Frontend:** deploy `frontend/` to Vercel and set `BACKEND_URL` to the deployed API origin.
- **Backend:** run `uvicorn app.main:app` (or Gunicorn with Uvicorn workers) on Render,
  Railway or AWS, with `DATABASE_URL` and `GROQ_API_KEY` set as environment secrets.
- **Database:** MongoDB Atlas.
