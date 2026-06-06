# Backlog

Follow-up items outside the current sprint (`AGENTS.md`). Phase 0–10 tickets
are archived in `plans/archive/phase-0-10/`.

## Stage 2 polish — complete (2026-06)

Delivered per `plans/tickets-stage-2-polish-2026-06-05.md` (S2.1–S2.9 + PWA S2.10).
New usage-driven tweaks go in a follow-up batch (owner backlog), not this section.

## Phase 11 / production follow-ups

- Render keep-alive or paid tier if cold starts become painful on daily use.
- Custom domain + HTTPS on Netlify; update `netlify.toml` proxy if Render host changes.
- Automated Supabase backup export (cron / GitHub Action) if manual runbook is insufficient.
- Migrate local dev to Postgres (optional) — only if SQLite/Postgres drift causes bugs.

## Repo Alignment Follow-Ups

- Decide the final backend shared-module layout before scaffolding and update `plans/milestone-architecture.md` to match. The main open choice is whether shared files live directly under `backend/app/` or under subfolders such as `backend/app/core/`.
- Reconcile any remaining differences between `plans/milestone-architecture.md` and the living docs in `docs/api-map.md`, `docs/database-schema.md`, and `docs/patterns.md` before the first real backend tickets are written.
- Add thin Cursor workspace rules only if you actually want tool-native wrappers. Until then, `AGENTS.md`, `CLAUDE.md`, and `docs/ai/*` are the source of truth.
- Add thin Claude skill wrappers only if you want in-tool discovery shortcuts. Do not duplicate the real guidance if those wrappers are created.
- Add automation scripts or git hooks only after the repo scaffold exists and the team decides they are worth maintaining. The current docs intentionally do not assume those files exist.
- Revisit the canonical file examples in `docs/patterns.md` once the actual frontend and backend folder names land, and update the doc in the same scaffolding change if naming differs.
- Decide whether Phase 1 keeps a `user_id = "local"` field on persisted entities or omits `user_id` entirely until multi-user support exists. Keep the choice consistent across models, migrations, and docs.
- Confirm whether flare-up incidents need many-to-many links to likely triggering activity classes. If yes, plan a join table rather than arrays or JSON.

## Phase 4 follow-ups

- ~~Refactor `check_violations` in `load_engine.py` — radon F-rank complexity; extract per-rule helpers when extending.~~ (B10.5)
- ~~Add API integration test for `elevated_load` without active block on `GET /api/load/delayed-tax`.~~ — **B10.6** (Phase 10).

## Phases 6–10 deferred UI — complete on `main` (verified 2026-06-06)

These were tracked as Phase 6/7/8/9 follow-ups; all are implemented. See
`plans/archive/phase-0-10/tickets-phase-10-polish-2026-06-04.md` for the
Phase 10 ticket set that closed the last gaps.

| Item | Where it lives now |
| --- | --- |
| Log History via `GET /api/activity-logs` | `LogHistoryScreen` + hook `activityLogs` query (Phase 6 F1.3) |
| `activityClasses` display labels (was F1.4 / `cls-foot`) | Dashboard graph title + class status; `delayedTaxDisplay`; log rows use `activities` lookup |
| Delayed-tax / load-risk panel | `LoadRiskSection` on `DashboardScreen` (F10.3); symptom attribution on check-in/incident (F10.4) |
| Recovery streaks UI | **Dashboard** section (F10.1) — owner D1 moved off Settings |
| `CalendarHeatmap` + block review | `BlockSafetyMapSection` on Dashboard; `BlockReviewScreen` from Settings **Review** / **View** |
| Edit goal | `GoalEditorScreen` via `GoalsScreen` → `onEditGoal` |
| Edit / deactivate activity | `ActivityManagerScreen` + Settings inline confirm; `updateActivity` / `deactivateActivity` on hook |
| View previous block / active block Review | `App.tsx` → `block-review` stack with `blockId` param |

## Stage 5 — Native app + widgets (long-term)

Tracked in `plans/PRD.md` §13. Android-first native shell + home-screen quick-entry widgets (log, check-in). iOS optional. Requires Capacitor (or equivalent) and notification backend if prefs toggles become real.

## Stage 2.5 — Usage-driven logic & UX (approved 2026-06-06)

**Planning:** `plans/feature-brief-stage-2-5-usage-logic-2026-06-06.md`, `plans/technical-design-stage-2-5-usage-logic-2026-06-06.md`

Themes: goal editor + activity-linked auto-progress; log date + edit; block caps + weekly goals in Edit Rules (Option A); suggestion buckets; load-risk ↔ caps; activity class edit/delete; incident chips from check-ins.

**Branch:** `feat/stage-2-5-usage-logic` (when implementation starts). Ticket file pending planner.

## Product gaps still open (not in the list above)

- **Weekly volume target editor** — targets display on Settings active-block card; no create/edit UI (set at block creation only).
- **Activity class editor** — create via Settings `NewActivityClassForm`; no edit/rename existing class.
- **Settings preference toggles** — Notifications and Metric units are local React state only (prototype; no backend).
- **Incident body-part chips from check-in history** — deferred in Stage 2 (S2.5 uses incident history only).
