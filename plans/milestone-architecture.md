# Milestone — Local-First Health & Performance Tracking App

## Context

Post-op rehab user (bunion surgery) building a solo app to bridge clinical rehab and athletic performance. The core problem: "creeping cumulative load" — activities that feel fine individually but trigger inflammation on Day 4 due to accumulated volume without adequate rest. MVP must close the feedback loop: **log activity → log next-morning pain → see rolling load warnings and delayed correlation flags**.

**Stack:** Python FastAPI + SQLModel · SQLite · React + Vite (TypeScript) · Tailwind CSS · TanStack Query · Docker Compose  
**Constraints:** Single user (Phase 1), Capacitor-native target (so SPA only, no SSR, relative API paths), MCP-ready endpoint from day one.

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│               Docker Compose                     │
│                                                  │
│  ┌──────────────┐      ┌────────────────────┐   │
│  │  Frontend    │─────▶│     Backend        │   │
│  │  React+Vite  │ /api │  FastAPI :8000     │   │
│  │  :5173       │      │                    │   │
│  │  (SPA)       │      │  ┌──────────────┐  │   │
│  └──────────────┘      │  │ Load Engine  │  │   │
│                        │  │  Service     │  │   │
│                        │  └──────┬───────┘  │   │
│                        │         │          │   │
│                        │  ┌──────▼───────┐  │   │
│                        │  │  SQLite DB   │  │   │
│                        │  │ (volume mnt) │  │   │
│                        │  └──────────────┘  │   │
│                        └────────────────────┘   │
└─────────────────────────────────────────────────┘
         │ future: Capacitor wraps dist/
         │         VITE_API_BASE_URL → remote/local backend
```

**Key architectural decisions:**
- Vite proxy (`/api → backend:8000`) means all API calls use relative paths — zero code changes needed for Capacitor
- `USER_ID = "local"` constant in all routers; replace with `Depends(get_current_user_id)` for multi-user later
- `load_engine.py` is a pure service module (no FastAPI deps) — callable from MCP tool handlers directly
- SQLite → Postgres migration: SQLModel supports both, single `DATABASE_URL` env var change

---

## Directory Structure

```
milestone-training-log/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt            # fastapi, sqlmodel, uvicorn, alembic, pytest, httpx
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/0001_initial.py
│   └── app/
│       ├── main.py                 # FastAPI app factory + lifespan
│       ├── config.py               # pydantic-settings
│       ├── database.py             # engine, get_session, create_db_and_tables
│       ├── models/
│       │   ├── activity_type.py
│       │   ├── log_entry.py
│       │   ├── daily_check_in.py
│       │   └── recovery_rule.py
│       ├── schemas/                # Pydantic Create/Update/Read shapes
│       │   ├── activity_type.py
│       │   ├── log_entry.py
│       │   ├── daily_check_in.py
│       │   ├── recovery_rule.py
│       │   └── load.py             # LoadSummary, DelayedTaxResult, MCPContext
│       ├── routers/
│       │   ├── activity_types.py
│       │   ├── log_entries.py
│       │   ├── daily_check_ins.py
│       │   ├── recovery_rules.py
│       │   ├── load.py
│       │   └── mcp.py
│       ├── services/
│       │   └── load_engine.py      # ALL calculation logic isolated here
│       └── tests/
│           ├── conftest.py
│           ├── test_load_engine.py
│           └── test_routes.py
└── frontend/
    ├── Dockerfile
    ├── package.json                # react, vite, typescript, tailwind, tanstack-query, react-router-dom
    ├── vite.config.ts              # proxy: /api → backend:8000
    ├── capacitor.config.ts         # stub: webDir="dist", server.url for dev-on-device
    └── src/
        ├── App.tsx                 # Router + QueryClientProvider
        ├── api/
        │   └── client.ts           # base URL from VITE_API_BASE_URL || ''
        ├── hooks/                  # TanStack Query wrappers per entity
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── LogActivity.tsx
        │   ├── MorningCheckIn.tsx
        │   ├── ActivityManager.tsx
        │   └── Settings.tsx        # recovery rules
        ├── components/
        │   ├── layout/BottomTabBar.tsx
        │   ├── dashboard/          # LoadCard, WarningBanner, DelayedTaxAlert
        │   ├── forms/              # LogEntryForm, CheckInForm, ActivityTypeForm
        │   └── ui/                 # Slider (RPE/pain input), LoadGauge, Badge
        └── types/index.ts          # mirrors backend schemas as TS types
