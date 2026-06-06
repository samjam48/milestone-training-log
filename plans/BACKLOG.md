# Backlog

Follow-up items outside the current sprint (`AGENTS.md`). Phase 0–10 tickets
are archived in `plans/archive/phase-0-10/`.

## Stage 2 polish (in tickets — see `plans/tickets-stage-2-polish-2026-06-05.md`)

Implementation tracked there (S2.1–S2.9): bottom CTA inset, login password toggle, Android/history back, incident body-part suggestions, activity class + activity creation, Log tab **+ New Activity**, empty log flows. PWA: optional S2.10.

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

## Phase 6 / 7 follow-ups

- ~~Phase 6 F1.3: full Log History via `GET /api/activity-logs`~~ — ticketed in
  `plans/archive/phase-0-10/tickets-phase-6-frontend-2026-05-28.md`.
- Phase 8: wire `recovery_streaks` compliance UI (hook maps field in Phase 6 F1.3). *(re-routed from Phase 7, owner 2026-05-30 — dashboard surface, outside screen-port scope)*
- Phase 8: delayed-tax / load-risk dashboard panel (`GET /api/load/delayed-tax`). *(re-routed from Phase 7, owner 2026-05-30)*
- Phase 7.5: `CalendarHeatmap` on Settings / block-review using hook `dailyScores`. *(home screen Settings is built in Phase 7; worth doing right after — owner 2026-05-30)*
- Phase 6 F1.4: replace hardcoded `cls-foot` display labels with `activityClasses` lookup.
