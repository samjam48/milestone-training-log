# API Map

Planned API contract for the Milestone backend.
This is a living design document, not a statement that every endpoint already exists.

Use this alongside:
- `plans/milestone-architecture.md` for broader system context
- `docs/database-schema.md` for entity relationships
- `docs/architecture.md` and `docs/patterns.md` for implementation rules

## Contract Conventions

- Base path: `/api`
- Phase 1 is local-first and single-user; auth is out of scope for now
- `user_id` is resolved server-side to `"local"` in Phase 1
- JSON request and response bodies
- Date-only values use `YYYY-MM-DD`
- Timestamps use ISO 8601
- Routers stay thin; business logic and persistence live in `services/`
- Add explicit domain-action endpoints when plain CRUD stops fitting cleanly
- Daily check-in responses may include an embedded `flareUp` object composed
  from related `flare_up_incidents` rows; the database source of truth remains
  relational, not duplicated JSON on `daily_check_ins`

## Planned Resources

### Health And System

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Basic backend liveness check |

### Goals

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/goals` | List goals, optionally filtered by status or timeframe |
| `POST` | `/api/goals` | Create a goal |
| `PATCH` | `/api/goals/{goal_id}` | Update goal fields such as title, target date, status, or numeric progress |

### Training Blocks

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/training-blocks` | List blocks |
| `POST` | `/api/training-blocks` | Create a new block; service automatically copies rules from the current active block and marks it `completed` |
| `GET` | `/api/training-blocks/active` | Fetch the active block, if one exists |
| `PATCH` | `/api/training-blocks/{block_id}` | Update block metadata or lifecycle status |
| `GET` | `/api/training-blocks/{block_id}/review` | Per-block review payload: `block`, `daily_scores`, `load_series`, `flare_up_dates`, `total_sessions`, `clean_days` — scoped to block date range; used by `BlockReviewScreen` and `BlockSafetyMapSection` (previous-block heatmaps). **Removed (B10.4):** `GET /api/training-blocks/{block_id}/scores` — callers use `daily_scores` from `/review` instead |

### Activity Classes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/activity-classes` | List activity classes |
| `POST` | `/api/activity-classes` | Create an activity class |
| `PATCH` | `/api/activity-classes/{class_id}` | Update class metadata |
| `DELETE` | `/api/activity-classes/{class_id}` | Delete class when no blocking references; returns `409` if any activity in the class has logs or goals/rules/weekly targets reference the class or its activities; otherwise `204` and cascade-deletes unlogged activities in one transaction |

### Activities

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/activities` | List activities, optionally filtered by `class_id` or `is_active` |
| `POST` | `/api/activities` | Create an activity |
| `PATCH` | `/api/activities/{activity_id}` | Update activity fields such as name, default unit, or active status |

### Activity Logs

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/activity-logs` | List logs, filterable by date range, activity, or class |
| `POST` | `/api/activity-logs` | Create a log entry and persist any log-time rule violation snapshots |
| `PATCH` | `/api/activity-logs/{log_id}` | Update a log entry |
| `DELETE` | `/api/activity-logs/{log_id}` | Delete a log entry |

### Daily Check-Ins

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/daily-check-ins` | List check-ins, filterable by date range |
| `POST` | `/api/daily-check-ins` | Create or upsert a check-in for a date; may also create or update a linked flare-up incident |
| `GET` | `/api/daily-check-ins/today` | Shortcut for today's check-in |
| `GET` | `/api/daily-check-ins/{check_in_date}` | Fetch a check-in by date |
| `PATCH` | `/api/daily-check-ins/{check_in_date}` | Update a check-in by date |

### Flare-Up Incidents

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/flare-up-incidents` | List flare-up incidents |
| `POST` | `/api/flare-up-incidents` | Create a flare-up incident with optional single likely-cause activity class |
| `PATCH` | `/api/flare-up-incidents/{incident_id}` | Update an incident |

### Rules

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/training-blocks/{block_id}/rules` | List rules for a training block |
| `POST` | `/api/training-blocks/{block_id}/rules` | Create a rule under a training block |
| `PATCH` | `/api/rules/{rule_id}` | Update a rule |
| `DELETE` | `/api/rules/{rule_id}` | Delete a rule |

### Weekly Targets

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/training-blocks/{block_id}/weekly-targets` | List weekly targets for a training block (legacy class-scoped rows and activity-scoped rows) |
| `POST` | `/api/training-blocks/{block_id}/weekly-targets` | Create a weekly minimum target for an activity (preferred) or legacy class |
| `PATCH` | `/api/weekly-targets/{target_id}` | Update target value/unit or move to another activity (class derived from activity) |
| `DELETE` | `/api/weekly-targets/{target_id}` | Remove a weekly target (`204`) |

**Create body (`WeeklyTargetCreate`):** `id`, `activity_id` (preferred) *or* legacy `activity_class_id`, `target_value`, `target_unit` (`sessions`, `minutes`, or the activity volume unit such as `km`), optional `target_kind` defaulting to `minimum`. Server derives `activity_class_id` from `activity_id`. Returns `404` for missing block/activity/class, `409` for duplicate block+activity (or block+class), `422` for inactive activity, unsupported unit, or `target_value <= 0`.

**Patch body (`WeeklyTargetPatch`):** optional `activity_id`, `target_value`, `target_unit` (explicit `null` rejected). Same error semantics as create for conflicts and validation.

