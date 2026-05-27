# Phase 2 — Core CRUD API Tickets
*Source: `plans/TRD.md` §7 Phase 2, `plans/PRD.md` §4 F1-F3/F7, `docs/api-map.md`, `docs/database-schema.md` | Date: 2026-05-27*

## Planning assumptions locked for this ticket set

- Phase 0 and Phase 1 are complete. The Phase 2 implementer should reuse the
  existing FastAPI app factory, SQLModel models, Alembic-created schema,
  database session dependency, and seed dataset.
- Phase 2 covers only the five primary user-facing CRUD resources:
  `activity_classes`, `activities`, `activity_logs`, `daily_check_ins`, and
  `flare_up_incidents`.
- Training blocks, rules, weekly targets, recovery targets, goals, load-engine
  calculations, and dashboard aggregation are out of scope except where Phase 2
  request or response schemas must preserve fields those later phases will use.
- Use one service module and one router module per resource. Routers translate
  HTTP concerns only; services own persistence, lookups, filtering, upsert
  behavior, relationship composition, and not-found handling.
- Keep `user_id` server-owned. Request bodies must not accept `user_id`; service
  functions assign `"local"` for all top-level rows created in this phase.
- Use snake_case JSON field names for backend API payloads in Phase 2, matching
  the SQLModel field names and `docs/api-map.md`. Frontend camelCase adapters
  are Phase 6 scope.
- Duplicate client-supplied IDs return HTTP `409 Conflict` across Phase 2
  create routes.
- When a check-in-sourced flare-up is later changed to `has_flare_up=false`,
  delete the linked `flare_up_incidents` row. Standalone incidents created
  through `/api/flare-up-incidents` are unaffected.
- Timestamps may be supplied by service helpers when creating or updating rows.
  Request schemas should not require clients to send `created_at` or
  `updated_at`.
- Do not add schema fields, tables, or Alembic revisions in Phase 2 unless a
  test uncovers a Phase 1 schema bug. Any schema change must update
  `docs/database-schema.md` and use Alembic.
- Use focused route/service integration tests with a temporary SQLite database
  and FastAPI dependency override for `get_session`. Do not use the persistent
  `data/milestone.db` in tests.

## Ticket ordering rationale

B2.1 establishes the reusable CRUD shape for schemas, service functions, router
registration, route tests, not-found responses, and timestamp handling. It is
the smallest resource and the parent for activities, so it should land first.

B2.2 depends on B2.1 because activities require an existing activity class and
the list filters include `class_id` and `is_active`. This ticket proves the
service can validate parent references without moving persistence logic into
routers.

B2.3 depends on B2.2 because activity logs require activities, add the first
delete path, add date and relationship-based filters, and persist JSON rule
violation snapshots. It should reuse the CRUD and test patterns created by the
first two tickets.

B2.4 depends on B2.3 only for shared route/service patterns, not for data. It is
the first non-trivial write workflow: POST has upsert semantics on
`(user_id, check_in_date)`, `/today` resolves a server date, and responses may
compose a linked flare-up object.

B2.5 follows B2.4 because standalone incidents and check-in-linked incidents
share response composition rules. It completes the Phase 2 incident surface
without adding delete behavior that the API contract does not currently expose.

---

## B2.1 — ActivityClass CRUD API

**Type:** backend
**Branch:** `feat/phase-2-core-crud-api`
**Depends on:** Phase 1 database models, migrations, and seed script complete

### Acceptance criteria
- Tests for the ActivityClass API are written before production router/service
  code. They should fail first because `/api/activity-classes` routes are
  missing.
- `backend/app/schemas/activity_classes.py` defines typed Pydantic/SQLModel
  schemas for create, patch, and read responses.
- Create request fields include `id`, `name`, `description`, `type`, and
  optional `default_recovery_window_days`.
- Create requests do not accept `user_id`, `created_at`, or relationship fields.
- Patch requests allow partial updates to `name`, `description`, `type`, and
  `default_recovery_window_days`.
- Read responses include `id`, `name`, `description`, `type`,
  `default_recovery_window_days`, and `created_at`; they do not expose
  `user_id`.
- `backend/app/services/activity_classes.py` owns all ActivityClass database
  access and creates rows with `user_id = "local"`.
