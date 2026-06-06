# Milestone — Technical Requirements Document
*Updated: June 2026 | Owner: Sam*

**Phase 0–10 ticket index:** archived under `plans/archive/phase-0-10/`

## 1. Architecture

### Local development

```
┌──────────────────────────────────────────────────────────────────┐
│ Docker Compose + Vite dev server                                   │
│                                                                  │
│  ┌──────────────────────┐       ┌──────────────────────────────┐│
│  │  Frontend (Vite)      │       │  Backend (Docker)            ││
│  │  :5151 (typical)      │──────▶│  FastAPI :8084               ││
│  └──────────────────────┘  /api └──────────────┬───────────────┘│
│                                                │                 │
│                                   ┌────────────▼────────────┐   │
│                                   │  SQLite                    │   │
│                                   │  data/milestone.db         │   │
│                                   └─────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**Vite proxy:** `"/api" → backend host:port` — relative `/api/...` paths. No CORS
in dev when using the proxy.

### Production (Phase 11 — live 2026-06-05)

App: `https://milestone-activity.netlify.app` · API: `https://milestone-training-log.onrender.com` · Deploy branch: `main`.

```
Phone (Android Chrome) ──HTTPS──▶ Netlify (static dist)
                                      │
                                      │ /api/* proxy (netlify.toml)
                                      ▼
                                 Render (Docker, FastAPI)
                                      │
                                      ▼
                                 Supabase Postgres
```

**Auth:** `POST /api/auth/login` sets HTTP-only session cookie; all `/api/*`
except health and login require session. Protects direct `*.onrender.com` access.

**Frontend deploy:** GitHub → Netlify (`frontend/` base, `npm run build`).

See §12 for env matrix and runbook.

## 2. Stack

| Layer | Technology |
| --- | --- |
| Backend framework | FastAPI 0.115+ |
| ORM + models | SQLModel 0.0.21+ |
| Migrations | Alembic |
| Database | SQLite (local dev); Postgres on Supabase (production) |
| Validation | Pydantic v2 (bundled with SQLModel) |
| Backend tests | pytest + httpx AsyncClient |
| Backend lint | ruff + mypy --strict |
| Frontend framework | React 18 + Vite 5 |
| Frontend language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 3.4 (custom token theme from `export/tailwind.config.js`) |
| HTTP client | `fetch` wrapped in typed API modules under `frontend/src/lib/api/`; snake_case ↔ camelCase mapping at client boundary |
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
│   │   │   ├── api/             # Typed fetch + snake↔camel mappers (Phase 6)
│   │   │   ├── engine.ts        # Reference / tests only after Phase 6 F1.3
│   │   │   ├── load.ts          # Reference / tests only after Phase 6 F1.3
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

**user&#95;id convention:** `user_id TEXT NOT NULL DEFAULT 'local'` on all user-owned
rows. Phase 1 is single-user; the field exists so multi-user auth migration
requires only one new column (a real UUID/auth sub) and one middleware layer —
no schema restructuring.

**ID convention:** Use opaque string IDs (`TEXT` in SQLite) so backend records
map cleanly to `export/src/types.ts` and seed data without translation.

**Child-table ownership:** `rules`, `weekly_targets`, and `recovery_targets`
inherit ownership through `training_blocks`; they do not carry their own
`user_id` column in Phase 1.

**flare&#95;up&#95;incidents → activity&#95;classes:** Single nullable FK `activity_class_id`
on `flare_up_incidents`. User picks one likely cause class. If multi-class cause
attribution is needed later, add a join table then (BACKLOG item).

**flare-up persistence:** Detailed flare-up records are stored relationally in
`flare_up_incidents`, optionally linked back to `daily_check_ins` through
`daily_check_in_id`. Daily check-in API responses may compose the frontend's
embedded `flareUp` object from that related row rather than storing duplicate
JSON as the database source of truth.

