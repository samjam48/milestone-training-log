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
- JSON request and response bodies
- Date-only values use `YYYY-MM-DD`
- Timestamps use ISO 8601
- Routers stay thin; business logic and persistence live in `services/`
- Add explicit domain-action endpoints when plain CRUD stops fitting cleanly

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
| `GET` | `/api/goals/{goal_id}` | Fetch one goal |
| `PATCH` | `/api/goals/{goal_id}` | Update goal fields such as title, target date, or status |

### Training Blocks

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/training-blocks` | List blocks |
| `POST` | `/api/training-blocks` | Create a new block |
| `GET` | `/api/training-blocks/active` | Fetch the active block, if one exists |
| `GET` | `/api/training-blocks/{block_id}` | Fetch one block |
| `PATCH` | `/api/training-blocks/{block_id}` | Update block metadata or lifecycle status |

### Activity Classes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/activity-classes` | List activity classes |
| `POST` | `/api/activity-classes` | Create an activity class |
| `GET` | `/api/activity-classes/{class_id}` | Fetch one activity class |
| `PATCH` | `/api/activity-classes/{class_id}` | Update class metadata |

### Activities

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/activities` | List activities, optionally filtered by class or type |
| `POST` | `/api/activities` | Create an activity |
| `GET` | `/api/activities/{activity_id}` | Fetch one activity |
| `PATCH` | `/api/activities/{activity_id}` | Update activity fields |

### Activity Logs

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/activity-logs` | List logs, filterable by date range, activity, or class |
| `POST` | `/api/activity-logs` | Create a log entry |
| `GET` | `/api/activity-logs/{log_id}` | Fetch one log entry |
| `PATCH` | `/api/activity-logs/{log_id}` | Update a log entry |
| `DELETE` | `/api/activity-logs/{log_id}` | Delete a log entry |

### Daily Check-Ins

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/daily-check-ins` | List check-ins, filterable by date range |
| `POST` | `/api/daily-check-ins` | Create or upsert a check-in for a date |
| `GET` | `/api/daily-check-ins/today` | Shortcut for today's check-in |
| `GET` | `/api/daily-check-ins/{check_in_date}` | Fetch a check-in by date |
| `PATCH` | `/api/daily-check-ins/{check_in_date}` | Update a check-in by date |

### Flare-Up Incidents

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/flare-up-incidents` | List flare-up incidents |
| `POST` | `/api/flare-up-incidents` | Create a flare-up incident |
| `GET` | `/api/flare-up-incidents/{incident_id}` | Fetch one incident |
| `PATCH` | `/api/flare-up-incidents/{incident_id}` | Update an incident |

### Recovery Rules

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/rules` | List recovery rules |
| `POST` | `/api/rules` | Create a rule |
| `GET` | `/api/rules/{rule_id}` | Fetch one rule |
| `PATCH` | `/api/rules/{rule_id}` | Update a rule |
| `DELETE` | `/api/rules/{rule_id}` | Delete a rule |

### Recovery Targets

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/recovery-targets` | List recovery targets |
| `POST` | `/api/recovery-targets` | Create a recovery target |
| `GET` | `/api/recovery-targets/{target_id}` | Fetch one target |
| `PATCH` | `/api/recovery-targets/{target_id}` | Update a target |
| `DELETE` | `/api/recovery-targets/{target_id}` | Delete a target |

### Derived Load And Dashboard Data

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/load/summary` | Rolling load, rule violations, and traffic-light risk as of a date |
| `GET` | `/api/load/delayed-tax` | Correlate pain or flare signals with activity spikes 24-72 hours earlier |
| `GET` | `/api/dashboard` | Aggregate dashboard payload for weekly targets, streaks, suggestions, and status cards |

## Notes For Initial Backend Build

- The first backend slice does not need every endpoint above on day one. Build in ticketed slices.
- Keep list-route filtering additive and explicit; do not overload one route with several unrelated response shapes.
- If the implemented contract diverges from this plan, update this file in the same change.