- `GET /api/activity-classes` returns all local classes ordered by `name`
  ascending, then `id` ascending for deterministic tests.
- `POST /api/activity-classes` creates one class and returns status `201` with
  the read response body.
- `POST /api/activity-classes` uses default recovery window `3` when omitted.
- `PATCH /api/activity-classes/{class_id}` updates only fields present in the
  request body and returns the updated read response.
- Missing class IDs return HTTP `404` with a stable error detail.
- Duplicate IDs return HTTP `409 Conflict`; reuse this pattern for later Phase
  2 create routes.
- The router is registered in `backend/app/main.py` through the existing app
  factory.
- Route tests use `httpx.AsyncClient` with `ASGITransport`, a temporary SQLite
  database, and a dependency override for `get_session`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/activity.py::ActivityClass`.
- Reuse `backend/app/database.py::get_session` as the dependency boundary.
- Reuse the existing health-route test style for ASGI route tests.
- Extend `backend/app/schemas/__init__.py`, `backend/app/services/__init__.py`,
  and `backend/app/routers/__init__.py` only if the repo pattern needs explicit
  exports.

### Recommended test scope
- API-level integration tests are the right primary coverage because this ticket
  defines the router, schemas, service persistence, and response shape together.
- Add direct service tests only if error mapping or update behavior becomes hard
  to exercise clearly through the API.
- Do not mock SQLModel sessions for the main behavior.

### Edge cases to handle
- Empty database returns an empty list, not `404`.
- Patch with an empty JSON object is allowed and returns the unchanged row.
- `default_recovery_window_days` must remain non-null after create and patch.
- Invalid enum-like `type` values may be accepted as strings until a shared enum
  strategy is approved; do not add schema-level enum changes without updating
  docs.

### Files to create / modify
- `backend/app/schemas/activity_classes.py`
- `backend/app/services/activity_classes.py`
- `backend/app/routers/activity_classes.py`
- `backend/app/main.py`
- `backend/app/tests/` activity-class route/service test module(s)

---

## B2.2 — Activity CRUD API with class and active-state filters

**Type:** backend
**Branch:** `feat/phase-2-core-crud-api`
**Depends on:** `B2.1`

### Acceptance criteria
- Tests for the Activity API are written before production router/service code.
  They should fail first because `/api/activities` routes are missing.
- `backend/app/schemas/activities.py` defines typed create, patch, and read
  schemas.
- Create request fields include `id`, `activity_class_id`, `name`, `type`,
  `default_volume_unit`, and optional `is_active`.
- Create requests do not accept `user_id`, timestamps, relationship objects, or
  activity-class embedded payloads.
- `is_active` defaults to `true` when omitted from create requests.
- Patch requests allow partial updates to `activity_class_id`, `name`, `type`,
  `default_volume_unit`, and `is_active`.
- Read responses include `id`, `activity_class_id`, `name`, `type`,
  `default_volume_unit`, `is_active`, `created_at`, and `updated_at`; they do
  not expose `user_id`.
- `backend/app/services/activities.py` owns all Activity database access,
  parent-class validation, filtering, and update behavior.
- `GET /api/activities` returns local activities ordered by `name` ascending,
  then `id` ascending.
- `GET /api/activities?class_id=<id>` returns only activities in that class.
- `GET /api/activities?is_active=true` returns only active activities.
- `GET /api/activities?is_active=false` returns only inactive activities.
- Combining `class_id` and `is_active` applies both filters.
- `POST /api/activities` creates one activity and returns status `201`.
- Creating or patching an activity to a missing `activity_class_id` returns a
  stable client error documented in the test expectation.
- `PATCH /api/activities/{activity_id}` supports deactivation and reactivation
  by changing `is_active`.
- Missing activity IDs return HTTP `404` with a stable error detail.
- Duplicate IDs follow the duplicate-ID pattern selected in `B2.1`.
- `updated_at` changes on successful patch and stays present in responses.
- The router is registered in `backend/app/main.py`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/activity.py::ActivityClass` and `Activity`.
- Reuse the ActivityClass route test database fixture pattern from `B2.1`.
- Reuse any shared timestamp helper introduced in `B2.1`; do not create a
  second timestamp style.

### Recommended test scope
- Use route integration tests with real temporary SQLite rows for parent classes
  and activities.
