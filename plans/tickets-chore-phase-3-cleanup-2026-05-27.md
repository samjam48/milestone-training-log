# Chore — Phase 3 API Cleanup (Test Seeds + Status Enums + Service Utilities)
*Source: Phase 3 review deferrals, `docs/database-schema.md`, `export/src/types.ts` | Date: 2026-05-27*

## Planning assumptions locked for this ticket set

- Phase 0–3 backend work is merged or on branch `feat/phase-3-training-infrastructure`.
  This chore refactors and tightens contracts; it does not add Phase 4 load-engine
  behavior or new product endpoints.
- No Alembic revisions unless enum tightening uncovers a Phase 1 schema mismatch
  (unlikely — SQLite stores strings today).
- No changes to business rules in routers; any shared utilities stay thin and
  side-effect free.
- Tightening string fields to `Literal` / enum types is an intentional API contract
  change: invalid values that previously persisted must now return HTTP `422`.
- Valid canonical values must match `docs/database-schema.md` and
  `export/src/types.ts` (snake_case in JSON/API payloads).
- All existing Phase 2 and Phase 3 tests must remain green after refactor; add
  only the small new validation tests described below.
- Do not refactor unrelated Phase 2 resources beyond what is required to adopt
  shared test helpers or shared constants.
- Branch: `chore/phase-3-api-cleanup`

## Ticket ordering rationale

This is a single chore ticket. Work in this order:

1. Shared constants/utilities first — downstream imports depend on them.
2. Shared test seed helpers second — refactor tests to import without changing
   assertions.
3. Schema enum tightening third — update schemas, then add validation tests.
4. Optional patch-null API tests last — lowest risk, fills coverage gaps.

---

## C3.1 — Dedupe test seeds, tighten status enums, extract service utilities

**Type:** backend (chore / refactor)
**Branch:** `chore/phase-3-api-cleanup`
**Depends on:** Phase 3 training infrastructure API complete

### Problem statement

Phase 3 copied the same test fixtures and seed helpers into five new API test
modules (`test_training_blocks_api.py`, `test_rules_api.py`,
`test_weekly_targets_api.py`, `test_recovery_targets_api.py`,
`test_goals_api.py`). Phase 2 tests repeat the same pattern
(`test_activity_classes_api.py`, `test_activities_api.py`, etc.).

Production services also duplicate:

- `LOCAL_USER_ID = "local"` (defined in `activity_classes`, imported elsewhere)
- `_next_updated_at(...)` (copied across most service modules)
- Local `TrainingBlockNotFoundError` / `ActivityClassNotFoundError` in multiple
  child-resource services

Status and timeframe fields accept arbitrary strings at the API boundary even
though the product and schema docs define closed sets. Typos (e.g. `"Active"`)
can persist and break `/api/training-blocks/active` silently.

### Acceptance criteria

#### A. Shared service utilities

- Add `backend/app/services/local_scope.py` (or `backend/app/constants.py` if
  that matches repo direction — pick one, document in module docstring):
  - Export `LOCAL_USER_ID: Literal["local"]` (or `Final[str]`) as the single
    source of truth.
  - Export `next_updated_at(previous: datetime) -> datetime` with the existing
    microsecond-bump behavior used today.
- Update all service modules under `backend/app/services/` to import
  `LOCAL_USER_ID` and `next_updated_at` from the shared module instead of
  defining or importing from `activity_classes`.
- Remove duplicate `_next_updated_at` function bodies from individual services.
- Behavior of create/patch timestamp updates must remain unchanged (existing tests
  prove this).
- Optional within scope: add `backend/app/services/exceptions.py` with shared
  `TrainingBlockNotFoundError`, `ActivityClassNotFoundError`, `GoalNotFoundError`
  only if doing so does not require wide re-exports or circular imports. If
  circular imports appear, keep domain-specific not-found errors local and
  document that decision in the PR summary — do not force a bad abstraction.

#### B. Shared test seed helpers

