# Phase 4 — Load Engine Tickets
*Source: `plans/TRD.md` §7 Phase 4, `plans/PRD.md` §4 F1/F4/F5, `DESIGN.md` §Load Calculation, `docs/api-map.md`, `export/src/lib/engine.ts`, `export/src/lib/load.ts` | Date: 2026-05-27*

## Planning assumptions locked for this ticket set

- Phase 0–3 are complete on `main`. Reuse FastAPI app factory, SQLModel models,
  Alembic schema, session dependency, Phase 2/3 CRUD services, route-test
  fixtures, and `LOCAL_USER_ID` scoping.
- Phase 4 is backend-only: pure load-engine functions plus three load routes.
  Dashboard aggregation (Phase 5), frontend (Phase 6+), review-milestone
  auto-detection (Phase 8), and MCP stub remain out of scope.
- All work lands on branch `feat/phase-4-load-engine`.
- API JSON for Phase 4 responses and request bodies uses **snake_case**, matching
  Phase 3 CRUD (e.g. `activity_class_id`, `next_safe_date`, `rule_id`).
- `as_of` defaults to server-local `date.today()` on load routes; callers may
  override with `?as_of=YYYY-MM-DD` (summary, delayed-tax) or the same field in
  the check-violations body when supplied.
- When no active training block exists, load routes return **HTTP 200** with
  neutral/empty computed payloads (not `404`). **Summary** and **check-violations**
  treat every class as safe, return empty violation lists, and set weekly progress
  to `[]`. **Delayed-tax** still runs the proactive scan (no block required):
  `elevated_load` and `symptom_marker` hits can appear from logs and check-ins;
  `rest_debt` and block-scoped rules need an active block and stay empty without
  one.
- `compute_class_statuses` ports `export/src/lib/engine.ts` behavior exactly
  (rest + weekly load cap only). **`check_violations` evaluates all five rule
  types** (owner confirmed 2026-05-27).
- Parity with TypeScript is proven via **Python unit tests** with fixtures derived
  from `export/src/lib/mockData.ts` at `as_of=2026-05-25`. No TS runner in CI.
- **Delayed-tax** combines two layers (owner confirmed 2026-05-27):
  1. **Proactive** — always scan the **last 7 days** through `as_of` for
     `elevated_load` (daily load `>=` 14-day **median** baseline) and `rest_debt`
     (under-rested activity days).
  2. **Symptom-linked** — when the user **records** elevated pain or flare in that
     window (`pain_level > 3`, `has_flare_up`, or a `flare_up_incident`), attribute
     likely causes: isolated return-after-rest (**acute**) and/or earlier load/rest
     stress in the same window (**contributing**).
- Pain/flare are **not** required to run the scan; they add attribution hits when
  present. Feeling fine earlier does not rule out logged symptoms as factors.
- **Baseline** for load comparison = **14 calendar days** immediately before the
  7-day risk window (per performance class daily load). Use **median only** (not
  mean) for the top-50% threshold.
- Product docs reconciled 2026-05-27: `plans/TRD.md`, `plans/PRD.md`, `DESIGN.md`,
  `docs/api-map.md`, `README.md`, `plans/milestone-architecture.md`.
- No new tables or Alembic revisions in Phase 4 unless a test exposes a Phase 1
  schema bug.
- Business logic stays in `services/`; routers translate HTTP only.
- Register load routes in `backend/app/main.py` under `/api/load`.

## Ticket ordering rationale

B4.1 establishes pure `load_engine.py` functions and unit tests. Routes depend on
those functions, so B4.1 lands first.

B4.2 wires summary and dry-run violation checks — the highest-traffic paths for
logging and dashboard prep.

B4.3 adds delayed-tax scanning on top of the same date/load primitives from B4.1.

---

## B4.1 — Pure load engine module (engine.ts / load.ts parity)

**Type:** backend
**Branch:** `feat/phase-4-load-engine`
**Depends on:** Phase 1 models; Phase 2 activity/log/check-in data; Phase 3 rules/targets

### Acceptance criteria
- Tests in `backend/app/tests/test_load_engine.py` are written before
  `backend/app/services/load_engine.py`. They should fail first because the
  module is missing.
- `backend/app/services/load_engine.py` implements pure functions with no FastAPI
  or SQLModel imports. Accept plain dataclasses, typed dicts, or Pydantic models
  defined in `backend/app/schemas/load_engine.py` for inputs/outputs.