- Cover list filters through API tests because query parsing and persistence
  filtering are both part of the contract.
- Avoid broad seed-data tests; small explicit fixtures are easier to reason
  about for this CRUD surface.

### Edge cases to handle
- Empty list filters return `[]`, not an error.
- Boolean query parsing should accept FastAPI's normal `true` and `false`
  values; tests should cover both states.
- Patch with an empty JSON object is allowed and returns the unchanged row.
- Deactivated activities remain fetchable through list routes unless
  `is_active=true` is supplied.

### Files to create / modify
- `backend/app/schemas/activities.py`
- `backend/app/services/activities.py`
- `backend/app/routers/activities.py`
- `backend/app/main.py`
- `backend/app/tests/` activity route/service test module(s)

---

## B2.3 — ActivityLog CRUD API with date, activity, and class filters

**Type:** backend
**Branch:** `feat/phase-2-core-crud-api`
**Depends on:** `B2.2`

### Acceptance criteria
- Tests for the ActivityLog API are written before production router/service
  code. They should fail first because `/api/activity-logs` routes are missing.
- `backend/app/schemas/activity_logs.py` defines typed create, patch, and read
  schemas.
- Create request fields include `id`, `activity_id`, `logged_date`,
  `duration_minutes`, `volume_value`, optional `volume_unit`, optional `rpe`,
  optional `post_activity_feel`, optional `notes`, and optional
  `rule_violations_at_log`.
- Create requests do not accept `user_id`, timestamps, or embedded activity
  objects.
- Patch requests allow partial updates to all client-owned log fields except
  `id`.
- Read responses include all persisted log fields except `user_id`.
- `rule_violations_at_log` accepts and returns a JSON array of objects without
  losing nested string/number fields.
- `backend/app/services/activity_logs.py` owns all ActivityLog database access,
  parent-activity validation, filtering, JSON snapshot persistence, and delete
  behavior.
- `GET /api/activity-logs` returns local logs ordered by `logged_date`
  descending, then `created_at` descending, then `id` ascending.
- `GET /api/activity-logs?from=YYYY-MM-DD` returns logs on or after the start
  date.
- `GET /api/activity-logs?to=YYYY-MM-DD` returns logs on or before the end date.
- `GET /api/activity-logs?activity_id=<id>` returns only logs for that
  activity.
- `GET /api/activity-logs?class_id=<id>` returns only logs whose activity
  belongs to that class.
- Combining filters applies all supplied filters.
- `POST /api/activity-logs` creates one log and returns status `201`.
- Creating or patching a log to a missing `activity_id` returns a stable client
  error.
- `PATCH /api/activity-logs/{log_id}` updates only present fields, including
  setting nullable fields to `null` when explicitly supplied.
- `DELETE /api/activity-logs/{log_id}` removes the row and returns status `204`
  with no response body.
