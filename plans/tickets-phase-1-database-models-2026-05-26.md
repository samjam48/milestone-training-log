# Phase 1 — Database Models Tickets
*Source: `plans/TRD.md` §7 Phase 1, `plans/PRD.md` §4, `export/src/types.ts`, `export/src/lib/mockData.ts` | Date: 2026-05-26*

## Planning assumptions locked for this ticket set

These tickets resolve the current planning drift so implementation can proceed
without reopening schema design during test-writing:

- Treat the `plans/TRD.md` phrase "9 tables" as a typo. Phase 1 includes
  **10 tables** because `weekly_targets` is required by later phases and by the
  prototype data model.
- Treat `export/src/types.ts` as the canonical field-name source for persisted
  entities. Backend SQLModel columns use snake_case equivalents of those fields.
- Use **string primary keys and foreign keys** (`TEXT` in SQLite) across Phase 1
  tables so the backend can mirror prototype IDs and later API payloads cleanly.
  Do not use auto-increment integer IDs in this phase.
- Keep `user_id TEXT NOT NULL DEFAULT 'local'` on top-level user-owned tables:
  `activity_classes`, `activities`, `activity_logs`, `daily_check_ins`,
  `flare_up_incidents`, `training_blocks`, and `goals`.
- Do **not** duplicate `user_id` onto child tables whose ownership is fully
  derived from their parent block: `rules`, `weekly_targets`,
  `recovery_targets`.
- Store log-time rule overrides in `activity_logs.rule_violations_at_log` as a
  JSON column from Phase 1 onward. This is persisted product data, not a Phase 2
  afterthought.
- Model check-in flare-ups relationally, not as the primary stored source in
  JSON. `daily_check_ins` keeps `has_flare_up`; detailed flare-up records live in
  `flare_up_incidents` with nullable `daily_check_in_id` back-reference. The API
  can later compose the embedded `flareUp` object expected by the frontend.
- Add `activities.default_volume_unit`, `weekly_targets.target_unit`, and
  `goals.progress_value` / `progress_target` / `progress_unit` in the initial
  schema because later planned screens already depend on them.

## Ticket ordering rationale

B1.1 must land first because the model layer defines the SQLModel metadata that
Alembic will introspect. If the model contract is still ambiguous when B1.2
starts, the initial migration becomes the wrong source of truth and Phase 2
inherits the drift.

B1.2 depends on B1.1 because the migration must be generated from the final
model metadata, including string IDs, JSON columns, uniqueness constraints, and
the full 10-table shape. The roundtrip migration test belongs here rather than
being deferred, because this is the first point where schema correctness is
verifiable.

B1.3 depends on B1.2 because the seed script should populate the schema created
by Alembic, not bypass it. Using the migration-created database in seed tests is
the cheapest way to prove that field names, nullability, FKs, and JSON columns
match the prototype scenario.

---

## B1.1 — SQLModel table classes for the canonical Phase 1 schema

**Type:** backend
**Branch:** `feat/phase-1-database-models`
**Depends on:** Phase 0 scaffold complete (`B0.1` to `B0.3`)

### Acceptance criteria
- Tests for model metadata and persistence behavior are written before the model
  files are finalized. They should fail first on missing tables, missing
  columns, wrong column types, wrong nullability, or missing constraints.
- `backend/app/models/` contains these model modules:
  - `activity.py` — `ActivityClass`, `Activity`
  - `log.py` — `ActivityLog`
  - `checkin.py` — `DailyCheckIn`, `FlareUpIncident`
  - `block.py` — `TrainingBlock`, `Rule`, `WeeklyTarget`, `RecoveryTarget`
  - `goal.py` — `Goal`
  - `__init__.py` — re-exports all model classes so Alembic can import one
    central metadata surface
- Every model uses `SQLModel` with `table=True` and an explicit plural
  snake_case `__tablename__`.
- Every primary key and foreign key field is string-based and matches the
  frontend entity identity shape from `export/src/types.ts`.
