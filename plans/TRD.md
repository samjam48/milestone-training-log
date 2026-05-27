# Milestone — Technical Requirements Document
*Draft: May 2026 | Owner: Sam*

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Docker Compose                                                   │
│                                                                  │
│  ┌──────────────────────┐       ┌──────────────────────────────┐│
│  │  Frontend             │       │  Backend                     ││
│  │  React 18 + Vite 5    │──────▶│  FastAPI + SQLModel          ││
│  │  :5173                │  /api │  :8000                       ││
│  └──────────────────────┘       └──────────────┬───────────────┘│
│                                                │                 │
│                                   ┌────────────▼────────────┐   │
│                                   │  SQLite                  │   │
│                                   │  data/milestone.db       │   │
│                                   └─────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Vite proxy:** `"/api" → "http://backend:8000"` — all frontend API calls use
relative `/api/...` paths. No CORS config needed in dev. Capacitor-ready: the
same relative paths work when the built `dist/` is wrapped natively.

## 2. Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI 0.115+ |
| ORM + models | SQLModel 0.0.21+ |
| Migrations | Alembic |
| Database | SQLite (local-first; env-swap to Postgres when needed) |
| Validation | Pydantic v2 (bundled with SQLModel) |
| Backend tests | pytest + httpx AsyncClient |
| Backend lint | ruff + mypy --strict |
| Frontend framework | React 18 + Vite 5 |
| Frontend language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 3.4 (custom token theme from `export/tailwind.config.js`) |
| HTTP client | `fetch` wrapped in typed API client module |
| Async state | TanStack Query v5 (React Query) |
| Frontend tests | Vitest + Testing Library |

## 3. Repository Layout

```
milestone-training-log/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app factory, lifespan, router registration
│   │   ├── settings.py          # Shared config — reads .env, single import point
│   │   ├── database.py          # SQLite engine + get_session dependency
│   │   ├── models/              # SQLModel table classes, one file per entity group
│   │   │   ├── activity.py      # ActivityClass, Activity
│   │   │   ├── log.py           # ActivityLog
│   │   │   ├── checkin.py       # DailyCheckIn, FlareUpIncident
│   │   │   ├── block.py         # TrainingBlock, Rule, WeeklyTarget, RecoveryTarget
│   │   │   └── goal.py          # Goal
│   │   ├── schemas/             # Pydantic request/response DTOs (separate from models)
│   │   ├── routers/             # Thin HTTP routers — translate HTTP only, no logic
│   │   ├── services/            # All business logic lives here
│   │   │   ├── load_engine.py   # Python port of export/src/lib/engine.ts
│   │   │   └── dashboard.py     # Aggregate dashboard composer
│   │   └── tests/
│   ├── alembic/
│   ├── alembic.ini
│   ├── scripts/
│   │   └── seed.py              # Populates Sam Chen / plantar fasciitis scenario
│   ├── pyproject.toml
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts           # Typed fetch wrappers — new in Phase 6
│   │   │   ├── engine.ts        # Unchanged from export/src/lib/engine.ts
│   │   │   ├── load.ts          # Unchanged from export/src/lib/load.ts
│   │   │   └── cn.ts            # Unchanged from export/src/lib/cn.ts
│   │   ├── hooks/
│   │   │   └── useMilestoneEngine.ts  # Rewired in Phase 6 (same interface)
│   │   ├── components/
│   │   │   ├── ui/              # Unchanged from export/src/components/ui/
│   │   │   ├── composites/      # Unchanged from export/src/components/composites/
│   │   │   └── screens/         # Unchanged from export/ + 3 new screens in Phase 7
│   │   ├── types.ts             # Unchanged from export/src/types.ts
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js       # From export/tailwind.config.js
│   ├── vite.config.ts           # Includes /api proxy to backend:8000
│   └── tsconfig.json            # strict: true
├── docker-compose.yml
├── Makefile                     # make dev | make test | make lint
├── data/                        # gitignored — SQLite DB lives here
└── export/                      # Frozen prototype snapshot (read-only reference)
    ├── src/                     # Source of truth for copy-into-frontend
    └── preview/                 # JSX prototypes for Phase 7 screens (owner adds)
```