- Missing log IDs return HTTP `404` for patch and delete.
- Duplicate IDs follow the duplicate-ID pattern selected in `B2.1`.
- The router is registered in `backend/app/main.py`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/log.py::ActivityLog`.
- Reuse `Activity` and `ActivityClass` fixture helpers from earlier Phase 2
  tests.
- Reuse any shared not-found, duplicate-ID, and timestamp helper introduced in
  earlier tickets if it is already cleanly factored.

### Recommended test scope
- Use API integration tests with real temporary SQLite data because list
  filtering crosses the `activity_logs -> activities -> activity_classes`
  relationship.
- Include a JSON roundtrip assertion for `rule_violations_at_log`.
- Include delete verification by checking the row is no longer returned by list
  or patch routes.

### Edge cases to handle
- `from` later than `to` should return an empty list rather than failing unless
  the implementation chooses to validate it explicitly. Lock the chosen behavior
  in tests.
- Logs for inactive activities still remain visible and editable.
- `rpe` may be omitted or null; database constraints still reject values outside
  `1..10`.
- `volume_unit` can be null even when the activity has a default unit; do not
  silently overwrite a provided null unless the product contract changes.

### Files to create / modify
- `backend/app/schemas/activity_logs.py`
- `backend/app/services/activity_logs.py`
- `backend/app/routers/activity_logs.py`
- `backend/app/main.py`
- `backend/app/tests/` activity-log route/service test module(s)

---

## B2.4 — DailyCheckIn CRUD API with date upsert and embedded flare-up response

**Type:** backend
**Branch:** `feat/phase-2-core-crud-api`
**Depends on:** `B2.3`

### Acceptance criteria
- Tests for the DailyCheckIn API are written before production router/service
  code. They should fail first because `/api/daily-check-ins` routes are
  missing.
- `backend/app/schemas/daily_check_ins.py` defines typed create/upsert, patch,
  flare-up sub-payload, and read schemas.
- Create/upsert request fields include `id`, `check_in_date`, `pain_level`,
  `readiness_level`, `stiffness_level`, `has_flare_up`, optional `notes`, and
  optional `flare_up`.
- `flare_up` request fields include enough data to create or update a linked
  incident: `id`, `body_part`, `severity`, optional `activity_class_id`, and
  optional `notes`.
- Requests do not accept `user_id`, timestamps, or arbitrary embedded incident
  collections.
- Read responses include `id`, `check_in_date`, `pain_level`,
  `readiness_level`, `stiffness_level`, `has_flare_up`, `notes`, `created_at`,
  `updated_at`, and optional embedded `flare_up`; they do not expose `user_id`.
- Embedded `flare_up` in read responses is composed from the linked
  `flare_up_incidents` row rather than duplicated JSON on `daily_check_ins`.
- `backend/app/services/daily_check_ins.py` owns all check-in database access,
  date lookup, upsert behavior, and linked incident creation/update/removal
  decisions.
- `GET /api/daily-check-ins` returns local check-ins ordered by
  `check_in_date` descending, then `id` ascending.
- `GET /api/daily-check-ins` supports optional `from` and `to` date filters if
  already listed in `docs/api-map.md`; if the doc is not updated yet, add the
  filter behavior there in this ticket.
- `GET /api/daily-check-ins/{date}` fetches the local check-in for that
  `YYYY-MM-DD` date.
- `GET /api/daily-check-ins/{date}` returns `404` when no check-in exists for
  the date.
- `GET /api/daily-check-ins/today` resolves the server's local date and returns
  today's check-in when present.
- `GET /api/daily-check-ins/today` returns `404` when today's check-in is
  missing; the dashboard CTA behavior is Phase 5 scope.
- `POST /api/daily-check-ins` creates a check-in when none exists for
  `(user_id, check_in_date)` and returns status `201`.
- `POST /api/daily-check-ins` updates/replaces the existing check-in for
  `(user_id, check_in_date)` when one already exists and returns status `200`.
- Upsert preserves the existing check-in primary key unless the implementation
  deliberately replaces the row. Choose one behavior and lock it in tests.
- If `has_flare_up=true` and `flare_up` is supplied, POST creates or updates one
  linked `flare_up_incidents` row with `daily_check_in_id` set.
- If `has_flare_up=false`, the read response returns no embedded `flare_up` and
  any existing check-in-linked flare-up incident is deleted.
- `PATCH /api/daily-check-ins/{date}` updates only present check-in fields and
  linked flare-up fields when supplied.
- Missing date IDs return HTTP `404` for patch.
- The router is registered in `backend/app/main.py`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/checkin.py::DailyCheckIn` and `FlareUpIncident`.
- Reuse `ActivityClass` fixture helpers for linked likely-cause class tests.
- Reuse route test fixtures and API error patterns from earlier Phase 2 tickets.
- Extend `docs/api-map.md` in this ticket only if final implemented check-in
  filters or response composition details differ from the current doc.

### Recommended test scope
- Use API integration tests with a real temporary SQLite database because upsert
  and embedded flare-up composition rely on uniqueness constraints and
  relationships.
- Test the service behavior for upsert directly only if the route tests become
  too broad to diagnose failures cleanly.
- Time-dependent `/today` tests should monkeypatch or dependency-inject the date
  source rather than relying on the real wall clock.

### Edge cases to handle
- `pain_level`, `readiness_level`, and `stiffness_level` must stay within
  `0..10`; invalid values should fail before or at persistence with a client
  error.
- A check-in can exist with `has_flare_up=true` and no detailed flare-up payload
  only if the API contract explicitly allows it; otherwise return a validation
  error.
- A linked flare-up's `activity_class_id` may be null.
- At most one check-in-sourced embedded flare-up should be returned for a
  check-in, even though the relational model can technically store more.