- The Phase 1 schema includes exactly these 10 tables:
  - `activity_classes`
  - `activities`
  - `activity_logs`
  - `daily_check_ins`
  - `flare_up_incidents`
  - `training_blocks`
  - `rules`
  - `weekly_targets`
  - `recovery_targets`
  - `goals`
- `activity_classes` includes at minimum:
  - `id`, `user_id`, `name`, `description`, `type`,
    `default_recovery_window_days`, `created_at`
  - `default_recovery_window_days` is non-null and defaults to `3`
- `activities` includes at minimum:
  - `id`, `user_id`, `activity_class_id`, `name`, `type`,
    `default_volume_unit`, `is_active`, `created_at`, `updated_at`
  - `default_volume_unit` is non-null because the log flow depends on a default
    unit already existing
- `activity_logs` includes at minimum:
  - `id`, `user_id`, `activity_id`, `logged_date`, `duration_minutes`,
    `volume_value`, `volume_unit`, `rpe`, `post_activity_feel`, `notes`,
    `rule_violations_at_log`, `created_at`, `updated_at`
  - `duration_minutes` and `volume_value` are non-null numeric fields
  - `rpe` is nullable and constrained to the inclusive `1..10` range
  - `rule_violations_at_log` is a nullable JSON column storing an array of
    violation snapshots
- `daily_check_ins` includes at minimum:
  - `id`, `user_id`, `check_in_date`, `pain_level`, `readiness_level`,
    `stiffness_level`, `has_flare_up`, `notes`, `created_at`, `updated_at`
  - `pain_level`, `readiness_level`, and `stiffness_level` are constrained to
    the inclusive `0..10` range
  - uniqueness is enforced on `(user_id, check_in_date)`
- `flare_up_incidents` includes at minimum:
  - `id`, `user_id`, `incident_date`, `body_part`, `severity`,
    `activity_class_id`, `daily_check_in_id`, `notes`, `created_at`,
    `updated_at`
  - `activity_class_id` is nullable
  - `daily_check_in_id` is nullable and links a check-in-sourced incident back
    to the originating daily check-in
- `training_blocks` includes at minimum:
  - `id`, `user_id`, `name`, `start_date`, `end_date`, `status`,
    `related_goal_id`, `notes`, `is_review_milestone_hit`, `created_at`,
    `updated_at`
  - `is_review_milestone_hit` defaults to `false`
- `rules` includes at minimum:
  - `id`, `training_block_id`, `activity_class_id`, `rule_type`,
    `threshold_value`, `window_days`, `enabled`, `created_at`, `updated_at`
  - `activity_class_id` is nullable to support cross-class rules such as
    `weekly_activity_count`
- `weekly_targets` includes at minimum:
  - `id`, `training_block_id`, `activity_class_id`, `target_value`,
    `target_unit`, `created_at`, `updated_at`
  - a uniqueness constraint prevents duplicate targets for the same
    `(training_block_id, activity_class_id)` pair
- `recovery_targets` includes at minimum:
  - `id`, `training_block_id`, `activity_id`, `target_frequency`,
    `frequency_unit`, `current_streak_days`, `created_at`, `updated_at`
  - a uniqueness constraint prevents duplicate targets for the same
    `(training_block_id, activity_id)` pair
- `goals` includes at minimum:
  - `id`, `user_id`, `title`, `description`, `target_date`, `timeframe`,
    `activity_class_id`, `progress_value`, `progress_target`, `progress_unit`,
    `status`, `created_at`, `updated_at`
- SQLModel relationships are defined for the obvious ownership paths needed by
  later services:
  - `ActivityClass` ↔ `Activity`
  - `Activity` ↔ `ActivityLog`
  - `DailyCheckIn` ↔ `FlareUpIncident`
  - `Goal` ↔ `TrainingBlock`
  - `TrainingBlock` ↔ `Rule`
  - `TrainingBlock` ↔ `WeeklyTarget`
  - `TrainingBlock` ↔ `RecoveryTarget`
- No business logic, validation branching, or write-side rules are implemented
  in model methods or routers as part of this ticket.
- If any model shape required by this ticket differs from the current wording in
  `docs/database-schema.md`, that doc is updated in the same ticket so the
  schema reference stays canonical for Phase 2 onward.