```

---

## Database Schema (SQLModel)

```python
# models/activity_type.py
class ActivityType(SQLModel, table=True):
    __tablename__ = "activity_types"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(default="local", index=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    default_unit: str = "reps"          # reps | sets | minutes | miles | custom
    custom_unit_label: Optional[str] = None
    category: str = "rehab"             # rehab | cardio | strength | mobility
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)

# models/log_entry.py
class LogEntry(SQLModel, table=True):
    __tablename__ = "log_entries"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(default="local", index=True)
    activity_type_id: int = Field(foreign_key="activity_types.id", index=True)
    logged_at: datetime = Field(default_factory=utcnow, index=True)   # indexed: frequent date range queries
    duration_minutes: Optional[float] = None
    volume_value: float                 # 20 reps, 1.5 miles, etc.
    volume_unit: Optional[str] = None   # overrides activity_type.default_unit
    rpe: int = Field(ge=1, le=10)       # Rate of Perceived Exertion — REQUIRED
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)

# models/daily_check_in.py
class DailyCheckIn(SQLModel, table=True):
    __tablename__ = "daily_check_ins"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(default="local", index=True)
    check_in_date: date = Field(index=True)  # UniqueConstraint(user_id, check_in_date) in migration
    pain_level: int = Field(ge=0, le=10)
    readiness_level: int = Field(ge=0, le=10)
    stiffness_level: int = Field(ge=0, le=10)
    notes: Optional[str] = None
    tags: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)

# models/recovery_rule.py
class RecoveryRule(SQLModel, table=True):
    __tablename__ = "recovery_rules"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(default="local", index=True)
    name: str
    activity_type_id: Optional[int] = Field(default=None, foreign_key="activity_types.id")
    # rule_type: max_consecutive_days | max_weekly_increase_pct | max_rolling_load | max_rpe
    rule_type: str
    threshold_value: float
    window_days: int = 7
    enabled: bool = True
    created_at: datetime = Field(default_factory=utcnow)
```

---

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/activity-types` | List / create activity types |
| GET/PATCH/DELETE | `/api/activity-types/{id}` | Read / update / soft-delete |
| GET/POST | `/api/log-entries` | List (filterable by date, activity) / create |
| GET/PATCH/DELETE | `/api/log-entries/{id}` | Read / update / delete |
| GET/POST | `/api/daily-check-ins` | List / create (upsert by date) |
| GET | `/api/daily-check-ins/today` | Shortcut for today's check-in |
| GET/PATCH | `/api/daily-check-ins/{date}` | Read / update by date |
| GET/POST | `/api/recovery-rules` | List / create rules |
| PATCH/DELETE | `/api/recovery-rules/{id}` | Update / delete rules |
| GET | `/api/load/summary?as_of=` | Rolling load + violations + risk level |
| GET | `/api/load/delayed-tax?check_in_date=` | Delayed inflammation correlation |
| GET | `/api/mcp/context` | Structured AI-readable summary |

---

## Load Engine (core logic in `services/load_engine.py`)

**Load score formula:** `Σ(volume_value × rpe)` for all entries in a time window. Unit-agnostic by design; recovery rules constrain comparisons to same activity type.

**Rolling load (`compute_rolling_load`):**
- Query `log_entries` where `logged_at` in `[as_of - window_days, as_of]`
- Return total load score + raw entries (for avg RPE)

**Rule violation checks (`check_rule_violations`):**
- `max_rolling_load`: compute_rolling_load vs threshold
- `max_consecutive_days`: walk backwards from `as_of`, count days with ≥1 entry
- `max_weekly_increase_pct`: compare this 7-day window vs prior 7-day window
- `max_rpe`: check today's entries vs cap

**Delayed Tax (`detect_delayed_tax`):**
```
1. Find check-ins where pain_level > threshold (default 5)
2. For that check-in's date, look back 24-72h for log entries (excludes same-day)
3. Compute daily load scores in that window
4. Compare peak daily load to 14-day baseline (the 14 days before the lookback window)
5. Correlation strength: high if peak > 2.0× baseline, medium if > 1.4×
```
The lookback window deliberately excludes the check-in date itself — the physiological delay is 24-72h, not same-day.

**Overall risk:** `red` if any `danger` violation, `yellow` if any `warning`, `green` otherwise.

---

## Docker Compose

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - ./backend:/app          # hot reload
      - milestone_db:/app/data  # SQLite persistence
    environment:
      DATABASE_URL: sqlite:////app/data/milestone.db
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    volumes:
      - ./frontend/src:/app/src
      - /app/node_modules       # prevent host override
    command: npm run dev -- --host 0.0.0.0
    depends_on: [backend]

volumes:
  milestone_db:
```

---

## Implementation Phases

### Phase 0 — Skeleton (Day 1)
- `docker-compose.yml`, both Dockerfiles, `requirements.txt`, `package.json`
- Backend: `GET /health` → `{"status": "ok"}`
- Frontend: `<h1>Milestone</h1>` in App.tsx
- **Verify:** `docker compose up` → both services respond

### Phase 1 — Database (Day 1-2)
- All 4 SQLModel model files
- `database.py` with `create_engine`, `get_session`, `create_db_and_tables()`
- Alembic init + `0001_initial.py` migration (include `UniqueConstraint` on `daily_check_ins`)
- **Verify:** `alembic upgrade head` creates tables; inspect with `sqlite3`

### Phase 2 — CRUD API (Day 2-3)
- Pydantic `Create`/`Update`/`Read` schemas for all 4 entities
- All 4 routers with full CRUD
- `tests/conftest.py` with in-memory SQLite fixture
- `tests/test_routes.py`: happy path + edge cases (duplicate check-in date, RPE out of range, bad FK)
- Seed script: 10 default activity types + 14 days of sample data
- **Verify:** Swagger UI at `localhost:8000/docs` shows all routes; pytest passes

### Phase 3 — Load Engine (Day 3-4)
- Implement all functions in `services/load_engine.py`
- Wire `routers/load.py` and `routers/mcp.py` to service layer
- `tests/test_load_engine.py`:
  - 3 days escalating load → `max_rolling_load` violation
  - High load → pain spike 48h later → `correlation_strength = "high"`
  - No entries → green, no violations
- **Verify:** `GET /api/load/summary` returns correct risk with seed data

### Phase 4 — Frontend Core (Day 4-6)
- React Router v6 + `BottomTabBar` (Dashboard | Log | Check-in | Settings)
- `api/client.ts` with base URL from env (`VITE_API_BASE_URL || ''`)
- TanStack Query hooks for all entities
- **Dashboard.tsx:** `LoadCard` per activity (3-day/7-day scores, color-coded), `WarningBanner`, `DelayedTaxAlert`
- **LogActivity.tsx:** activity dropdown, volume + unit, RPE slider (labeled 1-10), notes
- **MorningCheckIn.tsx:** 3 sliders (pain/readiness/stiffness), tag multi-select, upsert behavior
- **Verify:** Full log → check-in → dashboard flow working on 375px Chrome viewport

### Phase 5 — Activity Manager + Settings (Day 6-7)
- `ActivityManager.tsx`: list + create + edit + soft-delete activities
- `Settings.tsx`: list + create + toggle/delete recovery rules
- Modal sheets for forms (mobile UX)
- **Verify:** Create a new activity → log it → see it appear in load summary

### Phase 6 — Polish + MCP Stub (Day 7-8)
- `MCPContextResponse` schema + `/api/mcp/context` endpoint (aggregates: 7-day check-ins, load summary, violations, last 20 entries, all activity types)
- Loading skeletons + error boundaries on all pages
- Toast notifications for form submissions
- `capacitor.config.ts` stub with `webDir: "dist"`, `server.url: "http://localhost:8000"` for future on-device dev
- **Verify:** `GET /api/mcp/context` returns complete structured JSON; test paste into Claude chat

---

## Verification Plan (End-to-End)

1. `docker compose up` — both services start, no errors
2. Open `localhost:5173` on mobile viewport (375px)
3. Create activity type "Walking" (category: rehab, unit: miles)
4. Log 3 walks over 3 days with escalating RPE (e.g. 4, 6, 8)
5. Log morning check-in with pain_level = 7
6. Dashboard should show: 3-day load warning (yellow/red) + Delayed Tax alert pointing to the Day 2-3 entries
7. Create recovery rule "Max 3 consecutive walking days" → verify it fires
8. Hit `GET /api/mcp/context` → confirm structured summary includes all the above

---

## Future-Proofing Notes

- **Multi-user/auth:** Replace `USER_ID = "local"` with `Depends(get_current_user_id)` in each router. Schema already has `user_id` on all tables. Zero data migration.
- **Strava/Google Health:** Add `external_integrations` table with `provider`, `access_token`, `refresh_token`, `last_sync`. Add webhook receiver routes. Activity types gain an `external_id` field.
- **MCP server:** `load_engine.py` has no FastAPI deps — call it directly from MCP tool handlers. Add `fastapi-mcp` or implement the protocol's `list_tools`/`call_tool` manifest on top of the existing `/api/mcp/context` foundation.
- **Postgres migration:** Change `DATABASE_URL` to `postgresql://...`, run `alembic upgrade head`. SQLModel handles both dialects. The `JSON` column type on `tags` becomes native JSONB automatically.