- Add `backend/app/tests/conftest.py` if absent, or extend it, with:
  - `app_with_test_database` fixture (in-memory SQLite + `get_session` override)
  - `client` fixture (`httpx.AsyncClient` + `ASGITransport`)
- Add `backend/app/tests/helpers/seed.py` (or `tests/fixtures/seed.py`) exporting
  typed seed helpers with stable defaults matching existing tests:
  - `utc_datetime(hour, minute=0) -> datetime`
  - `seed_activity_class(app, *, class_id, name, ...)`
  - `seed_activity(app, *, activity_id, activity_class_id, type, ...)`
  - `seed_training_block(app, *, block_id, name, start_date, status, ...)`
  - `seed_goal(app, *, goal_id, title, ...)`
  - `seed_rule(app, *, rule_id, training_block_id, ...)` — if needed by rules
    tests after refactor
  - `seed_weekly_target(...)`, `seed_recovery_target(...)` — only if still used
    after refactor (inline seed in tests is fine when one-off)
- Refactor these test modules to import shared fixtures/helpers and delete
  duplicated local copies without changing test names or assertion behavior:
  - `test_activity_classes_api.py`
  - `test_activities_api.py`
  - `test_activity_logs_api.py`
  - `test_training_blocks_api.py`
  - `test_rules_api.py`
  - `test_weekly_targets_api.py`
  - `test_recovery_targets_api.py`
  - `test_goals_api.py`
- Phase 2 tests (`test_daily_check_ins_api.py`, `test_flare_up_incidents_api.py`)
  may adopt shared `app_with_test_database` / `client` / `utc_datetime` in this
  ticket if the diff stays mechanical; otherwise leave them and note deferral in
  PR summary — do not balloon scope.
- After refactor, `make test` passes with no dropped tests.

#### C. Status and timeframe enum tightening (API boundary)

Add typed aliases in schema modules using `Literal[...]` (or a small shared
`backend/app/schemas/enums.py` if cleaner):

| Schema module | Field | Allowed values |
| --- | --- | --- |
| `training_blocks.py` | `status` (create + patch) | `active`, `completed`, `archived` |
| `goals.py` | `status` (create + patch) | `active`, `achieved`, `missed`, `paused` |
| `goals.py` | `timeframe` (create + patch) | `monthly`, `quarterly` |
| `rules.py` | `rule_type` (create + patch) | `rest_between_class`, `frequency_limit`, `weekly_load_cap`, `consecutive_day_limit`, `weekly_activity_count` |
| `recovery_targets.py` | `frequency_unit` (create) | `daily`, `weekly` |

Rules:

- Read response schemas may keep `str` fields or use the same Literal types;
  either is acceptable if mypy stays clean.
- Invalid enum values on create/patch return HTTP `422` before persistence.
- Seed data and existing tests use only valid values — no seed script changes
  required unless a seed row violates the new literals (fix if found).
- Do **not** add enum enforcement for activity class `type` or activity `type`
  in this ticket unless required for consistency — that is Phase 2 scope creep.

Add explicit API tests (one parametrized test per resource is enough):

- `test_create_training_block_rejects_invalid_status` — e.g. `"Active"`, `"banana"` → 422
- `test_create_goal_rejects_invalid_status_and_timeframe` — invalid pairs → 422
- `test_create_rule_rejects_invalid_rule_type` — e.g. `"REST_BETWEEN"` → 422
- `test_create_recovery_target_rejects_invalid_frequency_unit` — may already
  exist; extend if only partial coverage

#### D. Patch-null API test parity (optional but in scope)

Add parametrized patch-null rejection tests (422, row unchanged) for resources
that have validators but lack HTTP-level proof:

- `training_blocks`: `name`, `start_date`, `status` must not be explicit JSON
  `null`
- `goals`: `title`, `target_date`, `timeframe`, `status`
- `rules`: `rule_type`, `threshold_value`, `window_days`
- `weekly_targets`: `activity_class_id`, `target_value`, `target_unit`