- Port ISO date helpers from `export/src/lib/load.ts` (`parse_iso_date`,
  `format_iso_date`, `add_days`, `diff_days`, `each_day`) with UTC calendar-date
  semantics matching the TypeScript implementation.
- Port load primitives from `load.ts`:
  - `DEFAULT_RPE = 5`
  - `log_load(log) -> float` using `volume_value * (rpe ?? 5)`
  - `daily_load(logs, date) -> float`
  - `rolling_load(logs, as_of, window_days) -> float` (inclusive window ending
    on `as_of`)
- Port engine functions from `engine.ts` with behavior matching the reference
  (field names internally may be snake_case; math must match):
  - `compute_class_statuses(as_of, activity_classes, activities, logs, rules)`
  - `compute_daily_safety_scores(start_date, end_date, logs, check_ins, incidents)`
  - `compute_suggestions(class_statuses, activities, activity_classes)`
  - `compute_weekly_progress(weekly_targets, activity_classes, activities, logs,
    period_start, period_end)`
  - `compute_clean_streak(logs)`
  - `compute_load_series(class_id, activities, logs, start_date, end_date,
    window_days=7)`
- `check_violations(activity_id, volume_value, rpe, activities, logs, rules, as_of)`
  returns a list of violation snapshots. It is a **dry-run**: it does not mutate
  logs. Evaluate **all enabled rules** on the active block relevant to the
  activity:
  - `rest_between_class` — same day-gap logic as `useMilestoneEngine.ts`
    (`days_since <= threshold` → caution/danger split at `days_since <= 1`).
  - `weekly_load_cap` — projected rolling load including the hypothetical log;
    `>= threshold` → danger; `>= 0.8 * threshold` → caution.
  - `frequency_limit` — count class logs in `[as_of - (window_days-1), as_of]`
    plus one if the hypothetical log would fall in-window; `>= threshold` →
    danger; `>= 0.8 * threshold` → caution.
  - `consecutive_day_limit` — count consecutive calendar days ending on `as_of`
    with ≥1 class log; include the hypothetical log on `as_of` when simulating;
    `>= threshold` → danger (no caution band unless tests prove prototype
    behavior — default danger only).
  - `weekly_activity_count` — `activity_class_id` on the rule must be `null`;
    count **performance** activity logs (via activity `type == "performance"`)
    in the rule window plus the hypothetical log when applicable; `>= threshold`
    → danger; `>= 0.8 * threshold` → caution.
- Recovery-type activities are excluded from `weekly_activity_count` tallies.
- Unknown `activity_id` returns `[]`.
- `detect_delayed_tax(logs, activities, activity_classes, rules, check_ins,
  incidents, as_of, risk_window_days=7, baseline_days=14, pain_threshold=3,
  acute_rest_days=14, acute_symptom_lag_days=3)` implements **proactive +
  symptom-linked** delayed-tax:
  - **Risk window** (inclusive): `[as_of - (risk_window_days - 1), as_of]`.
  - **Baseline window** (inclusive): the `baseline_days` calendar days immediately
    before the risk window starts (i.e. ending the day before
    `as_of - (risk_window_days - 1)`).
  - Scope: **performance** activity classes only (via activity `type`).
  - For each class, build daily load series for baseline and risk windows (0 on
    days with no logs).
  - **Proactive — `elevated_load`:** for each date `d` in the risk window with
    `daily_load(class, d) > 0`, emit when
    `daily_load(class, d) >= median(baseline daily loads for that class)`.
    Include `hit_type`, `activity_class_id`, `contributing_date`, `daily_load`,
    `baseline_median_daily_load`, and `message`. Do **not** require mean in the
    response (median is the comparison).
  - **Proactive — `rest_debt`:** for each date `d` in the risk window with at least
    one class log, when an enabled `rest_between_class` rule exists, find previous
    class log date `prev`. When `days_between(prev, d) <= threshold_value`, emit
    with `days_since_last_session`, `required_rest_days`, `daily_load` on `d`,
    `cumulative_load` (sum class daily loads `prev`→`d` inclusive), and `message`.
  - **Symptom signals** in the risk window (each may produce attribution hits):
    - `daily_check_ins` with `pain_level > pain_threshold` and/or `has_flare_up`
    - `flare_up_incidents` (any severity; use `incident_date` as symptom date)
    - De-dupe: if check-in and incident share the same date, prefer one
      `symptom_marker` per date (check-in wins when both exist).
  - **`symptom_marker` hit:** anchor for a user-recorded symptom on `symptom_date`
    with `symptom_source` (`check_in_pain` | `check_in_flare` | `flare_incident`),
    optional `pain_level`, `check_in_id` / `incident_id`, and short `message`.
  - **`acute_attribution` hit:** for a symptom on date `S`, when a performance
    class had **no class logs for `acute_rest_days` consecutive days** immediately
    before the **last** class activity date `D` on or before `S`, and `S` falls
    within `acute_symptom_lag_days` after `D` (calendar-day gap `0..lag`), emit a
    **primary** attribution to `(class, D)` with `symptom_date`, `primary=true`,
    `daily_load` on `D`, and message e.g. “Likely caused by returning after
    extended rest.” If `flare_up_incidents.activity_class_id` is set, prefer that
    class when it matches an qualifying acute pattern.
  - **`symptom_contributor` hit:** for symptom date `S`, when proactive
    `elevated_load` or `rest_debt` hits exist in `[S - (risk_window_days - 1), S]`
    (same 7-day lookback ending on symptom day) and **no** `acute_attribution`
    applies for that class (or as additional co-factors when acute applies to a
    different class), emit contributors linking `symptom_date` to existing
    proactive stress (`contributing_date`, `contributor_hit_type`, loads/metrics).
    Supports “flare after a heavy week” alongside “flare after one run post-rest.”
  - De-duplicate proactive hits: at most one per
    `(activity_class_id, contributing_date, hit_type)` without `symptom_date`;
    symptom-linked rows may repeat the same contributing date with different
    `symptom_date`.
  - Sort: `symptom_date` descending (nulls last for proactive-only), then
    `contributing_date` descending, then `activity_class_id`.
