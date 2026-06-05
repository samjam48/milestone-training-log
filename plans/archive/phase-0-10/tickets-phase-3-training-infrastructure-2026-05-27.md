# Phase 3 — Training Infrastructure Tickets
*Source: `plans/TRD.md` §7 Phase 3, `plans/PRD.md` §4 F5-F6, `docs/api-map.md`, `docs/database-schema.md`, `DESIGN.md` | Date: 2026-05-27*

## Planning assumptions locked for this ticket set

- Phase 0, Phase 1, and Phase 2 are complete. Reuse the existing FastAPI app
  factory, SQLModel models, Alembic-created schema, database session dependency,
  Phase 2 CRUD patterns, and route-test fixtures.
- Phase 3 covers training infrastructure only: `training_blocks`, `rules`,
  `weekly_targets`, `recovery_targets`, and `goals`. Load-engine calculations,
  dashboard aggregation, review-milestone auto-detection, and frontend work remain
  out of scope.
- Use one service module and one router module per resource group. Routers
  translate HTTP concerns only; services own persistence, parent validation,
  filtering, lifecycle rules, and not-found handling.
- Keep `user_id` server-owned on top-level rows (`training_blocks`, `goals`).
  Request bodies must not accept `user_id`. Child rows (`rules`,
  `weekly_targets`, `recovery_targets`) inherit ownership through
  `training_block_id`; validate the parent block belongs to the local user.
- Use snake_case JSON field names for backend API payloads in Phase 3, matching
  SQLModel field names and `docs/api-map.md`.
- Duplicate client-supplied IDs return HTTP `409 Conflict` across Phase 3 create
  routes, matching Phase 2.
- Timestamps may be supplied by service helpers when creating or updating rows.
  Request schemas should not require clients to send `created_at` or
  `updated_at`.
- `is_review_milestone_hit` is server-owned in Phase 3. Read responses include
  it; create/patch request schemas do not accept it. Auto-detection belongs to
  Phase 8 (`F3.2`).
- Do not add schema fields, tables, or Alembic revisions in Phase 3 unless a
  test uncovers a Phase 1 schema bug.
- Use focused route/service integration tests with a temporary SQLite database
  and FastAPI dependency override for `get_session`. Do not use the persistent
  `data/milestone.db` in tests.
- Register static routes such as `/api/training-blocks/active` before dynamic
  `/{block_id}` routes so `"active"` is not captured as an ID.
- **Single-active-block invariant:** at most one local `training_blocks` row may
  have `status="active"` at a time. When a block becomes active through create
  or patch, any previously active local block is moved to `status="completed"`
  (owner confirmed 2026-05-27).
- **No active block:** `GET /api/training-blocks/active` returns HTTP `404` when
  no local block is active.
- **Block create default:** omitted `status` defaults to `"active"` and triggers
  the single-active invariant.
- **Recovery streak updates:** when an activity log is created, updated, or
  deleted for a `recovery`-type activity, recalculate streaks for matching
  recovery targets on the current active block only. See B3.4 for the locked
  algorithm.

## Ticket ordering rationale

B3.1 establishes training-block CRUD, the `/active` shortcut, and the
single-active-block invariant. Child resources depend on an existing block, so
this ticket lands first.

B3.2 depends on B3.1 because rules are scoped to a training block and need the
block CRUD fixture patterns plus parent-block validation.

B3.3 depends on B3.1 for the same parent-block reasons and adds weekly-target
uniqueness on `(training_block_id, activity_class_id)`.

B3.4 depends on B3.1 and Phase 2 activity logging. It adds recovery-target CRUD
and extends the activity-log service to recalculate compliance streaks when
recovery activities are logged.

B3.5 is last because goals are independent of block child tables, but training
blocks may optionally reference them through `related_goal_id`. Keeping goals
after block CRUD lets B3.1 tests use `related_goal_id=null` while B3.5 proves
goal CRUD and optional block linkage together.

---

## B3.1 — TrainingBlock CRUD API with single-active constraint

**Type:** backend
**Branch:** `feat/phase-3-training-infrastructure`
**Depends on:** Phase 1 models/migrations; Phase 2 CRUD patterns complete

### Acceptance criteria
- Tests for the TrainingBlock API are written before production router/service
  code. They should fail first because `/api/training-blocks` routes are
  missing.
- `backend/app/schemas/training_blocks.py` defines typed create, patch, and read
  schemas.
- Create request fields include `id`, `name`, `start_date`, optional `end_date`,
  optional `status`, optional `related_goal_id`, and optional `notes`.