**Field set locked for Phase 1:** Include `activities.default_volume_unit`,
`activity_logs.rule_violations_at_log`, `weekly_targets.target_unit`, and
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
| --- | --- | --- |
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
| GET | `/api/load/summary` | Class statuses, suggestions, weekly progress; `?as_of=` (default server-local today) |
| POST | `/api/load/check-violations` | Dry-run all five rule types — no write; body may include `as_of` |
| GET | `/api/load/delayed-tax` | Proactive 7-day load/rest risk + symptom attribution; `?as_of=`, `?risk_window_days=`, `?baseline_days=`, `?pain_threshold=` |
| GET | `/api/dashboard` | Full aggregate matching `MilestoneEngineResult` interface |

When no active training block exists, load routes return **HTTP 200** with neutral
or empty computed payloads (not `404`). Full behaviour:
`plans/archive/phase-0-10/tickets-phase-4-load-engine-2026-05-27.md`.

## 6. Load Engine

`export/src/lib/engine.ts` and `export/src/lib/load.ts` are the canonical
references for **ported** pure functions. The backend implements them in
`backend/app/services/load_engine.py`. Phase 4 extends beyond the prototype where
noted below.

**Python ↔ TypeScript function pairs:**

| `detect_delayed_tax(logs, activities, classes, rules, check_ins, incidents, as_of, …)` | *(no TS reference)* | **New:** see §Delayed tax below |
| Python (load_engine.py) | TypeScript (engine.ts / load.ts) | Parity |
| --- | --- | --- |
| `rolling_load(logs, as_of, window_days) → float` | `rollingLoad` in load.ts | Exact |
| `compute_class_statuses(as_of, classes, activities, logs, rules)` | `computeClassStatuses` | Exact (rest + weekly load cap only) |
| `check_violations(activity_id, volume, rpe, logs, rules, as_of)` | `checkViolations` in useMilestoneEngine.ts | **Extended:** all five rule types (prototype: rest + cap only) |
| `compute_daily_safety_scores(start, end, logs, check_ins, incidents)` | `computeDailySafetyScores` | Exact |
| `compute_suggestions(class_statuses, activities, classes)` | `computeSuggestions` | Exact |
| `compute_weekly_progress(targets, classes, activities, logs, period_start, period_end)` | `computeWeeklyProgress` | Exact |
| `compute_clean_streak(logs)` | `computeCleanStreak` | Exact |
| `compute_load_series(class_id, activities, logs, start, end, window=7)` | `computeLoadSeries` | Exact |

**Load formula:** `load = Σ(volume_value × rpe)` per log entry.
**Default RPE** when not provided: 5 (matches `DEFAULT_RPE` in `export/src/lib/load.ts`).

### Delayed tax (`detect_delayed_tax`)

Two layers (canonical spec: `plans/archive/phase-0-10/tickets-phase-4-load-engine-2026-05-27.md` §Delayed-tax methodology):

**Layer A — Proactive (always):** Scan the last **7** days through `as_of`. Compare
each performance class’s daily load to a **14-day median baseline** immediately
before that window. Emit `elevated_load` when `daily_load >= median`, and
`rest_debt` when activity breaks `rest_between_class` (with cumulative load across
under-rested days).

**Layer B — Symptom-linked (when recorded):** In the same window, factor user-logged
`pain_level > 3`, `has_flare_up`, and `flare_up_incidents`. Emit `symptom_marker`,
`acute_attribution` (e.g. ≥14 class-rest days then a return within 3 days of symptom),
and `symptom_contributor` (earlier elevated load / rest debt in the week before the
symptom). Symptoms are not required to run Layer A.

## 7. Phased Implementation Plan

**Workflow per ticket:** orchestrator → test-writer (failing tests first) →
implementer (minimum code to pass tests) → reviewer → commit.
See `agents/README.md`. One role, one ticket at a time.

---

### Phase 0 — Scaffold

**Goal:** Docker Compose running, FastAPI skeleton alive, Alembic configured,
health endpoint tested. No business logic.