- Unit tests include at least one fixed fixture per exported function, with
  `as_of="2026-05-25"` and log/rule slices derived from `mockData.ts` / seed
  IDs (`cls-foot`, `act-walk`, `rule-rest-foot`, `rule-cap-foot`, etc.).
- Document expected numeric outputs in test comments where helpful (e.g. rolling
  load for a known log subset).
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reference `export/src/lib/engine.ts`, `export/src/lib/load.ts`, and
  `export/src/hooks/useMilestoneEngine.ts` (`checkViolations` for rest/cap only).
- Reuse `backend/app/schemas/enums.py` rule-type strings where route layers need
  them; keep engine layer stringly-typed or share the same literals.
- Do not duplicate recovery-streak logic from `services/recovery_targets.py`.

### Recommended test scope
- Pure unit tests only in `test_load_engine.py` (no HTTP).
- Build minimal in-memory lists of dicts/dataclasses; do not require SQLite for
  core math.
- Include edge cases: empty logs, missing RPE, disabled rules, cross-class rule
  with `activity_class_id=None`, zero baseline for delayed tax.

### Edge cases to handle
- `window_days <= 0` on rolling load returns `0`.
- `weekly_targets` with `target_unit == "sessions"` counts log rows, not volume.
- `compute_weekly_progress` uses `neutral` state when `rounded == 0`.
- Class with no history returns safe status per engine.ts.
- Delayed tax with empty baseline (all zeros) and positive risk-window load may
  still emit `elevated_load` (median 0 → any positive day qualifies).
- No enabled `rest_between_class` rule ⇒ no `rest_debt` hits for that class.
- Symptom on `S` with only acute pattern (14d rest + single return) emits
  `acute_attribution` and may omit `symptom_contributor` for that class.
- `pain_level` exactly 3 does not qualify (`> pain_threshold` with default 3).
- Hypothetical log on `as_of` with `volume_value=0` or `rpe=0` skips load-cap
  projection (match prototype: only project when both > 0).

### Files to create / modify
- `backend/app/schemas/load_engine.py` (DTOs for engine I/O if needed)
- `backend/app/services/load_engine.py`
- `backend/app/tests/test_load_engine.py`

---

## B4.2 — Load summary and check-violations routes

**Type:** backend
**Branch:** `feat/phase-4-load-engine`
**Depends on:** `B4.1`; Phase 2/3 data services

### Acceptance criteria
- Tests in `backend/app/tests/test_load_api.py` are written before production
  router/service code. They should fail first because `/api/load` routes are
  missing.
- `backend/app/services/load_queries.py` (or equivalent name) loads local data,
  resolves `as_of` (default `date.today()`), fetches the active training block
  when present, and calls `load_engine` functions. No business math in routers.
