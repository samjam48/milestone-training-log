# Weekly Rules Unification — Remove Legacy Training Blocks

*Source: owner feedback 2026-06-08 (updated), `plans/technical-design-weekly-focus-2026-06-07.md`, WTL.B7/F7 gap review | Date: 2026-06-08*

---

## Owner decisions locked

| # | Topic | Decision |
| --- | --- | --- |
| D1 | Production history | **No production users/data to preserve.** Do not convert or preserve legacy block history. |
| D2 | Cutover strategy | **Big-bang Alembic migration** on upgrade — not lazy cutover. |
| D3 | User-facing name | Rename **Training Block** → **Weekly rules**. Drop “Training block”, “Weekly focus”, and month-style block language. |
| D4 | Create block flow | **Remove** `+ New Training Block`, `NewTrainingBlockScreen`, date-range creation, and **`POST /api/training-blocks`**. |
| D5 | Legacy code paths | **Remove** dual UI, `period_kind = legacy`, lazy cutover, dashboard legacy fallback, focus-title/reset/setup flows. One weekly path only. |
| D6 | Edit rules + Review | **Keep** from the active weekly rules card. |
| D7 | Previous weeks in Settings | Show **only the most recent completed week** inline. Tapping **“Previous weeks”** opens a modal with the full scrollable list → block review. After migration, list starts empty until real Monday rollovers occur. |
| D8 | Active card label | **Calendar week only** (e.g. `Jun 2 – Jun 8`) — no editable focus title in UI. |
| D9 | Legacy data on migrate | **Delete all previous block rows** (completed and active). Copy **enabled rules** (and **weekly targets**) from the **single active legacy block** into **one new current-calendar-week row** only. No conversion of old blocks into history. |
| D10 | Seed | Update **`backend/app/services/seed_data.py`** (and seed path) to create **weekly** periods — not month-style legacy blocks. |

## Resolved questions (2026-06-08)

| # | Question | Owner answer |
| --- | --- | --- |
| Q1 | Focus title vs calendar label? | **Calendar label only** on the active card. |
| Q2 | Reset focus / Set up weekly rules? | **Remove both from UI and API.** (These were: starting a new multi-week “focus series” at week 1, and a first-time manual setup dialog. Weekly period is **auto-created** by `ensure_active_weekly_focus` — no owner action required.) |
| Q3 | What happens to old blocks in dev DB? | **Delete all.** Copy rules/targets from active legacy into the new current week only. |
| Q4 | `POST /api/training-blocks`? | **Remove entirely.** |

---

## Scope summary

| Area | Tickets |
| --- | --- |
| Big-bang migration + seed + backend cleanup | WRU.B1 |
| Always-weekly resolution (auto-create, no legacy fallback) | WRU.B2 |
| Settings weekly rules UI + previous-weeks modal | WRU.F1 |
| Remove new-block screen and dead hooks/APIs | WRU.F2 |
| Docs + backlog | WRU.D1 |
| Owner smoke | OWRU.1 |

## Ticket ordering rationale

1. **WRU.B1** wipes legacy data shape, re-seeds rules into one current week, updates seed script.
2. **WRU.B2** makes every read path use that weekly model and auto-create the current week when missing.
3. **WRU.F1** / **WRU.F2** replace Settings UX and delete dead create/focus flows.
4. **WRU.D1** + **OWRU.1** before merge to `main`.

---

## WRU.B1 — Big-bang weekly rules migration + seed

**Type:** backend + migration + seed + tests  
**Depends on:** none (supersedes WTL.B7 lazy cutover and legacy conversion)  
**Blocks:** WRU.B2, WRU.F1  
**Reuse:** `backend/alembic/versions/`, `backend/app/services/training_blocks.py`, `backend/app/services/seed_data.py`, `backend/scripts/seed.py`, `backend/app/tests/test_migrations.py`

### Acceptance criteria

