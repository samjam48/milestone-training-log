# Phase 6 Cleanup — Seed violation snake_case + dashboard guard
*Chore fix on `feat/phase-6-frontend` | Date: 2026-05-28*

## Context

Live integration exposed `GET /api/dashboard` returning **500** when seed data
includes activity logs with `rule_violations_at_log`. The seed helper `_violation()`
writes **camelCase** keys (`ruleId`, `ruleType`) copied from the frozen prototype,
but backend API schemas expect **snake_case** (`rule_id`, `rule_type`).

Symptoms when dashboard 500s: empty dashboard, "Invalid Date", check-in CTA never
hides, Log Activity picker empty (no `activity_classes`).

## Goal

Ensure seeded and persisted violation snapshots use backend snake_case conventions
so dashboard and daily_scores validation succeed.

## Acceptance criteria

- `backend/scripts/seed.py` `_violation()` emits `rule_id`, `rule_type` (not camelCase).
- `backend/app/tests/test_seed_data.py` updated to assert snake_case in stored JSON.
- New or extended test: after seed (or fixture log with violations),
  `GET /api/dashboard` returns **200** and `daily_scores[].violations[].rule_id` is present
  when seed logs include violations.
- No frontend changes required for this ticket.

## Out of scope

- Migrating existing owner DB files with camelCase JSON (re-seed is acceptable).
- Engine normalization of legacy camelCase blobs (optional follow-up in BACKLOG).
- Phase 8 error UI for failed dashboard fetch.

## Files

- `backend/scripts/seed.py`
- `backend/app/tests/test_seed_data.py`
- `backend/app/tests/test_dashboard_api.py` (or new focused test module)

**Status:** Ready for Test Writer.