- Create requests do not accept `user_id`, `is_review_milestone_hit`,
  timestamps, or embedded child collections.
- Omitted `status` defaults to `"active"`.
- Patch requests allow partial updates to `name`, `start_date`, `end_date`,
  `status`, `related_goal_id`, and `notes`.
- Read responses include `id`, `name`, `start_date`, `end_date`, `status`,
  `related_goal_id`, `notes`, `is_review_milestone_hit`, `created_at`, and
  `updated_at`; they do not expose `user_id`.
- `backend/app/services/training_blocks.py` owns all TrainingBlock database
  access, ordering, lifecycle transitions, optional goal FK validation, and the
  single-active-block invariant.
- `GET /api/training-blocks` returns all local blocks ordered by `start_date`
  descending, then `id` ascending.
- `GET /api/training-blocks/active` returns the one local block with
  `status="active"` when present.
- `GET /api/training-blocks/active` returns HTTP `404` when no active block
  exists.
- `POST /api/training-blocks` creates one block with `user_id = "local"` and
  returns status `201`.
- Creating a block with `status="active"` (explicit or default) sets any
  previously active local block to `status="completed"` in the same transaction.
- `PATCH /api/training-blocks/{block_id}` updates only fields present in the
  request body, including setting nullable fields to `null` when explicitly
  supplied.
- Patching a block to `status="active"` applies the same single-active invariant
  as create.
- If `related_goal_id` is supplied on create or patch, the service validates
  that the goal exists for the local user; missing goals return a stable client
  error.
- Missing block IDs return HTTP `404` with a stable error detail.
- Duplicate IDs return HTTP `409 Conflict`.
- The router is registered in `backend/app/main.py`.
- Route tests use `httpx.AsyncClient` with `ASGITransport`, a temporary SQLite
  database, and a dependency override for `get_session`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/block.py::TrainingBlock`.
- Reuse `backend/app/models/goal.py::Goal` only for optional FK validation once
  goals exist; B3.1 tests may seed goals directly through the session helper when
  validating `related_goal_id`.
- Reuse Phase 2 route-test database fixture patterns from
  `backend/app/tests/test_activity_classes_api.py`.
- Reuse duplicate-ID, not-found, and timestamp patterns from Phase 2 services.

### Recommended test scope
- API-level integration tests are the primary coverage.
- Include explicit tests for: first active block creation, second active block
  superseding the first, `/active` success and `/active` empty, and invalid
  `related_goal_id`.
- Do not mock SQLModel sessions for the main behavior.

### Edge cases to handle
- Empty database returns an empty list from `GET /api/training-blocks`, not
  `404`.
- Patch with an empty JSON object is allowed and returns the unchanged row.
- Patching a block from `active` to `completed` or `archived` does not auto-promote
  another block to active.
- A block may remain active with a null `end_date`.
- `is_review_milestone_hit` stays `false` on create unless seeded directly in
  tests.

### Files to create / modify
- `backend/app/schemas/training_blocks.py`
- `backend/app/services/training_blocks.py`
- `backend/app/routers/training_blocks.py`
- `backend/app/main.py`
- `backend/app/tests/test_training_blocks_api.py`

---

## B3.2 — Rule CRUD API under training blocks

**Type:** backend
**Branch:** `feat/phase-3-training-infrastructure`
**Depends on:** `B3.1`

### Acceptance criteria
- Tests for the Rule API are written before production router/service code. They
  should fail first because rule routes are missing.
- `backend/app/schemas/rules.py` defines typed create, patch, and read
  schemas.
- Create request fields include `id`, `activity_class_id`, `rule_type`,
  `threshold_value`, `window_days`, and optional `enabled`.
- Create requests do not accept `training_block_id` in the body; the parent
  block comes from the URL path.
- Create requests do not accept timestamps.
- `enabled` defaults to `true` when omitted.
- Patch requests allow partial updates to `activity_class_id`, `rule_type`,
  `threshold_value`, `window_days`, and `enabled`.
- Read responses include `id`, `training_block_id`, `activity_class_id`,
  `rule_type`, `threshold_value`, `window_days`, `enabled`, `created_at`, and
  `updated_at`.
- `activity_class_id` may be null in read responses for cross-class rules such as
  `weekly_activity_count`.
- `backend/app/services/rules.py` owns all Rule database access, parent-block
  validation, optional class validation, and delete behavior.
- `GET /api/training-blocks/{block_id}/rules` returns rules for that local block
  ordered by `rule_type` ascending, then `id` ascending.
- `GET /api/training-blocks/{block_id}/rules` returns HTTP `404` when the parent
  block does not exist for the local user.
- `POST /api/training-blocks/{block_id}/rules` creates one rule under the block
  and returns status `201`.
- If `activity_class_id` is supplied, the service validates that the class
  exists for the local user.
- `PATCH /api/rules/{rule_id}` updates only present fields, including setting
  `activity_class_id` to `null` when explicitly supplied.
- `DELETE /api/rules/{rule_id}` removes the row and returns status `204` with
  no response body.
- Missing rule IDs return HTTP `404` for patch and delete.
- Duplicate IDs follow the duplicate-ID pattern from Phase 2/3 create routes.
- Known `rule_type` strings documented in `export/src/types.ts` are accepted as
  plain strings in Phase 3; do not add schema-level enum enforcement unless docs
  are updated in the same ticket.
- The router is registered in `backend/app/main.py`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/block.py::Rule`.
- Reuse `ActivityClass` fixture helpers from Phase 2 tests.
- Reuse TrainingBlock fixture helpers from `B3.1` tests.
- Reuse shared not-found and duplicate-ID patterns from earlier tickets.

