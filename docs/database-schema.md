# Database Schema

Planned relational schema for the Milestone backend.
This is the target data model for backend implementation, not a claim that migrations already exist.

Use this alongside:
- `plans/milestone-architecture.md` for broader system context
- `docs/api-map.md` for route and payload planning
- `docs/architecture.md` and `docs/patterns.md` for implementation rules

## Modeling Conventions

- Phase 1 is single-user and local-first.
- Use opaque string IDs across all tables so backend IDs match the frontend type
  shapes cleanly.
- Keep `user_id = "local"` on top-level user-owned tables only:
  `goals`, `training_blocks`, `activity_classes`, `activities`,
  `activity_logs`, `daily_check_ins`, and `flare_up_incidents`.
- Do not duplicate `user_id` onto block-owned child tables:
  `rules`, `weekly_targets`, and `recovery_targets`.
- Table names should be plural snake_case.
- Use foreign keys for cross-entity relationships.
- Use Alembic for every schema change.
- Keep business rules in services, not as ad hoc schema workarounds.
- Store detailed flare-up records relationally in `flare_up_incidents`.
  `daily_check_ins` keeps `has_flare_up`, and API responses may compose the
  frontend's embedded `flareUp` object from the related incident row.

## Planned Tables Summary

Phase 1 includes **10 tables**:

- `goals`
- `training_blocks`
- `activity_classes`
- `activities`
- `activity_logs`
- `daily_check_ins`
- `flare_up_incidents`
- `rules`
- `weekly_targets`
- `recovery_targets`

## Planned Tables

### `goals`

- `id`
- `user_id`
- `title`
- `description`
- `target_date`
- `timeframe` — monthly or quarterly
- `activity_class_id` nullable
- `activity_id` nullable — optional link to a specific activity for auto-progress or activity-scoped goals
- `auto_track_progress` — when true, server recomputes `progress_value` from matching activity logs (default false)
- `progress_value` nullable
- `progress_target` nullable
- `progress_unit` nullable
- `status` — active, achieved, missed, paused
- `created_at`
- `updated_at`

Purpose:
- Time-scoped outcomes that training blocks and dashboard progress can reference
- `activity_class_id` remains for legacy class-scoped goals; `activity_id` is the preferred link when tracking a single activity
- `auto_track_progress` defaults to false; existing rows and new class-only goals keep manual progress unless enabled

### `training_blocks`

- `id`
- `user_id`
- `name`
- `start_date`
- `end_date` nullable
- `status` — active, completed, archived
- `related_goal_id` nullable
- `notes` nullable
- `is_review_milestone_hit`
- `created_at`
- `updated_at`

Purpose:
- The main planning container for rules, targets, and milestone reviews

### `activity_classes`

- `id`
- `user_id`
- `name`
- `description`
- `type` — performance or recovery
- `default_recovery_window_days`
- `created_at`

Purpose:
- Groups activities by physiological or planning impact

### `activities`

- `id`
- `user_id`
- `activity_class_id`
- `name`
- `type` — performance or recovery
- `default_volume_unit`
- `is_active`
- `created_at`
- `updated_at`

Purpose:
- Specific loggable activities such as walking, padel, stretching, or contrast therapy

### `activity_logs`

- `id`
- `user_id`
- `activity_id`
- `logged_date`
- `duration_minutes`
- `volume_value`
- `volume_unit` nullable
- `rpe` nullable for recovery activities if the product keeps it optional there
- `post_activity_feel` nullable
- `notes` nullable
- `rule_violations_at_log` nullable JSON snapshot
- `created_at`
- `updated_at`

Purpose:
- Raw activity events that drive rolling load, weekly totals, and delayed-tax analysis

### `daily_check_ins`

- `id`
- `user_id`
- `check_in_date`
- `pain_level`
- `readiness_level`
- `stiffness_level`
- `has_flare_up`
- `notes` nullable
- `created_at`
- `updated_at`

Constraints:
- Unique per `user_id` and `check_in_date`

Purpose:
- Next-morning recovery feedback that closes the feedback loop with prior activity

### `flare_up_incidents`