- Alembic data migration on upgrade ( **no** legacy-to-history conversion ):
  1. Read enabled **rules** and **weekly_targets** from the active `legacy` block (if any); if multiple active rows, use one deterministically and log/ignore extras.
  2. **Delete all** `training_blocks` rows (and dependent rules/targets via cascade or explicit cleanup).
  3. Insert **one** `weekly_focus` row for the **current calendar week** (Mon–Sun containing migration run date, or document use of a fixed “as of” in migration — prefer `CURRENT_DATE` semantics in SQL).
  4. Re-insert copied rules/targets against the new block id (new rule/target ids).
- Schema/code cleanup in same or follow-on revision:
  - Retire `period_kind = legacy` (default `weekly_focus`; remove legacy constant and branches).
  - Remove `_try_legacy_cutover`, `allow_legacy_cutover`, legacy fallback in `get_active_training_block`.
- Remove backend create paths for month-style blocks (route removal completed in WRU.F2).
- Remove **`POST /active/setup`**, **`POST /active/reset-focus`**, and **`PATCH focus_title`** endpoints and service functions (`setup_weekly_focus`, `reset_focus_series`, `update_focus_title`) — weekly period is system-managed.
- **`seed_data.py`**: seed **one active weekly_focus** block (current or fixture-fixed Mon–Sun week), not month-range legacy blocks; no “Return to Walking Phase 2” style completed history unless a test explicitly needs a second completed week for rollover/modal tests.
- Generated `name` / internal labels use **calendar week text** (e.g. `Jun 2 – Jun 8, 2026`); UI does not expose separate focus title.

### Edge cases

- No pre-existing blocks: create empty current-week row.
- Active block with no rules: empty weekly row still valid.
- SQLite and Postgres migrations pass.
- Re-running seed after migration produces consistent weekly fixture.

### Test strategy

- Migration test: legacy active block + completed block + rules → after upgrade, **only one** active weekly block, **zero** completed blocks, rules count preserved on new block.
- Seed test or smoke: fresh `alembic upgrade head && seed` → active block is `weekly_focus` with Mon–Sun dates.
- Remove/update lazy-cutover and legacy-conversion tests from WTL.B7 suite.

---

## WRU.B2 — Always resolve active weekly rules

**Type:** backend + tests  
**Depends on:** WRU.B1  
**Blocks:** WRU.F1  
**Reuse:** `dashboard.py`, `load_queries.py`, `mcp_context.py`, `training_blocks.py`, `routers/training_blocks.py`

### Acceptance criteria

- `get_active_training_block(session, as_of=...)` always runs `ensure_active_weekly_focus` and returns the current week row; **never** legacy fallback.
- If no row exists for the current week, **`ensure_active_weekly_focus` creates one** (week 1 in a new series, empty rules unless rollover source exists) — **no 404 waiting for manual setup**.
- Dashboard `block` payload: `period_kind = weekly_focus`, Mon–Sun `start_date`/`end_date`, calendar-appropriate display fields; **no `focus_title` required in API for UI**.
- `GET /api/training-blocks/active` returns current week; Monday rollover copies enabled rules + weekly targets.
- `previous_blocks` lists completed **weekly** periods only (newest first) — empty immediately after WRU.B1 migration until rollovers accumulate.

### Edge cases

- Missed Mondays: catch-up rollover creates intermediate completed weeks (B7 behaviour retained).
- First week after fresh install: auto-created empty weekly row.

### Test strategy

- Dashboard never returns `period_kind legacy`.
- Active block auto-created when database has zero blocks post-migration edge case.

---

## WRU.F1 — Settings weekly rules UI

**Type:** frontend + tests  
**Depends on:** WRU.B2  
**Blocks:** WRU.F2  
**Reuse:** `SettingsScreen.tsx`, `BlockReviewScreen.tsx`, `EditBlockRulesScreen.tsx`, `useMilestoneEngine.ts`

### Acceptance criteria