## 4. Database Schema

Full field-level spec: `docs/database-schema.md`.
Canonical type shapes: `export/src/types.ts` (supersedes `plans/milestone-architecture.md`).

**10 tables:** activity_classes, activities, activity_logs, daily_check_ins,
flare_up_incidents, training_blocks, rules, recovery_targets, weekly_targets, goals.

**user_id convention:** `user_id TEXT NOT NULL DEFAULT 'local'` on all user-owned
rows. Phase 1 is single-user; the field exists so multi-user auth migration
requires only one new column (a real UUID/auth sub) and one middleware layer —
no schema restructuring.

**ID convention:** Use opaque string IDs (`TEXT` in SQLite) so backend records
map cleanly to `export/src/types.ts` and seed data without translation.

**Child-table ownership:** `rules`, `weekly_targets`, and `recovery_targets`
inherit ownership through `training_blocks`; they do not carry their own
`user_id` column in Phase 1.

**flare_up_incidents → activity_classes:** Single nullable FK `activity_class_id`
on `flare_up_incidents`. User picks one likely cause class. If multi-class cause
attribution is needed later, add a join table then (BACKLOG item).

**flare-up persistence:** Detailed flare-up records are stored relationally in
`flare_up_incidents`, optionally linked back to `daily_check_ins` through
`daily_check_in_id`. Daily check-in API responses may compose the frontend's
embedded `flareUp` object from that related row rather than storing duplicate
JSON as the database source of truth.

**Field set locked for Phase 1:** Include `activities.default_volume_unit`,
`activity_logs.rule_violations_at_log`, `weekly_targets.target_unit`, and
`goals.progress_value` / `progress_target` / `progress_unit` in the initial
schema.

**Relationship summary:**
- `goals` ← `training_blocks` (each block optionally references one goal)
- `training_blocks` owns `rules`, `weekly_targets`, `recovery_targets`
- `activity_classes` owns `activities`
- `activities` owns `activity_logs`
- `daily_check_ins` ← `flare_up_incidents` (optional FK for check-in-sourced incidents)

## 5. API Contract

Full contract: `docs/api-map.md`.