### Recommended test scope
- Use API integration tests with real temporary SQLite data.
- Cover class-scoped rules, cross-class rules with null `activity_class_id`, rule
  delete, and parent-block not-found behavior.
- Avoid duplicating training-block lifecycle tests here.

### Edge cases to handle
- Empty rule list returns `[]`, not an error.
- Patch with an empty JSON object is allowed and returns the unchanged row.
- Rules remain readable after their parent block is moved to `completed` or
  `archived`.
- Invalid/missing parent block on list/create returns `404`, not `409`.
- `threshold_value` and `window_days` remain required on create; patch may
  update them independently.

### Files to create / modify
- `backend/app/schemas/rules.py`
- `backend/app/services/rules.py`
- `backend/app/routers/rules.py`
- `backend/app/main.py`
- `backend/app/tests/test_rules_api.py`

---

## B3.3 — WeeklyTarget CRUD API under training blocks

**Type:** backend
**Branch:** `feat/phase-3-training-infrastructure`
**Depends on:** `B3.1`

### Acceptance criteria
- Tests for the WeeklyTarget API are written before production router/service
  code. They should fail first because weekly-target routes are missing.
- `backend/app/schemas/weekly_targets.py` defines typed create, patch, and
  read schemas.
- Create request fields include `id`, `activity_class_id`, `target_value`, and
  `target_unit`.
- Create requests do not accept `training_block_id` in the body; the parent
  block comes from the URL path.
- Create requests do not accept timestamps.
- Patch requests allow partial updates to `activity_class_id`, `target_value`,
  and `target_unit`.
- Read responses include `id`, `training_block_id`, `activity_class_id`,
  `target_value`, `target_unit`, `created_at`, and `updated_at`.
- `backend/app/services/weekly_targets.py` owns all WeeklyTarget database
  access, parent-block validation, class validation, duplicate-pair handling,
  and update behavior.
- `GET /api/training-blocks/{block_id}/weekly-targets` returns targets for that
  local block ordered by `activity_class_id` ascending, then `id` ascending.
- `GET /api/training-blocks/{block_id}/weekly-targets` returns HTTP `404` when
  the parent block does not exist for the local user.
- `POST /api/training-blocks/{block_id}/weekly-targets` creates one target and
  returns status `201`.
- Creating a second target for the same `(training_block_id, activity_class_id)`
  pair returns HTTP `409 Conflict`.
- `activity_class_id` must reference an existing local activity class.
- `PATCH /api/weekly-targets/{target_id}` updates only present fields.
- Missing target IDs return HTTP `404`.
- Duplicate IDs follow the duplicate-ID pattern from earlier Phase 3 create
  routes.
- No delete route is added in Phase 3 unless `docs/api-map.md` is explicitly
  updated and owner-approved.
