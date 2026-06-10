# Backlog

Follow-up items outside the current sprint (`AGENTS.md`). Phase 0–10 tickets
are archived in `plans/archive/phase-0-10/`.

**Small UX updates**
- Log:
  - Log page - Day and week have cleaner visible breaks.
  - Logging - Exercises whose unit is minutes do not show an input unit as it is just minutes, value is just a copy
- Dashboard
    - Load risk section - for daily or weekly limits - put the work before the progress bar
    - Activity status - Today instead of 0 days ago
    - Clean streak - doesn't flag rule violations
- Rules block:
  - What is 'All classes'?
  - Preview Items grouping:
    - Same property have one title and then drop down.
    - Exercises matched to their class
  - Edit rules:
    - 'i' icon for info
    - settings in line and smaller
    - Delete is a bin rather than a word
- Log incident:
  - Where are incidents ever shown? - Maybe in log history??
  - Viewing old logs before confirming, no real functionality.
  - Confim button is squished




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
| ~~Recovery streaks UI~~ | **Retired (WTL.F6)** — F10.1 dashboard section removed; recovery weekly targets live in **This week** |
| `CalendarHeatmap` + block review | `BlockSafetyMapSection` on Dashboard; `BlockReviewScreen` from Settings **Review** / **View** |
| Edit goal | `GoalEditorScreen` via `GoalsScreen` → `onEditGoal` |
| Edit / deactivate activity | `ActivityManagerScreen` + Settings inline confirm; `updateActivity` / `deactivateActivity` on hook |
| View previous block / active block Review | `App.tsx` → `block-review` stack with `blockId` param |

## Stage 5 — Native app + widgets (long-term)

Tracked in `plans/PRD.md` §13. Android-first native shell + home-screen quick-entry widgets (log, check-in). iOS optional. Requires Capacitor (or equivalent) and notification backend if prefs toggles become real.

## Stage 2.5 — Usage-driven logic & UX (complete on branch, 2026-06-06)

**Planning:** `plans/feature-brief-stage-2-5-usage-logic-2026-06-06.md`, `plans/technical-design-stage-2-5-usage-logic-2026-06-06.md`

**Tickets:** `plans/tickets-stage-2-5-usage-logic-2026-06-06.md` (S25.B1–S25.D1 implemented; **O25.1** owner smoke pending).

**Branch:** `feat/stage-2-5-usage-logic`

Delivered themes: activity-linked goal auto-progress; log date + edit; class/exercise caps + weekly goals in Edit Rules; suggestion buckets; load-risk ↔ caps; activity class edit/delete (Settings); incident/check-in body-part chips.

| Item | Ticket | Status |
| --- | --- | --- |
| Goal editor sticky save + activity link + auto-track | S25.F1 | Done |
| Goals dashboard card | S25.F2 | Done |
| Log date picker (create) | S25.F3 | Done |
| Edit log flow | S25.F4 | Done |
| Edit Rules class sections + weekly targets + exercise rules | S25.F5 | Done |
| Suggestion buckets (do/rest/done) | S25.F6 | Done |
| Load risk summary UI | S25.F7 | Done |
| Activity class edit/delete (Settings) | S25.F8 | Done |
| Body-part chips from incidents + check-ins | S25.F9 | Done |
| Cross-class rules removed | S25.B2 | Done |
| Weekly volume target editor | S25.F5 | Done (was read-only) |
| Activity class editor | S25.F8 | Done (was create-only) |
| Incident chips from check-in history | S25.F9 | Done |

## Stage 2.5 polish follow-up (owner feedback, 2026-06-06)

**Tickets:** `plans/tickets-stage-2-5-polish-followup-2026-06-06.md` (P25.2–P25.7)

Owner decisions **locked and signed off** 2026-06-06: exercise daily + weekly volume caps (km/minutes/hours); no class load caps; no abstract load points; sanitized rule labels (rest vs frequency vs consecutive); centered modals; compact date popover.

| Item | Ticket | Status |
| --- | --- | --- |
| Rule labels: rest vs frequency vs consecutive | P25.6 | Done |
| Exercise volume caps + units; drop load points UI | P25.7 | Done |
| Centered modals (class new/edit/delete) | P25.2 | Done |
| Edit activity → centered modal (no deactivate) | P25.3 | Done |
| New activity → centered modal | P25.4 | Done |
| Date picker → compact popover | P25.5 | Done |
| Edit Rules: surface API errors on rule create | P25.8 | Done (D1) |
| Remove weekly goal from Edit Rules | P25.9 | Done (D2) |

## Stage 2.5 review decisions (2026-06-06)

| # | Issue | Decision |
| --- | --- | --- |
| D1 | F5 duplicate rule API errors not shown | **Implement** — ticket **P25.8** |
| D2 | F5 weekly goal one-click in Edit Rules | **Remove** weekly goal from Edit Rules; use Goals tab → **P25.9** |
| D3 | F3/F4 optimistic save pops on API failure | **Fixed (2026-06-07)** — `submitLog` / `updateLog` return promises; Log Activity awaits API before success UI / navigation |

## Stage 2.5 technical debt (non-blocking, from review)