**Conventions:**
- Base path: `/api`
- Dates: `YYYY-MM-DD` strings; timestamps: ISO 8601
- All business logic in services; routers translate HTTP only
- Single-user Phase 1: no auth header required; `user_id` resolved to `"local"` server-side

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/activity-classes` | List all classes |
| POST | `/api/activity-classes` | Create class |
| PATCH | `/api/activity-classes/{id}` | Update class |
| GET | `/api/activities` | List; filter: `?class_id=`, `?is_active=` |
| POST | `/api/activities` | Create activity |
| PATCH | `/api/activities/{id}` | Update (deactivate, rename, unit) |
| GET | `/api/activity-logs` | List; filter: `?from=`, `?to=`, `?activity_id=`, `?class_id=` |
| POST | `/api/activity-logs` | Create log (violations snapshot written at this point) |
| PATCH | `/api/activity-logs/{id}` | Update log |
| DELETE | `/api/activity-logs/{id}` | Delete log |
| GET | `/api/daily-check-ins` | List check-ins |
| POST | `/api/daily-check-ins` | Create/upsert for (user_id, check_in_date); may also create or update a linked flare-up incident |
| GET | `/api/daily-check-ins/today` | Fast path for today |
| GET | `/api/daily-check-ins/{date}` | Check-in for specific date |
| PATCH | `/api/daily-check-ins/{date}` | Update check-in; response may include an embedded `flareUp` object composed from relational incident data |
| GET | `/api/flare-up-incidents` | List incidents |
| POST | `/api/flare-up-incidents` | Create incident (severity `0..10`, single optional likely-cause class) |
| PATCH | `/api/flare-up-incidents/{id}` | Update incident |
| GET | `/api/training-blocks` | List all blocks |
| GET | `/api/training-blocks/active` | Get the single active block |
| POST | `/api/training-blocks` | Create block (service enforces one active at a time) |
| PATCH | `/api/training-blocks/{id}` | Update (name, dates, status) |
| GET | `/api/training-blocks/{id}/rules` | List rules for block |
| POST | `/api/training-blocks/{id}/rules` | Create rule |
| PATCH | `/api/rules/{id}` | Update rule |
| DELETE | `/api/rules/{id}` | Delete rule |
| GET | `/api/training-blocks/{id}/weekly-targets` | List weekly targets |
| POST | `/api/training-blocks/{id}/weekly-targets` | Create weekly target |
| PATCH | `/api/weekly-targets/{id}` | Update weekly target |
| GET | `/api/training-blocks/{id}/recovery-targets` | List recovery targets |
| POST | `/api/training-blocks/{id}/recovery-targets` | Create recovery target |
| GET | `/api/goals` | List; filter: `?status=`, `?timeframe=` |
| POST | `/api/goals` | Create goal |
| PATCH | `/api/goals/{id}` | Update goal (status, progress) |
| GET | `/api/load/summary` | Class statuses + suggestions + weekly progress for today |
| POST | `/api/load/check-violations` | Dry-run violations check — no write |
| GET | `/api/load/delayed-tax` | 14-day pain correlation analysis |
| GET | `/api/dashboard` | Full aggregate matching `MilestoneEngineResult` interface |

## 6. Load Engine

`export/src/lib/engine.ts` and `export/src/lib/load.ts` are the canonical
algorithm references. The backend replicates them exactly in
`backend/app/services/load_engine.py`.

**Python ↔ TypeScript function pairs:**

| Python (load_engine.py) | TypeScript (engine.ts / load.ts) |
|---|---|
| `rolling_load(logs, as_of, window_days) → float` | `rollingLoad` in load.ts |
| `compute_class_statuses(as_of, classes, activities, logs, rules)` | `computeClassStatuses` |
| `check_violations(activity_id, volume, rpe, logs, rules, as_of)` | `checkViolations` in useMilestoneEngine.ts |
| `compute_daily_safety_scores(start, end, logs, check_ins, incidents)` | `computeDailySafetyScores` |
| `compute_suggestions(class_statuses, activities, classes)` | `computeSuggestions` |
| `compute_weekly_progress(targets, classes, activities, logs, period_start, period_end)` | `computeWeeklyProgress` |
| `compute_clean_streak(logs)` | `computeCleanStreak` |
| `compute_load_series(class_id, activities, logs, start, end, window=7)` | `computeLoadSeries` |
| `detect_delayed_tax(logs, check_ins, incidents)` | DESIGN.md §Load Calculation |

**Load formula:** `load = Σ(volume_value × rpe)` per log entry.
**Default RPE** when not provided: 5 (matches `DEFAULT_RPE` in `export/src/lib/load.ts`).

## 7. Phased Implementation Plan

**Workflow per ticket:** orchestrator → test-writer (failing tests first) →
implementer (minimum code to pass tests) → reviewer → commit.
See `agents/README.md`. One role, one ticket at a time.

---

### Phase 0 — Scaffold

**Goal:** Docker Compose running, FastAPI skeleton alive, Alembic configured,
health endpoint tested. No business logic.

| Ticket | Scope |
|---|---|
| B0.1 | Repo structure: create `backend/` tree, `pyproject.toml` (fastapi, sqlmodel, alembic, ruff, mypy, pytest, httpx), `.env.example`, `Makefile` with `make dev`, `make test`, `make lint` |
| B0.2 | `docker-compose.yml`: `backend` and `frontend` services, SQLite volume mount at `./data`, hot-reload via `--reload` flag, env vars wired from `.env` |
| B0.3 | `GET /api/health` endpoint + test in `backend/app/tests/test_health.py`; response: `{"status": "ok", "version": "0.1.0"}` |

**Verification:** `docker compose up` → both containers healthy; `curl localhost:8000/api/health` → 200 OK.

---

### Phase 1 — Database Models

**Goal:** All SQLModel table classes, Alembic initial migration, seed script
that mirrors `export/src/lib/mockData.ts` (Sam Chen / plantar fasciitis scenario).

| Ticket | Scope |
|---|---|
| B1.1 | SQLModel models for all 10 tables in `backend/app/models/`; `user_id TEXT NOT NULL DEFAULT 'local'` on top-level user-owned tables; correct FK relationships |
| B1.2 | `alembic init`; configure to point at models; generate initial migration; test `alembic upgrade head` → `alembic downgrade base` roundtrip in CI |
| B1.3 | `backend/scripts/seed.py`: 3 activity classes, 5 activities, 26 activity logs spanning 7 weeks, 6 check-ins, 2 flare-up incidents, 1 active training block with 4 rules and 2 weekly targets |

**Verification:** `alembic upgrade head` creates 10 tables; `python -m scripts.seed` populates;
`sqlite3 data/milestone.db "SELECT name FROM sqlite_master WHERE type='table'"` lists all 10.

---

### Phase 2 — Core CRUD API

**Goal:** REST CRUD for the 5 primary user-facing resources. Router → service
split enforced. Tests written before production code.

| Ticket | Scope |
|---|---|
| B2.1 | ActivityClass CRUD: schemas, service (`services/activity_classes.py`), router; `GET /api/activity-classes`, `POST`, `PATCH /{id}` |
| B2.2 | Activity CRUD: + query filters `?class_id=`, `?is_active=`; `PATCH /{id}` supports `is_active` toggle |
| B2.3 | ActivityLog CRUD: full CRUD; filters `?from=`, `?to=`, `?activity_id=`, `?class_id=`; `ruleViolationsAtLog` stored as JSON column |
| B2.4 | DailyCheckIn CRUD: upsert semantics on `(user_id, check_in_date)` — POST creates or replaces; `GET /today` resolves to server's local date; response may include an embedded `flareUp` object composed from related incident data |
| B2.5 | FlareUpIncident CRUD: full CRUD; nullable `activity_class_id` FK |

**Verification:** `pytest backend/app/tests/ -v` green on all Phase 2 tests.

---

### Phase 3 — Training Infrastructure

**Goal:** Training blocks, rules, targets, goals. Enforce single-active-block
invariant server-side.

| Ticket | Scope |
|---|---|
| B3.1 | TrainingBlock CRUD: `GET /api/training-blocks`, `GET /api/training-blocks/active`, `POST`, `PATCH /{id}`; service enforces only one `status=active` block at a time (deactivates previous on new activation) |
| B3.2 | Rule CRUD: `GET/POST /api/training-blocks/{id}/rules`; `PATCH/DELETE /api/rules/{id}` |
| B3.3 | WeeklyTarget CRUD: `GET/POST /api/training-blocks/{id}/weekly-targets`; `PATCH /api/weekly-targets/{id}` |
| B3.4 | RecoveryTarget CRUD: `GET/POST /api/training-blocks/{id}/recovery-targets`; streak field updated when recovery activity logged |
| B3.5 | Goal CRUD: `GET/POST /api/goals`; `PATCH /api/goals/{id}`; filters `?status=`, `?timeframe=` |

**Verification:** Create block → add 3 rules → add 2 weekly targets → activate;
attempt to activate a second block → first deactivates; `pytest -k phase3` green.

---

### Phase 4 — Load Engine Service

**Goal:** Python service that produces identical outputs to `engine.ts` on the
same input data. Verified by running both against seed data.

| Ticket | Scope |
|---|---|
| B4.1 | `backend/app/services/load_engine.py`: all 9 functions from §6; unit tests in `tests/test_load_engine.py` using known inputs derived from `mockData.ts` seed data |
| B4.2 | Load routes: `GET /api/load/summary` (class statuses + suggestions + weekly progress for today); `POST /api/load/check-violations` (request body: `{activity_id, volume_value, rpe}`; response: violation list; no DB write) |
| B4.3 | Delayed tax: `GET /api/load/delayed-tax`; scan 14-day window; flag days where load spike (top 25% of rolling average) precedes pain/flare-up by 24–72h |

**Verification:** Seed DB → `GET /api/load/summary` → manually compare class statuses
to `computeClassStatuses` output on same data in browser prototype.
Unit test for `compute_class_statuses` with known inputs.

---

### Phase 5 — Dashboard Endpoint

**Goal:** One aggregate endpoint the frontend Dashboard screen can call for
all its required data. Response must satisfy `MilestoneEngineResult` shape.

| Ticket | Scope |
|---|---|
| B5.1 | `backend/app/services/dashboard.py`: compose active block, all classes, all active activities, last 30 days of logs, today's check-in status, class statuses, suggestions, weekly progress (current block period), load series per class (block start → today), flare-up dates, clean streak, week load threshold per class |
| B5.2 | `GET /api/dashboard` route + integration test: assert all keys present; assert class status states match `compute_class_statuses` for seed data |

**Verification:** `GET /api/dashboard` with seed DB → valid JSON; integration test green.

---

### Phase 6 — Frontend Scaffold + API Integration

**Goal:** Vite project bootstrapped, all `export/src/` code copied in, hook
rewired to real API. All existing screens must work unchanged.

| Ticket | Scope |
|---|---|
| F1.1 | `npm create vite@latest frontend -- --template react-ts`; install `tailwindcss`, `@tanstack/react-query`; copy `export/src/` → `frontend/src/`; copy `export/tailwind.config.js`; add Vite proxy in `vite.config.ts`; `tsconfig.json` strict mode |
| F1.2 | `frontend/src/lib/api.ts`: typed `fetch` wrappers for every endpoint in §5; request and response types from `types.ts`; custom `ApiError` class with status code |
| F1.3 | Rewrite `frontend/src/hooks/useMilestoneEngine.ts`: replace `useState(LOGS)` etc. with `useQuery` (dashboard endpoint) and `useMutation` (submitLog, submitCheckIn, submitIncident) via `api.ts`; keep `MilestoneEngineResult` return type exactly — no screen changes needed |
| F1.4 | TypeScript + lint clean: `tsc --noEmit` passes; `eslint frontend/src` passes; fix any type errors from integration |

**Verification:** App loads in browser showing real seed data on Dashboard;
Log Activity → submit → row appears in Log History on next view;
Morning Check-In → submit → CTA disappears from Dashboard.

---

### Phase 7 — Frontend Completion

**Goal:** Port the 3 remaining screens from JSX prototypes to TypeScript
and wire to API.

**Prerequisite:** Owner adds `SettingsScreen.jsx`, `GoalsScreen.jsx`,
`NewActivitySheet.jsx` to `export/preview/` before this phase starts.

| Ticket | Scope |
|---|---|
| F2.1 | `NewActivitySheet.tsx`: bottom-sheet component; name input, class picker (GET /api/activity-classes), type toggle (performance/recovery), default unit picker; `POST /api/activities` on submit; spec: MOCKUPS.md §Screen 6b |
| F2.2 | `GoalsScreen.tsx`: goal list grouped by timeframe with progress bars; create-goal form (title, date, class, optional numeric target); status-update via `PATCH /api/goals/{id}`; spec: MOCKUPS.md §Screen 4 |
| F2.3 | `SettingsScreen.tsx`: active block display with rules list; edit-rules form per class; new block creation sheet; rule CRUD via `/api/training-blocks/{id}/rules`; spec: MOCKUPS.md §Screen 5, 5b |

**Verification:** Create goal via GoalsScreen → persists and shows on reload;
create rule via SettingsScreen → load summary reflects new rule;
create activity via NewActivitySheet → appears in LogActivityScreen picker.

---

### Phase 8 — Polish + MCP Stub

**Goal:** Production-quality UX for error and loading states, review milestone
detection, and MCP context stub for future AI integration.

| Ticket | Scope |
|---|---|
| F3.1 | Loading + empty states: skeleton loaders on Dashboard while `useQuery` is pending; empty-state illustrations for Log History (no logs yet) and Goals (no goals yet); top-level error boundary showing "Could not reach server" with retry |
| F3.2 | Review milestone: backend service checks `is_review_milestone_hit` condition after every log creation (weekly target met + 2 consecutive safe days); if met, patches `training_blocks.is_review_milestone_hit = true`; SettingsScreen shows a milestone badge |
| B6.1 | `GET /api/mcp/context`: returns structured JSON — active block summary, last 7 days of logs (activity name, load score per day), today's check-in (pain/readiness/stiffness), active class statuses; no AI integration, just the data shape for a future MCP server |

**Verification:** Kill backend container → Dashboard shows error boundary, not
blank white screen. Log enough activities to meet milestone conditions →
`GET /api/training-blocks/active` returns `is_review_milestone_hit: true`.

---

## 8. Quality Gates (from AGENTS.md)

```bash
# Backend — run from repo root
ruff check backend/
mypy backend/app --strict
pytest --cov=backend/app --cov-fail-under=80