| Ticket | Scope |
| --- | --- |
| B0.1 | Repo structure: create `backend/` tree, `pyproject.toml` (fastapi, sqlmodel, alembic, ruff, mypy, pytest, httpx), `.env.example`, `Makefile` with `make dev`, `make test`, `make lint` |
| B0.2 | `docker-compose.yml`: `backend` and `frontend` services, SQLite volume mount at `./data`, hot-reload via `--reload` flag, env vars wired from `.env` |
| B0.3 | `GET /api/health` endpoint + test in `backend/app/tests/test_health.py`; response: `{"status": "ok", "version": "0.1.0"}` |

**Verification:** `docker compose up` → both containers healthy; `curl localhost:8000/api/health` → 200 OK.

---

### Phase 1 — Database Models

**Goal:** All SQLModel table classes, Alembic initial migration, seed script
that mirrors `export/src/lib/mockData.ts` (Sam Chen / plantar fasciitis scenario).

| Ticket | Scope |
| --- | --- |
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
| --- | --- |
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
| --- | --- |
| B3.1 | TrainingBlock CRUD: `GET /api/training-blocks`, `GET /api/training-blocks/active`, `POST`, `PATCH /{id}`; service enforces only one `status=active` block at a time (deactivates previous on new activation) |
| B3.2 | Rule CRUD: `GET/POST /api/training-blocks/{id}/rules`; `PATCH/DELETE /api/rules/{id}` |
| B3.3 | WeeklyTarget CRUD: `GET/POST /api/training-blocks/{id}/weekly-targets`; `PATCH /api/weekly-targets/{id}` |
| B3.4 | RecoveryTarget CRUD: `GET/POST /api/training-blocks/{id}/recovery-targets`; streak field updated when recovery activity logged |
| B3.5 | Goal CRUD: `GET/POST /api/goals`; `PATCH /api/goals/{id}`; filters `?status=`, `?timeframe=` |

**Verification:** Create block → add 3 rules → add 2 weekly targets → activate;
attempt to activate a second block → first deactivates; `pytest -k phase3` green.

---

### Phase 4 — Load Engine Service

**Goal:** Python `load_engine.py` with ported `engine.ts`/`load.ts` functions,
extended dry-run rule checks, proactive + symptom-linked delayed tax, and load
API routes. Ported functions verified with Python unit tests and `mockData.ts`
fixtures at `as_of=2026-05-25`.

**Ticket detail:** `plans/archive/phase-0-10/tickets-phase-4-load-engine-2026-05-27.md`

| Ticket | Scope |
| --- | --- |
| B4.1 | `load_engine.py`: §6 functions; `check_violations` all five rule types; `detect_delayed_tax` proactive + symptom layers |
| B4.2 | `GET /api/load/summary`, `POST /api/load/check-violations`; `as_of` default today; snake_case JSON; 200 when no active block |
| B4.3 | `GET /api/load/delayed-tax`; 7-day risk / 14-day median baseline; elevated load, rest debt, symptom attribution |

**Verification:** `pytest` for `test_load_engine.py` and `test_load_api.py`;
`GET /api/load/summary?as_of=2026-05-25` class statuses match `computeClassStatuses`
on the same fixture data.

---

### Phase 5 — Dashboard Endpoint

**Goal:** One aggregate endpoint the frontend Dashboard screen can call for
all its required data. Response must satisfy `MilestoneEngineResult` shape.

| Ticket | Scope |
| --- | --- |
| B5.1 | `backend/app/services/dashboard.py`: compose active block, all classes, all active activities, last 30 days of logs, today's check-in status, class statuses, suggestions, weekly progress (current block period), load series per class (block start → today), flare-up dates, clean streak, week load threshold per class |
| B5.2 | `GET /api/dashboard` route + integration test: assert all keys present; assert class status states match `compute_class_statuses` for seed data |

**Verification:** `GET /api/dashboard` with seed DB → valid JSON; integration test green.

---

### Phase 6 — Frontend Scaffold + API Integration

**Goal:** Vite project bootstrapped, all `export/src/` code copied in, hook
rewired to real API. All five existing Tier-3 screens work against seed data
with minimal screen diffs (label lookups only).

**Status:** Phase 5 merged to `main` (2026-05-28). Ticket detail:
`plans/archive/phase-0-10/tickets-phase-6-frontend-2026-05-28.md`.