- Section title: **Weekly rules**.
- Active card primary label: **calendar Mon–Sun range only** (e.g. `Jun 2 – Jun 8`) — no editable focus title, no “Started …” month copy, no Week N unless needed as secondary caption (prefer dates only per D8).
- **Edit rules** and **Review** buttons unchanged in behaviour.
- **No** `+ New Training Block` anywhere.
- **No** Edit focus title, Reset focus, or Set up weekly rules dialogs/buttons.
- **Previous weeks**:
  - At most **one** completed week inline (most recent).
  - Tappable section title **“Previous weeks”** → modal/sheet with full scrollable list.
  - Rows use **calendar week label**; tap → block review.
  - Hidden when no completed weeks exist.
- Remove `usesWeeklyFocusUi`, `BlockSummaryCard`, `WeeklyFocusSummaryCard` focus-title/reset/setup UI, and all legacy Settings branches.

### Edge cases

- Empty previous-week modal: calm empty copy.
- Block review header for historical weeks: calendar label, not old block name.

### Test strategy

- Replace `SettingsScreen.wtlF7.test.tsx` with WRU.F1 tests (calendar label, modal, no legacy buttons, no focus dialogs).
- Modal open/navigate tests.

---

## WRU.F2 — Remove new training block + dead APIs

**Type:** frontend + backend cleanup + tests  
**Depends on:** WRU.F1  
**Blocks:** none  
**Reuse:** `NewTrainingBlockScreen.tsx`, `App.tsx`, `trainingBlocks.ts`, `training_blocks` router, `useMilestoneEngine.ts`

### Acceptance criteria

- Delete `NewTrainingBlockScreen` and `new-training-block` route.
- Remove `onNewBlock`, `createTrainingBlock`, `setupWeeklyFocus`, `resetWeeklyFocus`, `patchFocusTitle` from user-facing engine/API surface.
- Remove routes: **`POST /api/training-blocks`**, **`POST /api/training-blocks/active/setup`**, **`POST /api/training-blocks/active/reset-focus`**, and focus-title patch handling.
- Grep-clean: no “New Training Block”, no block date pickers, no “Training Block” section headers.

### Test strategy

- Delete/update `NewTrainingBlockScreen.test.tsx`, WTL.F7 hook tests for removed mutations.
- API tests assert removed routes return 404/405.

---

## WRU.D1 — Docs and backlog

**Type:** docs  
**Depends on:** WRU.B2, WRU.F1  
**Blocks:** OWRU.1  

### Acceptance criteria

- Docs: **weekly rules** only; document big-bang migration (delete old blocks, copy rules to current week), auto-create behaviour, removed POST/setup/reset routes.
- Supersede WTL.D1/F7 “lazy cutover” and “focus title” UX in `plans/technical-design-weekly-focus-2026-06-07.md` with pointer to this file.
- Backlog: WRU batch tracked; WTL dual-path marked superseded.

---

## OWRU.1 — Owner smoke

**Type:** owner acceptance  
**Depends on:** WRU.D1  
**Blocks:** merge to `main`

### Acceptance criteria

- Settings: **Weekly rules**, calendar label on active card, Edit rules + Review work.
- No New Training Block; no date creation; no focus setup/reset UI.
- Previous weeks: empty or one inline row; modal lists completed weeks after rollovers only.
- Dashboard/suggestions/load risk work against current week.
- `docker compose build backend && alembic upgrade head` on existing dev DB: old “june” / “Phase 2” blocks gone; rules live on current week.

### Manual smoke

1. Migrate existing Docker DB → only current week block; rules preserved; no Previous Blocks history from old data.
2. Edit a rule → persists on current week.
3. Optional: simulate Monday rollover → second week appears in Previous weeks modal after the fact.

---

## Unresolved assumptions

- `week_number` / `focus_series_id` may remain **internal** for rollover logic but are **not shown** in primary UI (calendar label only).
- `focus_title` column may be dropped, ignored, or auto-set from calendar text — implementer chooses minimal diff; UI never edits it.

## Planner status

**SIGNED OFF** — owner confirmed Q1–Q4 and WRU.B1 scope (no legacy history conversion; update seed). Ready for orchestrator on `fix/stage-2-5-lingering-issues` or `feat/weekly-rules-unification`.