- `GET /api/load/summary`:
  - Optional query `as_of=YYYY-MM-DD` (default server-local today).
  - When an active block exists: response includes snake_case fields:
    - `as_of`
    - `class_statuses` — output of `compute_class_statuses` using block rules
    - `suggestions` — output of `compute_suggestions`
    - `weekly_progress` — `compute_weekly_progress` with
      `period_start=active_block.start_date`, `period_end=as_of`, block weekly
      targets, all local classes/activities/logs
  - When no active block: HTTP `200` with `as_of`, `class_statuses` (all classes
    safe/neutral reasons), `suggestions` (safe defaults from activities), and
    `weekly_progress=[]`.
  - Uses all local activity classes, active activities, and logs with
    `logged_date <= as_of`.
- `POST /api/load/check-violations`:
  - Request body (snake_case): `activity_id`, `volume_value`, `rpe`; optional
    `as_of` (default server-local today).
  - Response: `{ "violations": [ ... ] }` each item with `rule_id`, `rule_type`,
    `message`, `severity` (`caution` | `danger`).
  - Dry-run only — no database writes.
  - Uses enabled rules from the active block when present; returns `{ "violations": [] }`
    when no active block.
  - Missing activity returns `{ "violations": [] }`.
- Invalid `as_of` format returns HTTP `422`.
- `backend/app/routers/load.py` registers routes; `backend/app/main.py` includes
  the router.
- Route tests use `httpx.AsyncClient`, temporary SQLite, and `get_session`
  override; seed via existing test helpers.
- At least one integration test calls `GET /api/load/summary?as_of=2026-05-25`
  against seed-shaped data and asserts a known `cls-foot` status (e.g. safe with
  expected reason substring).
- At least one integration test proves `POST /api/load/check-violations` flags
  `rest_between_class` and `frequency_limit` when rules and logs are seeded.
- `make test` and `make lint` pass before commit.

### Reuse / extend
- Reuse `training_blocks.get_active_block` (or equivalent) from Phase 3.
- Reuse list/query patterns from `services/activity_logs.py`, `services/rules.py`,
  `services/weekly_targets.py`.
- Call `load_engine` from B4.1; do not reimplement formulas in the query service.

### Recommended test scope
- API integration tests with temporary DB.
- Use `?as_of=2026-05-25` for deterministic assertions; separate test for default
  `as_of` may freeze `date.today()` via dependency injection or monkeypatch if
  already used elsewhere.

### Edge cases to handle
- Inactive activities still appear in suggestions only when `is_active` (match
  engine.ts filter).
- Logs after `as_of` are excluded from all calculations.
- Block with rules disabled (`enabled=false`) are ignored.
- Empty database still returns `200` summary with safe/neutral defaults.

### Files to create / modify
- `backend/app/schemas/load.py` (HTTP request/response models)
- `backend/app/services/load_queries.py`
- `backend/app/routers/load.py`
- `backend/app/main.py`
- `backend/app/tests/test_load_api.py`

---

## B4.3 — Delayed-tax route (proactive scan + symptom attribution)

**Type:** backend
**Branch:** `feat/phase-4-load-engine`
**Depends on:** `B4.1`, `B4.2`

### Acceptance criteria
- Tests for delayed-tax behavior are added to `backend/app/tests/test_load_api.py`
  (or `test_load_engine.py` for pure hits) **before** route completion.
- `GET /api/load/delayed-tax`:
  - Optional query `as_of=YYYY-MM-DD` (default server-local today).
  - Optional query `risk_window_days` (default `7`, positive integer).
  - Optional query `baseline_days` (default `14`, positive integer).
  - Optional query `pain_threshold` (default `3`; check-ins qualify when
    `pain_level > pain_threshold`).
  - Loads local activity logs, `daily_check_ins`, `flare_up_incidents`, and rules
    when an active block exists.
  - Returns HTTP `200` with snake_case payload:
    - `as_of`
    - `risk_window_days`
    - `baseline_days`
    - `pain_threshold`
    - `hits`: list from `detect_delayed_tax` (may be empty)
  - Each hit includes at least: `hit_type`, `message`, and fields per B4.1.
    Hit types: `elevated_load`, `rest_debt`, `symptom_marker`, `acute_attribution`,
    `symptom_contributor`.
  - Uses performance-class loads for attribution; recovery classes excluded from
    load math (symptoms may still be recorded).
  - **`elevated_load`** / **`symptom_marker`** do not require an active block.
  - **`rest_debt`** requires enabled block rules when present.
- Integration test: foot-load logs + 14-day baseline → at least one `elevated_load`
  (no symptom required).
- Integration test: back-to-back logs + `rest_between_class` → `rest_debt`.
- Integration test: check-in with `pain_level=8` after 14+ days without foot-load
  logs then one run → `acute_attribution` with `primary=true` for that class.
