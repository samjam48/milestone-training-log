# Database Schema

Planned relational schema for the Milestone backend.
This is the target data model for backend implementation, not a claim that migrations already exist.

Use this alongside:
- `plans/milestone-architecture.md` for broader system context
- `docs/api-map.md` for route and payload planning
- `docs/architecture.md` and `docs/patterns.md` for implementation rules

## Modeling Conventions

- Phase 1 is single-user and local-first.
- Keep a `user_id` field only if the implementation wants to preserve an easy path to future multi-user support; if that decision changes, update this doc and the architecture plan together.
- Table names should be plural snake_case.
- Use foreign keys for cross-entity relationships.
- Use Alembic for every schema change.
- Keep business rules in services, not as ad hoc schema workarounds.

## Planned Tables

### `goals`

- `id`
- `user_id`
- `title`
- `description`
- `target_date`
- `timeframe` — monthly or quarterly
- `activity_class_id` nullable
- `status` — active, achieved, missed, paused
- `created_at`
- `updated_at`

Purpose:
- Time-scoped outcomes that training blocks and dashboard progress can reference

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
- `is_active`
- `created_at`

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
- `created_at`

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

Constraints:
- Unique per `user_id` and `check_in_date`

Purpose:
- Next-morning recovery feedback that closes the feedback loop with prior activity

### `flare_up_incidents`

- `id`
- `user_id`
- `incident_date`
- `body_part`
- `severity`
- `activity_class_id` nullable if only one likely trigger is stored
- `notes` nullable
- `created_at`

Purpose:
- Structured records of pain or injury incidents beyond the regular daily check-in

### `rules`

- `id`
- `training_block_id`
- `activity_class_id` nullable for cross-class rules
- `rule_type`
- `threshold_value`
- `window_days`
- `enabled`
- `created_at`

Purpose:
- Recovery constraints such as rest windows, frequency caps, weekly load caps, or consecutive-day limits

### `recovery_targets`

- `id`
- `training_block_id`
- `activity_id`
- `target_frequency`
- `frequency_unit` — daily or weekly
- `current_streak_days`
- `created_at`

Purpose:
- Compliance-style goals for recovery activities that do not directly affect load

## Relationships

- One `goal` can relate to many `training_blocks`, but each block references at most one goal.
- One `training_block` owns many `rules`.
- One `training_block` owns many `recovery_targets`.
- One `activity_class` owns many `activities`.
- One `activity_class` can be referenced by many `goals`, `rules`, and `flare_up_incidents`.
- One `activity` owns many `activity_logs`.

## Open Modeling Notes

- If flare-up incidents need multi-select "likely caused by" classes, add a join table instead of storing arrays in JSON.
- If the team decides Phase 1 should skip `user_id` entirely, remove it consistently rather than mixing both approaches.
- If the implemented backend uses different enum names or table names, update this doc and `docs/api-map.md` together.