- The router is registered in `backend/app/main.py`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/block.py::WeeklyTarget`.
- Reuse TrainingBlock and ActivityClass fixture helpers from earlier tickets.
- Reuse shared not-found and duplicate-ID patterns.

### Recommended test scope
- Use API integration tests with temporary SQLite data.
- Include duplicate `(block, class)` pair coverage and parent-block not-found
  coverage.
- Do not add load-engine progress calculations here; those belong to Phase 4/5.

### Edge cases to handle
- Empty target list returns `[]`, not an error.
- Patch with an empty JSON object is allowed and returns the unchanged row.
- Patching `activity_class_id` to another class is allowed when the resulting pair
  remains unique.
- `target_value` must remain numeric and persisted; zero is allowed if product
  accepts it.
- Seed compatibility: do not reject recovery-class weekly targets in Phase 3 even
  though product copy usually treats weekly targets as performance-class volume
  goals.

### Files to create / modify
- `backend/app/schemas/weekly_targets.py`
- `backend/app/services/weekly_targets.py`
- `backend/app/routers/weekly_targets.py`
- `backend/app/main.py`
- `backend/app/tests/test_weekly_targets_api.py`

---

## B3.4 — RecoveryTarget CRUD API and recovery streak updates on activity logs

**Type:** backend
**Branch:** `feat/phase-3-training-infrastructure`
**Depends on:** `B3.1`, Phase 2 `activity_logs` service complete

### Acceptance criteria
- Tests for the RecoveryTarget API and recovery streak side effects are written
  before production router/service code. They should fail first because recovery
  target routes and streak updates are missing.
- `backend/app/schemas/recovery_targets.py` defines typed create and read
  schemas.
- Create request fields include `id`, `activity_id`, `target_frequency`, and
  `frequency_unit`.
- Create requests do not accept `training_block_id` in the body, do not accept
  `current_streak_days`, and do not accept timestamps.
- `frequency_unit` accepts `"daily"` or `"weekly"`.
- Read responses include `id`, `training_block_id`, `activity_id`,
  `target_frequency`, `frequency_unit`, `current_streak_days`, `created_at`,
  and `updated_at`.
- `backend/app/services/recovery_targets.py` owns RecoveryTarget database access,
  parent-block validation, activity validation, duplicate-pair handling, streak
  recalculation helpers, and read/list behavior.
- `GET /api/training-blocks/{block_id}/recovery-targets` returns targets for
  that local block ordered by `activity_id` ascending, then `id` ascending.
- `GET /api/training-blocks/{block_id}/recovery-targets` returns HTTP `404` when
  the parent block does not exist for the local user.
- `POST /api/training-blocks/{block_id}/recovery-targets` creates one target
  with `current_streak_days = 0` and returns status `201`.
- Creating a second target for the same `(training_block_id, activity_id)` pair
  returns HTTP `409 Conflict`.
- `activity_id` must reference an existing local activity with `type="recovery"`.
- Creating a target for a performance activity returns a stable client error.
- No `PATCH` or `DELETE` recovery-target routes are added in Phase 3 unless
  `docs/api-map.md` is explicitly updated and owner-approved.
- `backend/app/services/activity_logs.py` calls the recovery-target streak
  recalculation helper after successful create, patch, and delete when the
  affected activity has `type="recovery"`.
- Streak recalculation considers only recovery targets on the current active
  local training block whose `activity_id` matches the affected recovery
  activity.
- Streak recalculation uses activity logs whose `logged_date` falls within the
  active block's `[start_date, end_date]` window; when `end_date` is null, only
  `start_date` lower bound applies.
- **Locked streak algorithm:**
  - For `frequency_unit="daily"`, `current_streak_days` is the count of
    consecutive calendar days ending on the recalculation date where the number
    of logs for that `activity_id` on that day is `>= target_frequency`.
  - For `frequency_unit="weekly"`, `current_streak_days` is the count of
    consecutive ISO weeks (Monday start) ending on the week containing the
    recalculation date where the number of logs for that `activity_id` in that
    week is `>= target_frequency`.
  - If the ending day/week does not meet the target, `current_streak_days`
    becomes `0`.
- Route and service tests prove streak changes after recovery activity log create,
  patch, and delete without requiring load-engine code.
- Duplicate IDs follow the duplicate-ID pattern from earlier Phase 3 create
  routes.
- The router is registered in `backend/app/main.py`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/block.py::RecoveryTarget`.
- Reuse TrainingBlock and Activity fixture helpers from earlier tickets.
- Extend `backend/app/services/activity_logs.py`; keep streak logic in
  `recovery_targets.py`, not in the router.
- Reuse Phase 2 activity-log route tests as regression coverage when extending
  the service.

### Recommended test scope
- API integration tests for recovery-target list/create validation.
- Service- or route-level tests for streak recalculation using explicit log
  fixtures across consecutive days/weeks.
- Include a test where no active block exists: recovery-target CRUD still works,
  but logging a recovery activity does not fail and simply skips streak updates.

### Edge cases to handle
- Empty recovery-target list returns `[]`, not an error.
- Logging a recovery activity with no matching recovery target is a no-op for
  streak updates.
- Deleting the only log on a streak-breaking day reduces the streak on
  recalculation.
- Moving a log's `logged_date` through patch recalculates streaks for both old
  and new dates via one recalculation anchored to the latest affected date.
