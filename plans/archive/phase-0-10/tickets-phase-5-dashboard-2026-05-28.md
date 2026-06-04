# Phase 5 — Dashboard Endpoint Tickets
*Source: `plans/TRD.md` §7 Phase 5, `plans/PRD.md` §4 F4, `DESIGN.md` §Dashboard,
`docs/api-map.md`, `export/src/hooks/useMilestoneEngine.ts`, Phase 4 load engine |
Date: 2026-05-28*

## Planning assumptions locked for this ticket set

- Phase 0–4 are complete on `main`. Reuse FastAPI app factory, SQLModel models,
  Alembic schema, session dependency, Phase 2/3 CRUD services, route-test
  fixtures, `LOCAL_USER_ID` scoping, `load_engine.py`, and `load_queries.py`.
- Phase 5 is backend-only: one aggregate read endpoint plus a dashboard composer
  service. Frontend scaffold (Phase 6+), review-milestone auto-detection
  (Phase 8), MCP stub, and delayed-tax UI remain out of scope.
- All work lands on branch `feat/phase-5-dashboard`.
- **Dashboard read payload:** fields required by existing Tier-3 screens via
  `MilestoneEngineResult`, plus **`recovery_streaks`** (owner confirmed 2026-05-28).
  Mutations (`submitCheckIn`, `submitLog`, `submitIncident`, `checkViolations`)
  stay on existing CRUD / load routes — not part of `GET /api/dashboard`.
- **Log History note:** dashboard returns a **30-day log window** only. Phase 6
  F1.3 must add a separate `GET /api/activity-logs` fetch for full Log History
  (owner confirmed 2026-05-28; pagination deferred).
- API JSON uses **snake_case**, matching Phase 3 CRUD and Phase 4 load routes.
  Phase 6 `api.ts` performs camelCase mapping for the frontend.
- Optional query `?as_of=YYYY-MM-DD` defaults to server-local `date.today()`,
  matching Phase 4 load routes.
- When no active training block exists, return **HTTP 200** with `block: null`
  and neutral/empty derived fields (not `404`), consistent with Phase 4 load
  summary behaviour.
- Reuse `load_queries` data-loading helpers and `load_engine` pure functions;
  do not duplicate formulas in `dashboard.py`.
- Business logic stays in `services/`; routers translate HTTP only.
- Register dashboard route in `backend/app/main.py` under `/api/dashboard`.
- Parity with the prototype is proven via integration tests against seed-shaped
  data at `as_of=2026-05-25` (Sam Chen / plantar fasciitis scenario).
- No new tables or Alembic revisions in Phase 5 unless a test exposes a Phase 1
  schema bug.

## Owner decisions resolved (2026-05-28)

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Log scope in response | **30-day window** through `as_of`; Phase 6 adds `GET /api/activity-logs` for Log History |
| 2 | Activities in response | **All activities** (active + inactive) for name resolution on recent logs |
| 3 | Load graph series | **Single `load_series`** for graph class (prototype UI) |
| 4 | Week load threshold | **Single `week_load_threshold`** paired with graph class |
| 5 | User display name | **`DEFAULT_USER_NAME`** in settings / `.env` (default `"Sam"`) |
| 6 | Daily safety scores | **Include `daily_scores`** (block start → `as_of`) for hook parity |
| 7 | Delayed tax | **Separate endpoint** — do not embed in dashboard aggregate |
| 8 | Recovery compliance streaks | **Include `recovery_streaks`** from active block recovery targets |

**Computation vs response (logs):** Engine calculations (`class_statuses`,
`weekly_progress`, `load_series`, `clean_streak`, `daily_scores`) may load logs
back to `block.start_date` (or as far as needed for rolling windows). Only the
**`logs` array in the JSON response** is capped to the last **30 calendar days**
inclusive through `as_of`: `[as_of - 29 days, as_of]`.

**Graph class selection** (locked):
1. First enabled `weekly_load_cap` rule on the active block (stable order:
   `activity_class_id` ascending).