**Read shape (`WeeklyTargetRead`):** `id`, `training_block_id`, `activity_class_id`, `activity_id` nullable, `target_value`, `target_unit`, `target_kind`, `created_at`, `updated_at`.

**UI note:** Goals tab exposes **Weekly target** and **Big goal** flows (WTL.F2). Edit Rules no longer surfaces weekly targets (P25.9). New targets should be activity-scoped; legacy class-scoped rows remain readable.

### Recovery Targets (legacy)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/training-blocks/{block_id}/recovery-targets` | List legacy recovery targets for a training block |
| `POST` | `/api/training-blocks/{block_id}/recovery-targets` | Create a legacy recovery target (daily streak storage only; not the user-facing weekly target path) |

Weekly `recovery_targets` rows were migrated into `weekly_targets` as `sessions` minimums. Daily rows remain for legacy streak calculation; dashboard suggestions and **This week** progress use `weekly_targets` only.

### Derived Load And Dashboard Data

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/load/summary` | Class statuses, suggestions, weekly progress; optional `?as_of=` (default server-local today); snake_case JSON; 200 with neutral payloads when no active block |
| `POST` | `/api/load/check-violations` | Dry-run all five rule types for a proposed log; body `activity_id`, `volume_value`, `rpe`, optional `as_of`; no DB write |
| `GET` | `/api/load/delayed-tax` | Proactive 7-day load/rest risk plus symptom attribution when pain/flare recorded; optional `?as_of=`, `?risk_window_days=`, `?baseline_days=`, `?pain_threshold=` (default 3) |
| `GET` | `/api/dashboard` | Aggregate dashboard payload; optional `?as_of=YYYY-MM-DD` (default server-local today). Top-level fields: `as_of`, `user_name`, `block`, `activity_classes`, `activities`, `logs` (30-day window ending on `as_of` only — full Log History is Phase 6 via `GET /api/activity-logs`), `incidents`, `goals` (all local goals for the Goals tab: active, achieved, paused, missed), `previous_blocks` (completed/archived blocks, summary only — no scores), `has_checked_in_today`, `class_statuses`, `suggestion_buckets` (do/rest/done rows with `bucket`, `scope`, `activity_class_id`, `description`), `goal_rows` (dashboard summary rows: `goal_id`, `title`, `status`, `activity_id`, `progress_value`, `progress_target`, `progress_unit`, `fill_ratio` 0..1 or `null` for qualitative, `is_qualitative`), `load_risk_summary` (see below; `null` when no active block), `weekly_progress` (see below), `daily_scores`, `load_series` (see below), `graph_class_id` (activity class ID used for `load_series` and `week_load_threshold`; `null` when no active block), `flare_up_dates`, `week_load_threshold` (`int` cap for graph overlay when an explicit load-tax threshold exists; otherwise `null` — do not treat `0` as a cap), `clean_streak`, `recovery_streaks` (legacy payload from daily `recovery_targets`; frontend no longer renders a Recovery streaks section). Returns 200 with `block: null` and neutral/empty derived fields when no active block |

**`weekly_progress` (This week):** One row per `weekly_targets` row on the active block. Progress counts activity logs in the **Monday–Sunday week containing `as_of`** (inclusive), not block start through today. Each row: `weekly_target_id`, `activity_class_id`, `class_name`, optional `activity_id` / `activity_name`, `value`, `target`, `unit`, `state`, `period_start`, `period_end`. Also returned on `GET /api/load/summary`.

**`load_series` (load tax graph):** Last **30 calendar days** ending on `as_of` for `graph_class_id`. Each point: `date`, `load` (recency-weighted rolling **seven-day load tax** for performance activities in that class), `daily_load` (same-day load tax). Recovery activities do not contribute. Raw `volume × rpe` is not used for the graph.

**`load_risk_summary`:** Rolling **last seven days** ending on `as_of` (`today` plus previous six days). `week_days`: `{ date, flagged, state }` per day where `state` is aggregate load-tax pressure (`safe` / `caution` / `danger`). `rule_limit_rows`: one row per **enabled** rule limit (class- or exercise-scoped), not one bar per class. Each row: `id`, `scope` (`class` | `activity`), `rule_id`, `rule_type`, `activity_class_id`, `class_name`, optional `activity_id` / `activity_name`, `actual`, `limit`, `unit`, `state`, `label`, optional `display_mode` (e.g. rest-spacing status copy). Exercise-scoped rules never appear as class-wide rows. `class_bars` is removed.

### MCP Context (AI Stub)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/mcp/context` | Structured AI-readable summary for future MCP integration; optional `?as_of=YYYY-MM-DD` (default server-local today). Top-level fields: `active_block` (slim block summary — `id`, `name`, `start_date`, `end_date`, `status`, `is_review_milestone_hit` — or `null`), `recent_logs` (last 7 calendar days ending on `as_of`; each entry has `activity_name`, `load_score` as `volume × rpe` with default RPE 5, and `logged_date`), `today_check_in` (`pain`, `readiness`, `stiffness`, `has_flare_up` or `null`), `class_statuses` (slim traffic-light summaries: `activity_class_id`, `state`, `reason`; empty when no active block). No auth, no AI calls |

## Notes For Initial Backend Build

- The first backend slice does not need every endpoint above on day one. Build in ticketed slices.
- Keep list-route filtering additive and explicit; do not overload one route with several unrelated response shapes.
- If the implemented contract diverges from this plan, update this file in the same change.
