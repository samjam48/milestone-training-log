# Backlog

Follow-up items that are intentionally out of scope for the current task but should be handled before or during backend and frontend scaffolding.

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

- Refactor `check_violations` in `load_engine.py` — radon F-rank complexity; extract per-rule helpers when extending.
- Add API integration test for `elevated_load` without active block on `GET /api/load/delayed-tax`.

## Phase 6 / 7 follow-ups

- ~~Phase 6 F1.3: full Log History via `GET /api/activity-logs`~~ — ticketed in
  `plans/tickets-phase-6-frontend-2026-05-28.md`.
- Phase 7: wire `recovery_streaks` compliance UI (hook maps field in Phase 6 F1.3).
- Phase 7: delayed-tax / load-risk dashboard panel (`GET /api/load/delayed-tax`).
- Phase 7: `CalendarHeatmap` on Settings / block-review using hook `dailyScores`.
- Phase 6 F1.4: replace hardcoded `cls-foot` display labels with `activityClasses` lookup.