Follow the existing pattern in `test_activity_classes_api.py` and
`test_activity_logs_api.py`.

#### E. Quality gates

- `make lint` passes (ruff, mypy --strict, radon cc)
- `make test` passes (coverage still ≥80%)
- No new endpoints, no router behavior changes beyond 422 on previously-accepted
  invalid strings

### Reuse / extend

- Reuse existing validator patterns (`reject_explicit_null_for_required_fields`)
  from Phase 2/3 schemas.
- Reuse `export/src/types.ts` as the canonical list of rule types and status
  values when choosing Literal members.
- Do not introduce a new test framework or change pytest config.

### Edge cases to handle

- Empty patch body `{}` must still succeed on all patch routes after enum change.
- Explicit JSON `null` on nullable fields (`end_date`, `related_goal_id`,
  `notes`, `activity_class_id` on rules) must still clear values — do not break
  nullable patch behavior.
- Shared seed helpers must commit through the same session override pattern as
  today (no accidental use of persistent `data/milestone.db`).
- Import cycles: if `services/local_scope.py` imports from models, keep it
  constant-only; timestamp helper must not import SQLModel session code.

### Files to create / modify

**Create (expected):**

- `backend/app/services/local_scope.py`
- `backend/app/tests/conftest.py` (if not present)
- `backend/app/tests/helpers/seed.py` (and `helpers/__init__.py` if needed)
- `backend/app/schemas/enums.py` (optional)

**Modify (expected):**

- All files under `backend/app/services/*.py` that define or import
  `LOCAL_USER_ID` / `_next_updated_at`
- Schema files: `training_blocks.py`, `goals.py`, `rules.py`, `recovery_targets.py`
- Test files listed in section B (+ optional patch-null tests)
- `plans/BACKLOG.md` — remove or check off the resolved follow-up item if one
  was added manually

**Do not modify:**

- Load engine, dashboard, frontend
- Alembic migrations (unless owner approves after unexpected schema mismatch)
- `docs/api-map.md` unless enum tightening changes documented allowed values
  (update in same PR if statuses were previously undocumented as closed sets)

### Recommended test scope

- Primary verification: full `make test` after mechanical refactors.
- Targeted runs during development:
  - `pytest app/tests/test_training_blocks_api.py app/tests/test_goals_api.py -q`
  - `pytest app/tests/test_rules_api.py app/tests/test_recovery_targets_api.py -q`
- New tests should fail before enum changes land (TDD on invalid status strings).

### Manual verification (optional)

After merge, confirm one invalid POST is rejected:

```bash
export API=http://localhost:8084/api

curl -i -X POST "$API/training-blocks" \
  -H "Content-Type: application/json" \
  -d '{"id":"blk-bad","name":"Bad","start_date":"2026-06-01","status":"Active"}'
# expect 422, not 201
```

### Out of scope

- FastAPI `HTTP_422_UNPROCESSABLE_ENTITY` → `HTTP_422_UNPROCESSABLE_CONTENT`
  migration (separate cleanup)
- Multi-user auth or `user_id` scoping changes
- Refactoring all Phase 2 test files if mechanical adoption exceeds ~1 hour
- Frontend camelCase adapters

## Owner decisions resolved

- Invalid status/timeframe/rule_type strings return **422**, not silent persistence.
- Shared module name: prefer `backend/app/services/local_scope.py` for constants
  + timestamp helper unless implementer finds an existing repo convention that
  conflicts — if so, use `app/constants.py` and note in PR.
- Single chore ticket; no split into multiple commits required, but prefer one
  logical commit per section (A→D) if the owner wants easier review.

## Definition of done

1. No duplicated `app_with_test_database` / `_seed_training_block` blocks in
   Phase 3 API test files
2. Single `LOCAL_USER_ID` and `next_updated_at` implementation in services
3. Closed-set validation on block status, goal status/timeframe, rule_type,
   recovery frequency_unit with tests proving 422
4. `make lint` and `make test` green
5. Owner review; owner merges — agent does not push to `main`