Recorded after S25 batch review; not in polish ticket scope unless noted.

| Item | Source | Note |
| --- | --- | --- |
| `check_violations` uses class-level rules, not `effective_rules_for_activity` | S25.B4 | Dashboard class status vs log-time violations may diverge when exercise rules exist |
| Class delete: `recovery_targets` / `flare_incidents` FKs not guarded | S25.B8 | May **500** instead of **409**; add guards or document cascade |
| `fill_ratio` not server-clamped to 0..1 | S25.B7 | UI caps bar at 100%; API may return &gt;1 when over-achieved |
| Postgres migration gate | S25.B1 | Run `make test-postgres` before prod deploy |
| `docs/api-map.md` rules section stale rule-type count | S25.B2 | Dashboard section updated in D1; rules table may still say “five types” |
| Exercise-scoped rule **409** on class delete untested | S25.B8 | Implemented; only class-level rule test exists |
| eslint `react-refresh/only-export-components` warnings (3) | lint | Pre-existing in UI files |
| ~~Log create/edit optimistic pop on mutation failure~~ | S25.F4 (D3) | **Done** — async save with loading overlay + inline error |
| ~~Dashboard `weekly_progress` vs Goals after P25.9~~ | P25.9 → WTL | **Superseded (WTL)** — dashboard **This week** and Goals **Weekly target** both use `weekly_targets`; Edit Rules no longer edits targets. |
| ~~`weekly_targets` display-only lifecycle~~ | P25.9 → WTL | **Superseded (WTL)** — full activity-scoped CRUD on Goals; legacy class rows readable. |
| `weekly_load_cap` in seed / local DB | Owner 2026-06-07 | Removed from `seed_data.py`; new creates blocked in API. **Production:** if legacy rows exist in Supabase, delete manually or leave disabled — engine still evaluates them if enabled. |

## Weekly targets, load risk & load tax (WTL batch)

**Tickets:** `plans/tickets-weekly-targets-load-risk-2026-06-07.md` (WTL.B1–B7, F1–F7, D1–D2 implemented; **OWTL.1** owner smoke pending)

Delivered themes: activity-scoped weekly targets with migration from weekly `recovery_targets`; dashboard **This week** progress (Monday–Sunday); Goals weekly-target flow; load-tax graph (30-day series); load-risk `rule_limit_rows`; recovery streaks UI retired.

| Item | Ticket | Status |
| --- | --- | --- |
| Weekly target schema + migration | WTL.B1 | Done |
| Weekly target CRUD API | WTL.B2 | Done |
| Dashboard weekly progress This week | WTL.B3, WTL.F1 | Done |
| Goals weekly target UX | WTL.F2 | Done |
| Weekly target suggestions | WTL.B4, WTL.F3 | Done |
| Load-tax formula + graph series | WTL.B5, WTL.F4 | Done |
| Load risk rule-limit rows | WTL.B6, WTL.F5 | Done |
| Recovery streaks UI removed | WTL.F6 | Done |
| Weekly focus lifecycle design | WTL.D1 | Done — **superseded by WRU** (see below) |
| Weekly focus backend lifecycle | WTL.B7 | Done — **lazy cutover path superseded by WRU.B1** |
| Settings weekly focus UI | WTL.F7 | Done — **focus-title / setup / reset UX superseded by WRU.F1** |
| Living docs sync | WTL.D2 | Done — refreshed again in **WRU.D1** |

### WTL legacy / future (not weekly focus)

| Item | Ticket | Note |
| --- | --- | --- |
| Daily recovery streaks product path | — | **Legacy** — daily `recovery_targets` rows and `recovery_streaks` API field remain; no dashboard section. Owner decision still open: retire storage, or replan true streaks from weekly target history. |
| Recovery streak feature (true streaks) | — | **Future** — derive consecutive-week completion from recovery-style **weekly target** history, not the retired F10.1 dashboard section or legacy `recovery_streaks` API field. Clean streak remains separate. |

## Weekly rules unification (WRU batch)

**Tickets:** `plans/tickets-weekly-rules-unification-2026-06-08.md` (WRU.B1–F2, D1 implemented on `fix/stage-2-5-lingering-issues`; **OWRU.1** owner smoke pending)

Supersedes WTL.B7 lazy cutover, WTL.F7 focus-title/setup/reset UX, and month-style **Training Block** create flows. One **weekly rules** path only.

| Item | Ticket | Status |
| --- | --- | --- |
| Big-bang migration + seed weekly periods | WRU.B1 | Done |
| Always-weekly resolution + auto-create | WRU.B2 | Done |
| Settings weekly rules UI + previous-weeks modal | WRU.F1 | Done |
| Remove new-block screen + dead APIs | WRU.F2 | Done |
| Living docs + backlog sync | WRU.D1 | Done |
| Post-WRU test suite alignment (`make test` green) | WRU.T1 | Done |
| Owner smoke before merge | OWRU.1 | Pending (owner smoke OK; blocked on WRU.T1) |

## Product gaps still open (not in the list above)

- **Settings preference toggles** — Notifications and Metric units are local React state only (prototype; no backend).
