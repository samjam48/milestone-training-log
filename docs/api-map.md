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
| `POST` | `/api/training-blocks` | Create a new block |
| `GET` | `/api/training-blocks/active` | Fetch the active block, if one exists |
| `PATCH` | `/api/training-blocks/{block_id}` | Update block metadata or lifecycle status |

### Activity Classes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/activity-classes` | List activity classes |
| `POST` | `/api/activity-classes` | Create an activity class |
| `PATCH` | `/api/activity-classes/{class_id}` | Update class metadata |

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
| `GET` | `/api/training-blocks/{block_id}/weekly-targets` | List weekly targets for a training block |
| `POST` | `/api/training-blocks/{block_id}/weekly-targets` | Create a weekly target for a performance class |
| `PATCH` | `/api/weekly-targets/{target_id}` | Update a weekly target |

### Recovery Targets

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/training-blocks/{block_id}/recovery-targets` | List recovery targets for a training block |
| `POST` | `/api/training-blocks/{block_id}/recovery-targets` | Create a recovery target for a recovery activity |

### Derived Load And Dashboard Data

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/load/summary` | Class statuses, suggestions, weekly progress; optional `?as_of=` (default server-local today); snake_case JSON; 200 with neutral payloads when no active block |
| `POST` | `/api/load/check-violations` | Dry-run all five rule types for a proposed log; body `activity_id`, `volume_value`, `rpe`, optional `as_of`; no DB write |
| `GET` | `/api/load/delayed-tax` | Proactive 7-day load/rest risk plus symptom attribution when pain/flare recorded; optional `?as_of=`, `?risk_window_days=`, `?baseline_days=`, `?pain_threshold=` (default 3) |
| `GET` | `/api/dashboard` | Aggregate dashboard payload; optional `?as_of=YYYY-MM-DD` (default server-local today). Returns `activity_classes`, `activities`, `logs` (30-day window ending on `as_of`), `incidents`, `class_statuses`, `suggestions`, `weekly_progress`, `daily_scores`, `load_series`, `flare_up_dates`, `recovery_streaks`, `clean_streak`, and related block/status fields |

## Notes For Initial Backend Build

- The first backend slice does not need every endpoint above on day one. Build in ticketed slices.
- Keep list-route filtering additive and explicit; do not overload one route with several unrelated response shapes.
- If the implemented contract diverges from this plan, update this file in the same change.