- `id`
- `user_id`
- `incident_date`
- `body_part`
- `severity` — `0..10`
- `activity_class_id` nullable if only one likely trigger is stored
- `daily_check_in_id` nullable
- `notes` nullable
- `created_at`
- `updated_at`

Purpose:
- Structured records of pain or injury incidents beyond the regular daily check-in

### `rules`

- `id`
- `training_block_id`
- `activity_class_id` nullable for class-scoped rules (legacy cross-class rules deprecated in Stage 2.5)
- `activity_id` nullable — when set, rule applies to that exercise and takes precedence over the class-level rule of the same type
- `rule_type`
- `threshold_value`
- `window_days`
- `limit_unit` nullable — optional display or compute hint for volume-cap rules (e.g. `km`, `min`)
- `enabled`
- `created_at`
- `updated_at`

Purpose:
- Recovery constraints such as rest windows, frequency caps, weekly load caps,
  consecutive-day limits, or per-exercise volume caps
- Class-level rules (`activity_id` null) apply to all activities in the class; exercise-level rules override per type/metric

### `weekly_targets`

- `id`
- `training_block_id`
- `activity_class_id` — denormalized class lookup; required for legacy class targets
- `activity_id` — nullable FK to `activities.id` for activity-scoped targets
- `target_value`
- `target_unit` — e.g. `sessions`, `minutes`, or an activity volume unit such as `km`
- `target_kind` — defaults to `minimum` (Monday–Sunday weekly minimum)
- `created_at`
- `updated_at`

Uniqueness (partial):
- Legacy class targets: unique on (`training_block_id`, `activity_class_id`) where `activity_id` IS NULL
- Activity targets: unique on (`training_block_id`, `activity_id`) where `activity_id` IS NOT NULL
- Partial uniques allow multiple activity-scoped targets in the same class without colliding with the legacy class key

Purpose:
- User-facing weekly minimum targets for any activity during a training block
- Legacy class-scoped rows (`activity_id` null) remain readable for older performance-class targets
- One active weekly target per `training_block_id` + `activity_id` when activity-scoped

### `recovery_targets`

- `id`
- `training_block_id`
- `activity_id`
- `target_frequency`
- `frequency_unit` — daily or weekly
- `current_streak_days`
- `created_at`
- `updated_at`

Purpose:
- Legacy compliance-style recovery targets; weekly rows were migrated into `weekly_targets`
- Daily rows remain as legacy storage; they still feed `recovery_streaks` on the dashboard API for compatibility but are **not** the user-facing weekly target path (Goals **Weekly target** + `weekly_targets` CRUD)
- New weekly minimums should be created as `weekly_targets`, not weekly `recovery_targets`

## Relationships

- One `goal` can relate to many `training_blocks`, but each block references at most one goal.
- One `training_block` owns many `rules`.
- One `training_block` owns many `weekly_targets`.
- One `training_block` owns many `recovery_targets`.
- One `activity_class` owns many `activities`.
- One `activity_class` can be referenced by many `goals`, `rules`,
  `weekly_targets`, and `flare_up_incidents`.
- One `activity` can be referenced by many `goals`, `rules`, and `weekly_targets` (activity-scoped links).
- One `activity` owns many `activity_logs`.
- One `daily_check_in` can surface zero or more linked `flare_up_incidents`,
  though Phase 1 behavior expects at most one check-in-sourced incident row.

## Service Behaviour Notes

- **Rule copy on new block:** when a new `training_block` is created via `POST /api/training-blocks`, the block creation service copies all `rules` rows from the previous active block into the new block. No schema change needed — this is a service operation, not a schema constraint.
- **Block end_date on archive:** the service sets `end_date = today` on the outgoing block if not already set, before marking it `completed`. This ensures `BlockReviewScreen` can always scope its queries to a closed date range.
- **Weekly progress cadence:** dashboard `weekly_progress` sums activity logs in the Monday–Sunday ISO week containing `as_of`, scoped per `weekly_targets` row (activity-scoped or legacy class-scoped). Load risk and load-tax graph use rolling seven-day windows instead — see `docs/api-map.md`.

## Open Modeling Notes

- If flare-up incidents need multi-select "likely caused by" classes, add a join table instead of storing arrays in JSON.
- If the implemented backend uses different enum names or table names, update this doc and `docs/api-map.md` together.