### Reuse / extend
- Reuse `export/src/types.ts` as the canonical field-name reference.
- Reuse `backend/app/database.py` for engine and metadata wiring; do not invent a
  repository layer in this phase.
- Extend `docs/database-schema.md` only where the checked-in schema doc is
  missing fields that later phases already depend on.

### Recommended test scope
- Integration-style metadata tests against temporary SQLite are the smallest
  coherent layer here.
- Verify real table creation, uniqueness constraints, JSON column persistence,
  and key foreign-key relationships through SQLModel sessions.
- Do not mock SQLModel metadata or SQLite for this ticket.

### Edge cases to handle
- SQLite JSON support is limited; use SQLAlchemy JSON columns in a way that
  roundtrips Python lists and dicts cleanly under SQLite.
- `daily_check_ins` should not store a second JSON flare-up source of truth if
  `flare_up_incidents` already exists for the same concept.
- Child block-owned tables should not duplicate `user_id`, but the ownership
  path must stay unambiguous through foreign keys.
- String IDs must work across primary keys, foreign keys, and seeded fixtures;
  do not quietly fall back to integer autoincrement IDs in some tables.

### Files to create / modify
- `backend/app/models/activity.py`
- `backend/app/models/log.py`
- `backend/app/models/checkin.py`
- `backend/app/models/block.py`
- `backend/app/models/goal.py`
- `backend/app/models/__init__.py`
- `backend/app/tests/` model-focused test module(s)
- `docs/database-schema.md` if needed for schema sync

---

## B1.2 — Alembic init, initial migration, and migration roundtrip coverage

**Type:** backend
**Branch:** `feat/phase-1-database-models`
**Depends on:** `B1.1`

### Acceptance criteria
- Tests for migration behavior are written before the initial migration revision
  is finalized. They should fail first when required tables, columns,
  constraints, or downgrade behavior are missing.
- `backend/alembic.ini` exists and points at the backend app configuration
  without hardcoding machine-specific paths.
- `backend/alembic/` is fully initialized with at minimum:
  - `env.py`
  - `script.py.mako`
  - `versions/`
- Alembic `env.py` imports the SQLModel metadata from the central
  `backend/app/models/__init__.py` surface rather than importing individual
  model files ad hoc.
- A single initial migration revision is created under
  `backend/alembic/versions/` and defines the exact Phase 1 schema from `B1.1`.
- The initial migration creates all 10 application tables and all constraints
  required by `B1.1`, including:
  - `(user_id, check_in_date)` uniqueness on `daily_check_ins`
  - `weekly_targets` uniqueness on `(training_block_id, activity_class_id)`
  - `recovery_targets` uniqueness on `(training_block_id, activity_id)`
  - required foreign keys between parent and child tables
- The migration preserves JSON columns needed for
  `activity_logs.rule_violations_at_log`.
- The migration does not rely on `SQLModel.metadata.create_all()` at app startup
  as the production schema source of truth.
- A migration roundtrip test exists and is part of the backend test suite:
  - fresh temporary SQLite database
  - `alembic upgrade head`
  - inspect resulting schema for the expected tables and key constraints
  - `alembic downgrade base`
  - verify application tables are removed cleanly
- Running the roundtrip test repeatedly is deterministic and does not depend on
  the developer's local `data/milestone.db`.
- `alembic upgrade head` against a fresh DB and `alembic downgrade base` against
  that same DB both exit successfully from the `backend/` directory.
- If migration-generated schema diverges from `docs/database-schema.md`, the doc
  is corrected in the same ticket rather than leaving the drift for later.

### Reuse / extend
- Reuse the SQLModel metadata produced in `B1.1`; do not hand-maintain a second
  schema definition.
- Reuse `backend/app/settings.py` and `backend/app/database.py` for database URL
  access where Alembic environment wiring needs it.
- Extend the backend test suite with migration integration coverage rather than
  using an external shell script as the only verification.

### Recommended test scope
- Use integration tests that execute real Alembic upgrade and downgrade steps
  against a temporary SQLite file.
- Inspect real database schema via SQLAlchemy inspection APIs or SQLite catalog
  queries.