**Owner decisions locked (2026-05-28):**
**Load route conventions (Phase 4):** Request and response JSON use **snake&#95;case**.

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Goals/Settings tabs before Phase 7 | Keep all four tabs; show **"Coming soon"** placeholder screens |
| 2 | JSON casing | Backend stays **snake&#95;case**; `frontend/src/lib/api/` maps to **camelCase** at the client boundary (no Pydantic alias churn) |
| 3 | Log History data source | **`GET /api/activity-logs`** for full history; dashboard `logs` remains 30-day window only |
| 4 | Live rule check | **`POST /api/load/check-violations`** (all five rule types); remove prototype's two-rule inline logic from the hook |
| 5 | Client IDs on writes | Frontend generates opaque string IDs (`crypto.randomUUID()`) on POST bodies |
| 6 | Derived state at runtime | **`engine.ts` / `load.ts` not used in the live hook path** once API is wired; backend is authoritative. Keep libs for optional unit tests / reference |
| 7 | `recovery_streaks` | Map into extended `MilestoneEngineResult` in F1.3; **UI wiring deferred to Phase 7** (Settings / compliance section) |
| 8 | Delayed tax | **`GET /api/load/delayed-tax`** client wrapper in F1.2; **dashboard UI deferred to Phase 7+** (PRD F4) |

| Ticket | Scope |
| --- | --- |
| F1.1 | Vite + Tailwind + React Query scaffold; copy `export/src/`; `App.tsx` tab router + modal flows; Goals/Settings "Coming soon"; docker-compose frontend service; Makefile frontend gates |
| F1.2 | Typed API client module(s) with snake↔camel mappers, `ApiError`, wrappers for every §5 endpoint |
| F1.3 | Rewire `useMilestoneEngine`: dashboard query + activity-logs query + mutations + API-backed `checkViolations`; extend result type for `recoveryStreaks` |
| F1.4 | Replace hardcoded class labels; Vitest + ESLint + `tsc`; Makefile `lint`/`test` include frontend |

**Verification:** App loads in browser showing real seed data on Dashboard;
Log Activity → submit → row appears in Log History on next view;
Morning Check-In → submit → CTA disappears from Dashboard.

**Development data strategy (owner decision, 2026-05-28):**

| Stage | Approach |
| --- | --- |
| **Now (Phase 6 handoff)** | **Manual seeding** is sufficient — from `backend/`, run `.venv/bin/python3 -m scripts.seed` (after `alembic upgrade head`) against the local SQLite file when starting a dev session. Owner verifies the app manually before merge; no automated E2E gate blocks Phase 6. |
| **Once the app is usable day-to-day** | Introduce a **dedicated local test database** (separate file or env) with **automated seed** in `make test` / CI so integration and manual smoke runs are repeatable without touching owner data. |
| **Feature updates with schema changes** | Practice **Alembic migrations** on the local live DB: `alembic upgrade head` after pulls that add revisions; document rollback (`alembic downgrade -1`) for failed upgrades. Test migrations against the test DB in CI before applying to a personal live DB. |

Rationale: defer test-DB automation until the product is stable enough to use
regularly; avoid over-investing in fixture pipelines before the UI loop is
proven. Revisit when Phase 7+ adds write-heavy settings/goals flows.

**Implementation status:** F1.1–F1.4 implemented on `feat/phase-6-frontend`
(2026-05-28); owner manual verification pending before merge to `main`.

---

### Phase 7 — Frontend Completion

**Goal:** Port the 3 remaining screens from JSX prototypes to TypeScript
and wire to API. Surface backend features not yet shown in Tier-3 screens.

**Prerequisite:** Owner adds `SettingsScreen.jsx`, `GoalsScreen.jsx`,
`NewActivitySheet.jsx` to `export/preview/` before this phase starts.

**Deferred-item routing (owner decision 2026-05-30).** Phase 7's scope is the
3 screen ports only. The 4 items previously parked under Phase 7 are re-routed
by how close they sit to that scope:

- **`CalendarHeatmap` block-review grid → Phase 7.5.** Its home is the Settings
  "Review block" flow, which *is* built in Phase 7, so it is worth doing right
  after the Settings port rather than waiting for Phase 8. Wire `dailyScores`
  from hook; component exists in `export/src/composites/`.
- **`recovery_streaks` compliance UI → Phase 8.** Dashboard compliance section
  consuming `recoveryStreaks` from hook — outside the screen-port scope.
- **Delayed tax / load risk panel → Phase 8.** PRD F4; consume
  `GET /api/load/delayed-tax`. Dashboard surface, not a ported screen.
- **Dynamic load graph title (rule-driven) → Phase 8.** Full weekly-cap class
  resolution from dashboard payload; Dashboard polish, not in Phase 7 scope.

| Ticket | Scope |
| --- | --- |
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
| --- | --- |
| F3.1 | Loading + empty states: skeleton loaders on Dashboard while `useQuery` is pending; empty-state illustrations for Log History (no logs yet) and Goals (no goals yet); top-level error boundary showing "Could not reach server" with retry |
| F3.2 | Review milestone: backend service checks `is_review_milestone_hit` condition after every log creation (weekly target met + 2 consecutive safe days); if met, patches `training_blocks.is_review_milestone_hit = true`; SettingsScreen shows a milestone badge |
| B6.1 | `GET /api/mcp/context`: returns structured JSON — active block summary, last 7 days of logs (activity name, load score per day), today's check-in (pain/readiness/stiffness), active class statuses; no AI integration, just the data shape for a future MCP server |

**Verification:** Kill backend container → Dashboard shows error boundary, not
blank white screen. Log enough activities to meet milestone conditions →
`GET /api/training-blocks/active` returns `is_review_milestone_hit: true`.

**Backend follow-up (non-blocking):** Refactor `check_violations` in
`load_engine.py` (radon F-rank) when next touched — see `plans/BACKLOG.md`.

---

### Phase 9 — UI Interaction Completeness

**Goal:** Implement the stub interactions left as `() => undefined` no-ops after Phase 7. Each item requires a design screen or mockup before a ticket can be written. This section is a design backlog, not an implementation plan.

**Owner action required:** Produce mockups/designs for each item below before Phase 9 tickets are written. Use the same `export/preview/*.jsx` prototype convention so the implementer has a reference spec.

| Item | Current state | Screen | Notes |
| --- | --- | --- | --- |
| Edit goal | `onEdit={() => undefined}` stub | GoalsScreen | Needs an edit sheet (reuse NewGoalForm shell). Fields: title, target date, timeframe, class, progress target/unit. PATCH via `engine.updateGoal`. |
| Edit activity | `onEdit={() => undefined}` stub | SettingsScreen — Activities Manager | Needs an edit sheet. Fields: name, class (read-only?), type, default volume unit. PATCH via a new `engine.updateActivity` mutation (not yet in the hook). |
| Deactivate activity | `onDeactivate={() => undefined}` stub | SettingsScreen — Activities Manager | Needs confirmation dialog. On confirm: PATCH `isActive: false` via `engine.updateActivity`. Row should grey out or disappear per design decision. |
| View previous block | No `onClick` | SettingsScreen — Previous Blocks list | Blocked on Phase 7.5 (CalendarHeatmap / block-review grid). Design the block-review screen first; this button routes to it. |
| Block summary (current block) | `onReview={() => undefined}` stub | SettingsScreen — Active Block card | Same blocker as above — Phase 7.5 block-review screen. |

**Dependencies:**
- Edit activity and Deactivate activity both require a new `updateActivity(activityId, patch)` mutation added to `useMilestoneEngine` (hook extension, similar to the F2.0 pattern).
- View previous block and Block summary both depend on the Phase 7.5 CalendarHeatmap / block-review work which already appears in the Phase 7 out-of-scope list.