- Integration test: check-in with flare after a week with `elevated_load` days →
  `symptom_marker` plus `symptom_contributor` rows (and no `acute_attribution`
  when rest gap was not long enough).
- Integration test: `flare_up_incident` in window produces `symptom_marker` with
  `symptom_source=flare_incident`.
- Integration test: empty logs and no symptoms → `hits=[]`.
- Invalid `risk_window_days`, `baseline_days`, or `as_of` returns HTTP `422`.
- `make test` and `make lint` pass before commit.

### Reuse / extend
- Reuse `load_engine.detect_delayed_tax` from B4.1.
- Reuse `load_queries` data-loading helpers from B4.2 where practical.

### Edge cases to handle
- Same class/date may return multiple rows (`elevated_load` + `rest_debt`, or plus
  symptom-linked types).
- `rest_debt` on first-ever class log in window (no `prev` in history) is skipped.
- Logs or symptoms after `as_of` are excluded.
- Acute path uses **class-scoped** rest (no foot-load logs for 14 days, not global
  rest across all classes).

### Files to create / modify
- `backend/app/schemas/load.py` (extend response models)
- `backend/app/services/load_queries.py`
- `backend/app/routers/load.py`
- `backend/app/tests/test_load_api.py`

---

## Owner decisions resolved

- **Rule coverage:** `check_violations` implements all five rule types; class
  statuses remain engine.ts parity (rest + load cap only) — owner confirmed
  2026-05-27.
- **JSON:** snake_case on Phase 4 load endpoints — owner confirmed 2026-05-27.
- **Parity tests:** Python unit tests with `mockData.ts`-derived fixtures only —
  owner confirmed 2026-05-27.
- **`as_of`:** server-local today default with optional override on summary,
  check-violations body, and delayed-tax — owner confirmed 2026-05-27.
- **Weekly progress period:** active block `start_date` through `as_of` inclusive
  when a block is active — owner confirmed 2026-05-27.
- **No active block:** load routes return `200` with neutral/empty computed data —
  owner confirmed 2026-05-27.
- **Branch:** `feat/phase-4-load-engine` for all B4.x tickets — owner confirmed
  2026-05-27.
- **Delayed-tax algorithm:** proactive 7-day + 14-day baseline (median top-50%),
  `rest_debt`, plus symptom attribution (`pain_level > 3`, flare, incidents) with
  acute return-after-rest and contributing stress — owner confirmed 2026-05-27.

---

## Delayed-tax methodology (locked)

**Product point:** Load can accrue while you still feel fine; pain/flare often
shows up later. Delayed-tax supports **both** early warning and **explain what
happened** when you do log symptoms.

**Windows**
- **Risk window:** last **7** calendar days through `as_of` (inclusive).
- **Baseline:** **14** calendar days immediately before the risk window (per class
  daily load; zero on rest days).

### Layer A — Proactive (always runs)

**`elevated_load`** — day in the top 50% vs your baseline: `daily_load >= median`
of the 14 baseline days (median only, not mean).

**`rest_debt`** — activity on a day that breaks `rest_between_class`, with
cumulative load across the under-rested stretch.

Runs even when you have not logged pain or flare. Surfaces building risk early.

### Layer B — Symptom-linked (when you record it)

Qualifying signals in the risk window:
- Check-in: `pain_level > 3` and/or `has_flare_up`
- Any `flare_up_incident`

**`symptom_marker`** — documents that you flagged pain/flare on that date (a
recorded factor, not an automatic scan trigger).

**`acute_attribution`** — “it was probably that return session”:
- For symptom date `S`, last class activity `D` on or before `S`
- **≥ 14 consecutive days** with no logs in that class before `D`
- Symptom within **3 days** after `D` (`0..3` calendar-day gap)
- Marked `primary=true` (e.g. two weeks off, one run, flare logged)

**`symptom_contributor`** — “earlier stress also mattered”:
- Links proactive `elevated_load` / `rest_debt` in the 7 days before `S` to that
  symptom when accumulation likely contributed
- Coexists with acute when both apply (heavy week **and** a hard return); acute
  can dominate for one class while contributors explain others

**Not excluded:** logged pain and flare are first-class inputs for attribution.
**Not required:** the proactive layer still runs without symptoms.

**UI intent:** Warn before symptoms when possible; when you do log pain/flare,
show plausible causes (isolated return vs stacked load), not a single simplistic
rule.

---

**Status:** `SIGNED OFF` — Phase 4 ticket set ready for Test Writer on **B4.1**.
