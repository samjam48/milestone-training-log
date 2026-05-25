# Milestone — Local-First Health & Performance Tracking App

A solo health and performance tracking app bridging clinical rehabilitation (post-op recovery) and athletic performance training. The core goal: **prevent over-exertion and injury by detecting "creeping cumulative load"** — activities that feel fine individually but trigger inflammation on Day 4 due to insufficient rest and accumulated volume.

## 🎯 MVP Features

- **Log Activities**: Track exercises with volume, duration, and perceived exertion (RPE 1-10)
- **Morning Check-ins**: Log next-day pain, readiness, and stiffness levels
- **Rolling Load Warnings**: See 3-day and 7-day cumulative load scores per activity
- **Delayed Tax Correlation**: Detect when today's pain correlates to activity spikes 24–72 hours prior
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
# Start services with Docker Compose
docker compose up

# Backend: http://localhost:8000 (Swagger UI: /docs)
# Frontend: http://localhost:5173
```

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
3. Tests: `pytest backend/app/tests/` (in container or locally)

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
