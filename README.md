# Milestone — Local-First Health & Performance Tracking App

A solo health and performance tracking app bridging clinical rehabilitation (post-op recovery) and athletic performance training. The core goal: **prevent over-exertion and injury by detecting "creeping cumulative load"** — activities that feel fine individually but trigger inflammation on Day 4 due to insufficient rest and accumulated volume.

## 🎯 MVP Features

- **Log Activities**: Track exercises with volume, duration, and perceived exertion (RPE 1-10)
- **Morning Check-ins**: Log next-day pain, readiness, and stiffness levels
- **Rolling Load Warnings**: See 3-day and 7-day cumulative load scores per activity
- **Delayed tax / load risk**: Proactive 7-day elevated-load and rest-debt flags; when you log pain or flare, attribute likely causes (return-after-rest vs earlier stacked load)
- **Recovery Rules**: Define personal thresholds (e.g., "no more than 3 consecutive walking days")
- **Mobile-First Design**: Built for phone-first usage with Capacitor readiness for iOS/Android

## 🛠 Tech Stack

- **Backend**: Python FastAPI + SQLModel + SQLite
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Database**: SQLite (local-first; easily migrates to Postgres)
- **Orchestration**: Docker Compose
- **Future**: Capacitor (native iOS/Android), OAuth2 integrations, MCP server for AI assistants

## 📋 Architecture

See [`plans/milestone-architecture.md`](plans/milestone-architecture.md) for the complete system design, including:
- Directory structure
- SQLModel schema
- API routes
- Load engine algorithm (rolling load + delayed tax detection)
- Implementation phases (8-day roadmap)
- Capacitor & MCP readiness notes

## 🚀 Quick Start

```bash
# One-time setup: copy env to repo root (Docker Compose reads ./.env)
cp backend/.env.example .env

# Start services with Docker Compose
docker compose up backend

# Backend: http://localhost:8084 (Swagger UI: /docs)
# Frontend: http://localhost:${FRONTEND_PORT:-5173} (set FRONTEND_PORT in repo-root .env)
```

Default backend port is **8084** (not 8000) to avoid clashing with other local apps. Change `BACKEND_PORT` in `.env` if needed.

## Backend setup (local, without Docker)

Run these from the `backend/` directory. The app reads config from the repo-root `.env` file; do **not** override `DATABASE_URL` on the command line — relative paths are resolved against the repo root by `app/settings.py`.

```bash
# One-time: create venv and install (if not already done)
python -m venv .venv
.venv/bin/pip install -e '.[dev]'

# One-time: env file at repo root
cp .env.example ../.env

# Create schema
.venv/bin/alembic upgrade head

# Load prototype seed data (safe to rerun)
.venv/bin/python -m scripts.seed

# Run API locally
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8084
```

Verify:

```bash
curl http://localhost:8084/api/health
open http://localhost:8084/docs
```

Quality gates from repo root:

```bash
make lint
make test
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./data/milestone.db` | SQLite path (resolved to repo-root `data/milestone.db`) |
| `APP_VERSION` | `0.1.0` | API version string |
| `BACKEND_PORT` | `8084` | Host/container port for uvicorn and Docker Compose |

**Port references to update when changing `BACKEND_PORT` or adding frontend:**

| File | Notes |
| --- | --- |
| `.env` / `backend/.env.example` | Source of truth for `BACKEND_PORT` |
| `docker-compose.yml` | Port mapping, uvicorn `--port`, healthcheck |
| `backend/Dockerfile` | `EXPOSE` and default `CMD` port |
| `backend/app/settings.py` | Shared settings export |
| `README.md` | Operator docs (this file) |
| `plans/milestone-architecture.md` | Architecture diagram and Vite proxy notes (still references `:8000` until frontend work) |
| `plans/TRD.md` | Technical requirements (still references `:8000` until synced) |
| `frontend/vite.config.ts` | Not present yet; set `/api` proxy target to `http://backend:8084` (or `${BACKEND_PORT}`) in Phase 6 |

Planning docs under `plans/` may still mention port 8000 from the original scaffold; runtime config and this README use **8084**.

## 📁 Project Structure

```
milestone-training-log/
├── backend/          # FastAPI + SQLModel
├── frontend/         # React + Vite SPA
├── plans/            # Architecture & implementation planning
└── docker-compose.yml
```

## 🔄 Development Workflow

1. Edit `backend/app/` or `frontend/src/` — hot reload enabled
2. Database changes: add migration to `backend/alembic/versions/`
3. Tests: `make test` from repo root, or `pytest app/tests/` from `backend/`

## 🎯 Core Entities

- **ActivityType**: User-defined exercises (e.g., "Walking", "Squats") with custom units
- **LogEntry**: A workout session — volume, duration, RPE, timestamp
- **DailyCheckIn**: Next-morning feedback — pain, readiness, stiffness, notes
- **RecoveryRule**: User-defined thresholds (max consecutive days, max weekly increase %, rolling load cap, RPE cap)

## 🧠 Load Engine

The app's smart core:
- **Rolling Load** = Σ(volume × RPE) over a time window (e.g., last 3 or 7 days)
- **Delayed Tax Detection** = correlates pain spikes with load spikes 24–72 hours prior
- **Rule Violations** = flags when recovery rules are breached

## 🔮 Future Work

- **Phase 2**: Authentication + multi-user support
- **Phase 3**: Strava/Google Health integrations
- **Phase 4**: MCP server for AI-powered threshold suggestions
- **Phase 5**: Capacitor native app wrapping

## 📖 Planning Status

✅ Architecture complete  
⏳ Initial scaffolding ready to implement  
📝 See `plans/milestone-architecture.md` for full implementation roadmap