### Files to create / modify
- `backend/app/schemas/daily_check_ins.py`
- `backend/app/services/daily_check_ins.py`
- `backend/app/routers/daily_check_ins.py`
- `backend/app/main.py`
- `backend/app/tests/` daily-check-in route/service test module(s)
- `docs/api-map.md` only if check-in filter or response details need sync

---

## B2.5 — FlareUpIncident CRUD API

**Type:** backend
**Branch:** `feat/phase-2-core-crud-api`
**Depends on:** `B2.4`

### Acceptance criteria
- Tests for the FlareUpIncident API are written before production router/service
  code. They should fail first because `/api/flare-up-incidents` routes are
  missing.
- `backend/app/schemas/flare_up_incidents.py` defines typed create, patch, and
  read schemas.
- Create request fields include `id`, `incident_date`, `body_part`, `severity`,
  optional `activity_class_id`, optional `daily_check_in_id`, and optional
  `notes`.
- Create requests do not accept `user_id`, timestamps, or embedded parent
  objects.
- Patch requests allow partial updates to `incident_date`, `body_part`,
  `severity`, `activity_class_id`, `daily_check_in_id`, and `notes`.
- Read responses include all persisted incident fields except `user_id`.
- `backend/app/services/flare_up_incidents.py` owns all incident database
  access, parent reference validation, filtering, and update behavior.
- `GET /api/flare-up-incidents` returns local incidents ordered by
  `incident_date` descending, then `created_at` descending, then `id` ascending.
- `GET /api/flare-up-incidents` supports optional `from`, `to`, and
  `activity_class_id` filters only if added to `docs/api-map.md` in this ticket;
  otherwise keep the Phase 2 route as an unfiltered list.
- `POST /api/flare-up-incidents` creates one standalone or check-in-linked
  incident and returns status `201`.
- `activity_class_id` is optional and may be null.
- If `activity_class_id` is supplied, the service validates that the class
  exists for the local user.
- If `daily_check_in_id` is supplied, the service validates that the check-in
  exists for the local user.
- `PATCH /api/flare-up-incidents/{incident_id}` updates only fields present in
  the request body, including setting nullable fields to `null` when explicitly
  supplied.
- Missing incident IDs return HTTP `404` with a stable error detail.
- Duplicate IDs follow the duplicate-ID pattern selected in `B2.1`.
- No `DELETE /api/flare-up-incidents/{incident_id}` route is added in Phase 2
  unless `docs/api-map.md` is explicitly updated and owner-approved.
- The router is registered in `backend/app/main.py`.
- `make test` and `make lint` pass for the scoped change before commit.

### Reuse / extend
- Reuse `backend/app/models/checkin.py::FlareUpIncident`.
- Reuse `DailyCheckIn` and `ActivityClass` fixture helpers from earlier tickets.
- Reuse shared API error and timestamp helpers already established in Phase 2.

### Recommended test scope
- Use API integration tests with temporary SQLite data for parent validation and
  nullable relationship behavior.
- Include tests for standalone incidents, class-linked incidents, and
  check-in-linked incidents.
- Do not duplicate the DailyCheckIn embedded response tests here; this ticket
  only needs to prove the incident resource itself works.

### Edge cases to handle
- `severity` must stay within the schema's `0..10` persisted constraint, even
  if UI copy later labels the incident slider as `1..10`.
- Nulling `activity_class_id` or `daily_check_in_id` on patch should detach the
  optional relationship without deleting the parent row.
- Incidents linked to check-ins are still visible in the incident list.
- A missing likely-cause class should not create a new activity class implicitly.

### Files to create / modify
- `backend/app/schemas/flare_up_incidents.py`
- `backend/app/services/flare_up_incidents.py`
- `backend/app/routers/flare_up_incidents.py`
- `backend/app/main.py`
- `backend/app/tests/` flare-up incident route/service test module(s)
- `docs/api-map.md` only if incident filters or delete behavior are approved

## Owner decisions resolved

- Phase 2 API payloads stay snake_case. Frontend camelCase adaptation, if
  needed, belongs in the Phase 6 API client.
- Duplicate client-supplied IDs return HTTP `409 Conflict`.
- Updating a daily check-in to `has_flare_up=false` deletes the linked
  check-in-sourced flare-up incident.