# Frontend — run from repo root
npx tsc --noEmit --project frontend/tsconfig.json
npx eslint frontend/src
npm --prefix frontend run test -- --coverage  # >= 70%
```

`make lint` and `make test` wrap the canonical commands once the Makefile
exists (Phase 0, ticket B0.1).

## 9. Hard Constraints (from AGENTS.md)

1. No commits to `main` — all work on `feat/`, `fix/`, `chore/` branches
2. Failing tests must exist before production code is written
3. No business logic in routers — services layer only
4. No hardcoded config — all env-specific values in `.env` via `settings.py`
5. No schema changes without Alembic revision
6. No `any` in TypeScript; no untyped Python (`mypy --strict`)
7. No `git push` without owner instruction
8. No changes outside current ticket scope (add to `plans/BACKLOG.md` instead)
9. No secrets committed (`.env`, `data/`, `*.db` gitignored)

## 10. Ticket Index

| Ticket | Phase | Description |
|---|---|---|
| B0.1 | 0 Scaffold | Repo structure, pyproject.toml, Makefile |
| B0.2 | 0 Scaffold | docker-compose.yml |
| B0.3 | 0 Scaffold | GET /api/health + test |
| B1.1 | 1 Models | SQLModel table classes (10 tables) |
| B1.2 | 1 Models | Alembic init + initial migration |
| B1.3 | 1 Models | Seed script (Sam Chen scenario) |
| B2.1 | 2 Core CRUD | ActivityClass CRUD |
| B2.2 | 2 Core CRUD | Activity CRUD |
| B2.3 | 2 Core CRUD | ActivityLog CRUD |
| B2.4 | 2 Core CRUD | DailyCheckIn CRUD + upsert |
| B2.5 | 2 Core CRUD | FlareUpIncident CRUD |
| B3.1 | 3 Training | TrainingBlock CRUD + single-active constraint |
| B3.2 | 3 Training | Rule CRUD |
| B3.3 | 3 Training | WeeklyTarget CRUD |
| B3.4 | 3 Training | RecoveryTarget CRUD + streak |
| B3.5 | 3 Training | Goal CRUD |
| B4.1 | 4 Engine | load_engine.py + unit tests |
| B4.2 | 4 Engine | Load summary + check-violations routes |
| B4.3 | 4 Engine | Delayed tax detection route |
| B5.1 | 5 Dashboard | dashboard.py service |
| B5.2 | 5 Dashboard | GET /api/dashboard route + integration test |
| F1.1 | 6 FE Scaffold | Vite project + export/src copy-in |
| F1.2 | 6 FE Scaffold | api.ts typed fetch client |
| F1.3 | 6 FE Scaffold | useMilestoneEngine rewired to real API |
| F1.4 | 6 FE Scaffold | TypeScript + ESLint clean |
| F2.1 | 7 FE Complete | NewActivitySheet.tsx |
| F2.2 | 7 FE Complete | GoalsScreen.tsx |
| F2.3 | 7 FE Complete | SettingsScreen.tsx |
| F3.1 | 8 Polish | Loading + empty states + error boundary |
| F3.2 | 8 Polish | Review milestone auto-detection |
| B6.1 | 8 Polish | GET /api/mcp/context stub |

## 11. Owner Actions Required Before Implementation

- **Before Phase 6:** Ensure `export/src/` is fully committed and stable in
  the repo — Phase 6 copies it wholesale into `frontend/src/`
- **Before Phase 7:** Add `SettingsScreen.jsx`, `GoalsScreen.jsx`,
  `NewActivitySheet.jsx` to `export/preview/` so the implementer can port
  them to TypeScript
- **BACKLOG item:** Decide if `plans/BACKLOG.md` item about multi-class flare-up
  cause attribution is needed before or after MVP ships