`goals.progress_value` / `progress_target` / `progress_unit` in the initial
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
| --- | --- | --- |
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
| F1.3 | 6 FE Scaffold | useMilestoneEngine rewired to real API; plan Log History via activity-logs + recovery_streaks mapping |
| F1.4 | 6 FE Scaffold | TypeScript + ESLint clean |
| F2.1 | 7 FE Complete | NewActivitySheet.tsx |
| F2.2 | 7 FE Complete | GoalsScreen.tsx |
| F2.3 | 7 FE Complete | SettingsScreen.tsx |
| F2.5 | 7 Cleanup | Bug fixes: goals 422, rules indexing, archive UX |
| F2.6 | 7 Cleanup | Reset mock data + dev-mode guard |
| F3.1 | 8 Polish | Loading + empty states + error boundary |
| F3.2 | 8 Polish | Review milestone auto-detection |
| B6.1 | 8 Polish | GET /api/mcp/context stub |

## 11. Owner Actions Required Before Implementation

- **~~Before Phase 6:~~** ~~Ensure `export/src/` is fully committed and stable~~
  (done — copy wholesale into `frontend/src/` on F1.1)
- **~~Before Phase 7:~~** Settings/Goals screens ported (done Phases 7–9)
- **~~Phase 11 (production):~~** ✅ Complete (2026-06-05) — live on Netlify + Render + Supabase; see §12 and `docs/deploy.md`

---

## 12. Production deployment (Phase 11)

**Status:** ✅ **Live** (2026-06-05) — O11.0–O11.2 complete; tickets in `plans/tickets-phase-11-production-2026-06-04.md`.

**Approved design:** `plans/technical-design-production-deploy-2026-06-04.md`  
**Owner runbook:** [`docs/deploy.md`](../docs/deploy.md) (O11 checklists, backup, cold start, security).

### 12.1 Services

| Service | Role | Tier |
| --- | --- | --- |
| Netlify | Host `frontend/dist`; proxy `/api/*` to Render | Free |
| Render | Docker Web Service, FastAPI + Alembic on start | Free (cold sleep OK) |
| Supabase | Postgres `DATABASE_URL` | Free |

Default hostnames (`*.netlify.app`, `*.onrender.com`) until custom domain.

### 12.2 Environment matrix

| Variable | Local | Production |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./data/milestone.db` | Supabase Session pooler `postgresql+psycopg://...` |
| `APP_DEV_MODE` | optional `true` | `false` |
| `VITE_DEV_MODE` | optional `true` | `false` |
| `VITE_API_BASE_URL` | empty | empty (Netlify proxy) |
| `SESSION_SECRET` | dev value in `.env.example` | Render secret (long random) |
| `AUTH_PASSWORD` | optional | Render secret (shared password) |
| `SESSION_MAX_AGE_DAYS` | optional | default `30` |
| `CORS_ORIGINS` | unset | unset unless split-origin testing |

Do **not** run `scripts/seed.py` in production.

### 12.3 Backend start (Render)

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Health check: `GET /api/health`. Add `psycopg` for Postgres driver.

### 12.4 Netlify

- Base: `frontend`
- Build: `npm ci && npm run build`
- Publish: `dist`
- `netlify.toml`: force proxy `/api/*` → Render service URL; SPA fallback `/*` → `index.html`
- GitHub integration: deploy on push to `main` (or owner-chosen branch)

### 12.5 Auth API (summary)

| Endpoint | Access |
| --- | --- |
| `GET /api/health` | Public |
| `POST /api/auth/login` | Public |
| `POST /api/auth/logout` | Session |
| All other `/api/*` | Session required |

Frontend: `fetch` with `credentials: 'include'`; login UI on 401.

### 12.6 Data backup

Owner requirement: avoid losing production data. Runbook must document Supabase
backup/export options (dashboard backup tier, manual `pg_dump` or export).
Optional implementation ticket for automated export — see Phase 11 planner.

### 12.7 Acceptance smoke (owner, on phone)

1. Netlify URL loads login → session → empty dashboard.
2. Full MVP flows: log, check-in, incident, goals, settings/block tools.
3. `POST /api/dev/reset` unavailable in prod.
4. Data survives Render restart.
5. Chrome on Android (Pixel 9 Pro).

### 12.8 CI note

Postgres migration verification in pytest or CI before first prod deploy.
Dedicated test DB in CI remains backlog unless added in Phase 11 ticket set.