- Do not mock Alembic commands or metadata reflection in this ticket.

### Edge cases to handle
- Alembic autogenerate can miss or misrender some constraints and JSON details
  under SQLite; review the initial revision manually before accepting it.
- The migration test must not use the persistent `data/` directory, or it will
  become order-dependent across local runs.
- Import paths in `env.py` must work when Alembic is invoked from `backend/`
  during CI and local development.

### Files to create / modify
- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/alembic/script.py.mako`
- `backend/alembic/versions/<initial_revision>.py`
- `backend/app/tests/` migration-focused test module(s)
- `backend/app/models/__init__.py` if metadata export needs refinement
- `docs/database-schema.md` if needed for schema sync

---

## B1.3 — Seed script mirroring the prototype Sam Chen dataset

**Type:** backend
**Branch:** `feat/phase-1-database-models`
**Depends on:** `B1.2`

### Acceptance criteria
- Tests for seed loading behavior are written before the seed script is treated
  as complete. They should fail first on wrong counts, broken foreign keys, or
  mismatches with the prototype scenario.
- `backend/scripts/seed.py` exists and is invokable from the `backend/`
  directory as `python -m scripts.seed`.
- If needed for module execution, `backend/scripts/__init__.py` exists.
- The seed dataset mirrors `export/src/lib/mockData.ts` for all Phase 1-backed
  entities, using the same record IDs wherever the schema allows:
  - `1` active training block
  - `3` activity classes
  - `5` activities
  - `4` rules
  - `2` weekly targets
  - `26` activity logs spanning 7 weeks
  - `6` daily check-ins
  - `2` flare-up incidents
- The seeded block is `active` and not review-complete yet.
- The seeded activity classes, activities, rules, logs, and incidents match the
  prototype scenario semantics:
  - foot-load, recovery, and upper-body classes
  - walk, bike, stretch, pool, and bands activities
  - caution/danger violation snapshots on the same log rows represented in the
    prototype data
  - two flare-up incidents linked back to the relevant daily check-ins through
    `daily_check_in_id`
- `user_id` for seeded top-level rows is `"local"` to match the current
  server-side single-user contract, even if the prototype mock data uses a
  different sample user ID.
- The seed script does not create ad hoc placeholder rows for resources not
  present in the prototype dataset. Specifically:
  - `goals` may remain empty
  - `recovery_targets` may remain empty
- The seed script is safe to run more than once against the same database
  without creating duplicate rows. Acceptable implementations include:
  - clearing the known Phase 1 tables in FK-safe order before reinsert, or
  - upserting by primary key
- A seed verification test proves:
  - the expected row counts after seeding
  - key relationships exist
  - at least one JSON `rule_violations_at_log` payload roundtrips correctly
  - the "today check-in missing" scenario remains true for the seed date used by
    the prototype data
- The seed script reads the database URL through the shared backend settings
  path or an explicit CLI override, not a hardcoded local path.
- Running the seed script immediately after `alembic upgrade head` succeeds on a
  fresh database.

### Reuse / extend
- Reuse `export/src/lib/mockData.ts` as the canonical scenario reference.
- Reuse the Phase 1 SQLModel models and session wiring; do not insert rows via
  raw SQL.
- Extend backend test coverage with a seed-focused integration test instead of
  relying only on a manual sqlite inspection step.

### Recommended test scope
- Use integration tests against a migration-created temporary SQLite database.
- Verify counts plus a few representative row contents and foreign-key links.
- Do not mock the models or the session in this ticket.

### Edge cases to handle
- The seed script should be deterministic even if local clock time differs from
  the seed scenario's narrative "today" date.
- JSON violation snapshots must survive insert and readback unchanged enough for
  future dashboard and log-history comparisons.
- Re-running the seed script after partial data exists must not leave duplicate
  incidents or logs behind.

### Files to create / modify
- `backend/scripts/seed.py`
- `backend/scripts/__init__.py` if module execution requires it
- `backend/app/tests/` seed-focused test module(s)
- `README.md` or backend setup notes only if seed invocation instructions need
  to be documented during implementation