2. Else first performance activity class (stable order: class `id` ascending).
3. When no block: `load_series=[]`, `week_load_threshold=0`.

---

## Ticket ordering rationale

B5.1 establishes the dashboard composer service, response schemas, and focused
unit tests for composition edge cases (no block, graph-class selection, 30-day
log window, recovery streaks). B5.2 wires the HTTP route and integration tests
that assert seed-data parity at `as_of=2026-05-25`.

---

## B5.1 — Dashboard composer service

**Type:** backend  
**Branch:** `feat/phase-5-dashboard`  
**Depends on:** Phase 4 `load_engine.py`, `load_queries.py`; Phase 2/3 data services

### Acceptance criteria

- Tests in `backend/app/tests/test_dashboard_service.py` are written **before**
  `backend/app/services/dashboard.py`. They should fail first because the module
  is missing.
- `backend/app/services/dashboard.py` exposes
  `get_dashboard(session, *, as_of: date | None = None) -> DashboardRead`.
  No FastAPI imports in the service module.
- `backend/app/schemas/dashboard.py` defines `DashboardRead` and nested read
  models. Reuse existing `*Read` schemas from Phase 2/3/4 where shapes match
  (`ActivityClassRead`, `ActivityRead`, `ActivityLogRead`, `FlareUpIncidentRead`,
  `TrainingBlockRead`, `ActivityClassStatusRead`, `SuggestionRead`,
  `WeeklyProgressRead`). Add dashboard-specific models only when needed.
- `LoadPointRead` fields: `date` (`YYYY-MM-DD`), `load` (rolling), `daily_load`
  (non-rolling day contribution) — mirrors `export/src/lib/load.ts` `LoadPoint`.
- `DailySafetyScoreRead` fields: `date`, `state` (`safe` | `caution` | `danger`),
  `violations` (list of rule-violation snapshots), `had_flare_up`, optional
  `pain_level` — mirrors `export/src/types.ts` `DailySafetyScore`.
- `RecoveryStreakRead` fields (new — not on current `MilestoneEngineResult`):
  - `recovery_target_id`
  - `activity_id`
  - `activity_name` — joined from activities list
  - `activity_class_id` — joined from activity
  - `target_frequency`
  - `frequency_unit` (`daily` | `weekly`)
  - `current_streak_days` — persisted field from `recovery_targets` row
  - Stable sort: `activity_name` ascending, then `recovery_target_id` ascending
- `get_dashboard` loads local-scoped data through existing list services (not
  ad-hoc SQL in the router):
  - all activity classes
  - all activities (active and inactive)
  - activity logs with `logged_date <= as_of` for engine inputs (full history
    needed for block-scoped derivations)
  - flare-up incidents with `incident_date <= as_of`
  - daily check-ins with `check_in_date <= as_of`
  - active training block when present, with rules, weekly targets, and
    **recovery targets**