- Multiple recovery targets for different activities update independently.
- `target_frequency` less than `1` should fail validation before persistence.

### Files to create / modify
- `backend/app/schemas/recovery_targets.py`
- `backend/app/services/recovery_targets.py`
- `backend/app/services/activity_logs.py`
- `backend/app/routers/recovery_targets.py`
- `backend/app/main.py`
- `backend/app/tests/test_recovery_targets_api.py`
- Extend `backend/app/tests/test_activity_logs_api.py` only if needed for streak
  side-effect coverage

---

## B3.5 — Goal CRUD API with status and timeframe filters

**Type:** backend
**Branch:** `feat/phase-3-training-infrastructure`
**Depends on:** `B3.1`

### Acceptance criteria
- Tests for the Goal API are written before production router/service code. They
  should fail first because `/api/goals` routes are missing.
- `backend/app/schemas/goals.py` defines typed create, patch, and read schemas.
- Create request fields include `id`, `title`, `description`, `target_date`,
  `timeframe`, optional `activity_class_id`, optional `progress_value`, optional
  `progress_target`, optional `progress_unit`, and optional `status`.
- Create requests do not accept `user_id` or timestamps.
- Omitted `status` defaults to `"active"`.
- `timeframe` accepts `"monthly"` or `"quarterly"`.
- Patch requests allow partial updates to `title`, `description`, `target_date`,
  `timeframe`, `activity_class_id`, `progress_value`, `progress_target`,
  `progress_unit`, and `status`.
- Read responses include all persisted goal fields except `user_id`.
- `backend/app/services/goals.py` owns all Goal database access, filtering,
  optional class validation, and update behavior.
- `GET /api/goals` returns local goals ordered by `target_date` ascending, then
  `id` ascending.
- `GET /api/goals?status=<status>` returns only goals with that status.
- `GET /api/goals?timeframe=<timeframe>` returns only goals with that timeframe.
- Combining `status` and `timeframe` applies both filters.
- `POST /api/goals` creates one goal with `user_id = "local"` and returns status
  `201`.
- If `activity_class_id` is supplied, the service validates that the class
  exists for the local user.
- `PATCH /api/goals/{goal_id}` updates only present fields, including setting
  nullable progress/class fields to `null` when explicitly supplied.
- Missing goal IDs return HTTP `404`.
- Duplicate IDs return HTTP `409 Conflict`.
- Integration coverage proves a goal may be linked from
  `PATCH /api/training-blocks/{block_id}` via `related_goal_id`.
- No delete route is added in Phase 3 unless `docs/api-map.md` is explicitly
  updated and owner-approved.
- The router is registered in `backend/app/main.py`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/goal.py::Goal`.
- Reuse ActivityClass fixture helpers from Phase 2 tests.
- Reuse TrainingBlock service/routes from `B3.1` for the optional linkage test.
- Reuse shared not-found, duplicate-ID, and timestamp patterns.

### Recommended test scope
- Use API integration tests with temporary SQLite data.
- Cover list filters, nullable progress fields, nullable `activity_class_id`,
  and block linkage through `related_goal_id`.
- Do not duplicate recovery-streak or load-engine tests here.

### Edge cases to handle
- Empty filtered list returns `[]`, not an error.
- Patch with an empty JSON object is allowed and returns the unchanged row.
- Qualitative goals may omit all progress fields; read responses return nulls.
- Invalid `status` or `timeframe` strings may be accepted as plain strings in
  Phase 3 unless a shared enum strategy is approved.
- Updating a goal linked from an active block does not change block status.

### Files to create / modify
- `backend/app/schemas/goals.py`
- `backend/app/services/goals.py`
- `backend/app/routers/goals.py`
- `backend/app/main.py`
- `backend/app/tests/test_goals_api.py`

---

## Owner decisions resolved

- Phase 3 API payloads stay snake_case.
- Duplicate client-supplied IDs return HTTP `409 Conflict`.
- `GET /api/training-blocks/active` returns `404` when no active block exists.
- New active blocks demote the previous active block to `status="completed"`
  rather than rejecting the request (owner confirmed 2026-05-27).
- Recovery-target streaks are server-calculated only; clients do not PATCH
  `current_streak_days`.
- Recovery streak recalculation (owner confirmed 2026-05-27):
  - `frequency_unit="daily"`: count consecutive calendar days ending on the
    recalculation date where same-day log count is `>= target_frequency`.
  - `frequency_unit="weekly"`: count consecutive ISO weeks (Monday start)
    ending on the current week where same-week log count is `>= target_frequency`.
  - Store the result in `current_streak_days` for both units.