- Response top-level fields (snake_case):

  | Field | Source / rule |
  | --- | --- |
  | `as_of` | resolved date (alias for hook's `todayDate`) |
  | `user_name` | `settings.DEFAULT_USER_NAME` |
  | `block` | active block read model, or `null` |
  | `activity_classes` | all classes |
  | `activities` | all activities |
  | `logs` | logs in **30-day response window** only: `[as_of - 29, as_of]` |
  | `incidents` | all incidents `<= as_of` |
  | `has_checked_in_today` | `true` when a check-in exists for `(user_id, as_of)` |
  | `class_statuses` | `compute_class_statuses` using block rules when present; all safe when no block |
  | `suggestions` | `compute_suggestions` |
  | `weekly_progress` | `compute_weekly_progress(block.start_date, as_of, …)` when block exists; else `[]` |
  | `daily_scores` | `compute_daily_safety_scores(block.start_date, as_of, …)` when block exists; else `[]` |
  | `load_series` | `compute_load_series(graph_class_id, …, block.start_date, as_of)` when block exists; else `[]` |
  | `flare_up_dates` | sorted unique `incident_date` strings from incidents |
  | `week_load_threshold` | enabled `weekly_load_cap.threshold_value` for `graph_class_id` when rule exists; else `0` |
  | `clean_streak` | `compute_clean_streak(all logs <= as_of)` — uses full log history, not 30-day slice |
  | `recovery_streaks` | mapped from active block recovery targets when block exists; else `[]` |

- When no active block: mirror Phase 4 load summary neutral behaviour for
  `class_statuses` and `suggestions`; empty arrays for block-scoped derived fields
  including `recovery_streaks`.
- Extract shared dict-mapping helpers from `load_queries.py` into a reusable
  module (e.g. `services/load_data.py`) **only if** B5.1 would otherwise
  duplicate `_activity_dict`, `_log_dict`, etc. Prefer extending `load_queries`
  with importable helpers over copy-paste.
- Unit tests cover at minimum:
  - seed-shaped fixture at `as_of=2026-05-25`: `cls-foot` class status state
    matches `compute_class_statuses` output
  - `has_checked_in_today=false` when no check-in on `as_of` (seed default)
  - `flare_up_dates` includes seed incident dates
  - `clean_streak` matches `compute_clean_streak` on full log history
  - `logs` in response contains only entries within 30 days of `as_of`; older
    logs still affect `load_series` / `class_statuses` when in block range
  - `load_series` length equals inclusive day count from block start to `as_of`
  - `recovery_streaks` populated when test fixture includes recovery targets on
    active block (seed lacks them — create in test setup)
  - no-block scenario returns `block=null`, `recovery_streaks=[]`, and empty
    block-scoped arrays
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend

- `backend/app/services/load_engine.py` — all derived computations
- `backend/app/services/load_queries.py` — data loading patterns, `resolve_as_of`
- Phase 2 list services: `activity_classes`, `activities`, `activity_logs`,
  `daily_check_ins`, `flare_up_incidents`
- Phase 3: `training_blocks.get_active_training_block`, `rules.list_rules`,
  `weekly_targets.list_weekly_targets`, `recovery_targets.list_recovery_targets`
- Reference hook: `export/src/hooks/useMilestoneEngine.ts` (read fields only;
  `recovery_streaks` is new for future MOCKUPS compliance UI)

### Recommended test scope

- Service-level tests with in-memory or SQLite session fixtures; no HTTP required
  in B5.1.
- Use seed IDs (`cls-foot`, `blk-1`, `log-*`, `inc-*`) and `as_of=2026-05-25`
  for deterministic assertions.

### Edge cases to handle

- Logs, check-ins, or incidents **after** `as_of` are excluded from all
  calculations and raw lists.
- Inactive activities still appear in `activities` for log name resolution.
- Block with no enabled `weekly_load_cap` rule still produces `load_series` via
  fallback performance class; `week_load_threshold=0`.
- Empty database: service result with empty arrays, `block=null`,
  `has_checked_in_today=false`, `clean_streak=0`, `recovery_streaks=[]`.
- Recovery target references a missing activity → skip that row or omit from
  `recovery_streaks` (do not 500); prefer skip with stable ordering on valid rows.
- `weekly_progress` period is inclusive `[block.start_date, as_of]` matching
  Phase 4 load summary.

### Files to create / modify

- `backend/app/schemas/dashboard.py`
- `backend/app/services/dashboard.py`
- `backend/app/tests/test_dashboard_service.py`
- `backend/app/services/load_queries.py` or `backend/app/services/load_data.py`
  (only if deduplicating mappers)
- `backend/app/settings.py` — add `DEFAULT_USER_NAME: str = "Sam"`
- `backend/.env.example` — document `DEFAULT_USER_NAME`

---

## B5.2 — GET /api/dashboard route + integration tests

**Type:** backend  
**Branch:** `feat/phase-5-dashboard`  
**Depends on:** B5.1

### Acceptance criteria

- Tests in `backend/app/tests/test_dashboard_api.py` are written **before** the
  router. They should fail first because `/api/dashboard` is missing.
- `GET /api/dashboard`:
  - Optional query `as_of=YYYY-MM-DD` (default server-local today).
  - Returns HTTP `200` with `DashboardRead` JSON (snake_case).
  - Invalid `as_of` format returns HTTP `422`.
- `backend/app/routers/dashboard.py` is thin: parse query params, call
  `get_dashboard`, return response. No business logic in the router.
- Router registered in `backend/app/main.py`.
- Integration tests use `httpx.AsyncClient`, temporary SQLite, and seeded data
  matching the Sam Chen scenario (reuse existing test seed helpers where
  possible).
- At least one integration test calls `GET /api/dashboard?as_of=2026-05-25` and
  asserts:
  - all top-level keys from B5.1 are present (including `recovery_streaks`)
  - `has_checked_in_today` is `false` (no check-in on seed today)
  - `class_statuses` includes `cls-foot` with the same `state` as
    `GET /api/load/summary?as_of=2026-05-25` for the same DB
  - `weekly_progress` length matches seed weekly targets on active block
  - `load_series` is non-empty and last point date equals `as_of`
  - `flare_up_dates` is non-empty
  - `clean_streak` is a non-negative integer
  - every `logs[].logged_date` falls within the 30-day window ending on `as_of`
  - `user_name` equals configured default (`"Sam"`)
- At least one integration test with recovery targets on the active block asserts
  `recovery_streaks` is non-empty and includes expected `activity_name` and
  `current_streak_days`.
- At least one integration test: database with no active block → `200`,
  `block=null`, `weekly_progress=[]`, `load_series=[]`, `recovery_streaks=[]`.
- At least one integration test: invalid `as_of=not-a-date` → `422`.
- Optional performance smoke: seeded dashboard response completes in < 500 ms
  (soft assertion or documented skip if CI timing is flaky — do not fail CI on
  timing alone).
- Update `docs/api-map.md` dashboard row with `?as_of=`, 30-day log window note,
  and key response fields including `recovery_streaks`.
- `make test` and `make lint` pass before commit.

### Reuse / extend

- `backend/app/services/dashboard.py` from B5.1
- Route test patterns from `backend/app/tests/test_load_api.py`
- Seed helpers from `backend/app/tests/helpers/`

### Edge cases to handle

- `GET /api/dashboard` without seed data returns valid empty/neutral payload
  (not 500).
- Monkeypatch or fixed `as_of` for deterministic `/today`-adjacent tests; do not
  rely on wall clock for seed parity assertions.

### Files to create / modify

- `backend/app/routers/dashboard.py`
- `backend/app/main.py`
- `backend/app/tests/test_dashboard_api.py`
- `docs/api-map.md` (dashboard section only)

---

## Out of scope (explicit)

- Frontend `api.ts` or `useMilestoneEngine` rewiring (Phase 6 F1.2–F1.3)
- Full log history via dashboard (Phase 6 uses `GET /api/activity-logs`)
- Embedding `delayed_tax` hits in the dashboard payload
- Active goals on dashboard (DESIGN §Dashboard E — Goals screen scope)
- Review milestone auto-detection (`is_review_milestone_hit`, Phase 8 F3.2)
- `GET /api/mcp/context` (Phase 8 B6.1)
- Log pagination (future; dashboard fixed 30-day window for now)
- Auth / multi-user

---

## Phase 6 dependency (for planner awareness)

Phase 6 ticket **F1.3** must be extended to:
- Fetch full log history via `GET /api/activity-logs` (not from dashboard `logs`)
- Map `recovery_streaks` when compliance UI is wired (field is new vs current hook)

---

## Verification (phase complete)

```bash
make test   # includes test_dashboard_service.py + test_dashboard_api.py
make lint
curl "http://localhost:8000/api/dashboard?as_of=2026-05-25"  # after seed + compose up
```

Expected: valid JSON with all B5.1 keys; `cls-foot` class status matches load
summary for the same `as_of`; integration tests green.

---

**Status:** `SIGNED OFF` — Phase 5 ticket set ready for Test Writer on **B5.1**.
