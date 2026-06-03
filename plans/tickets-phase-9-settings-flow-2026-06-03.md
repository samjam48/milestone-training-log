# Phase 9 — Settings Flow + InlineLogSheet Tickets

*Source: `AGENTS.md` §Current Sprint, `agents/planner.md`,
`plans/feature-brief-v02-screen-completion-2026-06-02.md` §Phase 9,
`plans/technical-design-v02-screen-completion-2026-06-02.md` (§2, §4, §5, §6, Phase Allocation),
`export-2/handover.md` §4–§8,
`export-2/src/components/screens/{EditBlockRulesScreen,BlockReviewScreen,NewTrainingBlockScreen,ActivityManagerScreen,InlineLogSheet}.tsx`,
`frontend/src/hooks/useMilestoneEngine.ts`,
`frontend/src/App.tsx`,
`frontend/src/components/screens/{SettingsScreen,GoalsScreen,DashboardScreen}.tsx`,
`frontend/src/components/composites/{CalendarHeatmap,WeeklyLoadGraph,RuleViolationBanner}.tsx`,
`frontend/src/lib/api/{trainingBlocks,activities}.ts`,
`backend/app/{services,routers,schemas}/{dashboard,training_blocks,block_scores,rules}.py`,
`backend/app/services/load_engine.py`,
`docs/api-map.md`, `docs/database-schema.md`, `docs/patterns.md` | Date: 2026-06-03*

---

## IMPORTANT — production has diverged from the prototype AND from the technical design

As in Phase 8, **the technical design and `export-2/handover.md` describe a Tier-4 mock hook
and prototype screens that do not match production.** Phase 7 and Phase 8 already shipped most
of what the design lists as "Phase 9 hook work" and even much of the "Phase 9 Settings screen
work" — production `SettingsScreen` already contains an inline **EditRulesForm** (full rule
CRUD), an inline **NewTrainingBlockSheet**, a **BlockSummaryCard**, an **ActivityManagerRow**,
a **previous-blocks list**, and a dev-reset flow wired to a real `POST /dev/reset` endpoint.

**Do not assume the design or handover describes what exists.** Every ticket below was written
against the *actual* production files read on 2026-06-03. Several "port from prototype" steps are
really "extract existing inline UI into a stack screen" or "wire an already-present button."

### State of the world (verified 2026-06-03)

| Design item (Phase 9) | Prototype (`export-2`) | Production today | Phase 9 action |
| --- | --- | --- | --- |
| Backend dashboard `previous_blocks` | n/a | ❌ **NOT** in `DashboardRead` / `get_dashboard` (dashboard already emits `goals`; api-map documents `previous_blocks` but it is unimplemented) | **Real backend work** — B9.1 |
| Backend `GET /training-blocks/{id}/review` | n/a | ❌ does not exist — **but** `GET /training-blocks/{id}/scores` (B3.0) already returns `{block_id, start_date, end_date, scores}` scoped to block range. Missing: `block`, `load_series`, `flare_up_dates` | **Real backend work** — B9.2 (new endpoint; reuse the block_scores scoping pattern) |
| `POST /training-blocks` rule-copy + archive `end_date` | n/a | ⚠️ **Partial** — `create_training_block` already auto-completes other active blocks (`_complete_other_active_blocks`), but does **NOT** copy rules and does **NOT** set `end_date=today` on the outgoing block | **Real backend work** — B9.3 (add rule copy + end_date) |
| Hook: `rules`, `activities`, `block`, `previousBlocks` reactive | `useState` | ✅ already reactive via React Query (`rules`/`weeklyTargets`/`previousBlocks`/`block`/`activities` all returned from queries) | **No hook change** — already done (Phase 7 F2.0) |
| Hook: `NewActivityDraft`, `NewBlockDraft` interfaces | exported | ✅ `NewActivityDraft` exists; `BlockDraft` exists (production name, richer than prototype's `NewBlockDraft`) | **Reuse existing** — do not add `NewBlockDraft` |
| Hook: `submitNewActivity`, `editActivity`, `deactivateActivity` | mutations | ⚠️ `submitNewActivity` ✅ exists. `editActivity`/`deactivateActivity` ❌ **missing** (but `patchActivity` API + `['activities']` invalidation pattern already exist) | **Small hook work** — H9.0 adds `updateActivity` + `deactivateActivity` |
| Hook: `editRule`, `submitNewBlock` | mutations | ✅ exist as **`updateRule`/`createRule`/`deleteRule`** and **`createTrainingBlock`** (production names) | **Name mismatch only** — new screens call production names |
| Hook: `resetMockData` (dev-only) | in-hook `useState` reset | ✅ Replaced by real `POST /dev/reset`; `SettingsScreen` calls `apiFetch('/dev/reset')` + `invalidateQueries()` directly (no hook mutation) | **Keep as-is** — verify only; do not add `resetMockData` to the hook |
| Navigation push/pop stack | `screenStack` | ✅ scaffolded in Phase 8 (`App.tsx` `screenStack`/`pushScreen`/`popScreen`, `resolveStackScreen`, `stack-screen-overlay`); only `'goal-editor'` registered | **Reuse + extend** — F9.4 registers Settings stack keys |
| `SettingsScreen` new props (`onEditRules`/`onReview`/`onNewBlock`/`onViewBlock`/`onEditActivity`) | present | ❌ none present; `SettingsScreenProps` is `{ engine }` only. Buttons drive **inline sheets**, `onEdit/onDeactivate` are `() => undefined`, "View" has no handler | **Real work** — F9.5 |
| `BlockSummaryCard` forwards `onEditRules`/`onReview` | n/a | ⚠️ Production `BlockSummaryCard` has `onEditRules` (wired to open the inline sheet) but **no `onReview`** prop/button at all | **Real work** — F9.5 adds `onReview` |
| `EditBlockRulesScreen` | exists | ❌ not in production (inline `EditRulesForm` exists instead) | **Real work — port** — F9.6 |
| `BlockReviewScreen` | exists | ❌ not in production (deferred Phase 7.5) | **Real work — port + re-enable** — F9.7 |
| `NewTrainingBlockScreen` | exists | ❌ not in production (inline `NewTrainingBlockSheet` exists instead) | **Real work — port** — F9.8 |
| `ActivityManagerScreen` | exists | ❌ not in production | **Real work — port** — F9.9 |
| `InlineLogSheet` | exists (HTML bottom sheet) | ❌ not in production; Dashboard suggestions currently open the full `LogActivityScreen` overlay via `onOpenLogActivity(s.id)` | **Real work — port as modal** — F9.10 |

### Decisions locked for this ticket set

- **Mutation names:** new screens call the **existing production hook names** — `updateRule`
  (not `editRule`), `createTrainingBlock` (not `submitNewBlock`), `createGoal`/`updateGoal`,
  `submitNewActivity`. The only *new* mutations are `updateActivity` and `deactivateActivity`
  (H9.0), named to match the existing `updateGoal`/`updateRule` convention (production uses
  `update*` for PATCH, not the design's `edit*`). (Flagged: Open Question Q1.)
- **`resetMockData` is NOT added to the hook.** Production already does dev reset via
  `POST /dev/reset` + `invalidateQueries()` directly in `SettingsScreen`. Phase 9 verifies it,
  it does not reimplement it. (Flagged: Open Question Q2 — default: leave as-is.)
- **`BlockDraft` is the production block-create type** (has `name`, `startDate`, `endDate?`,
  `relatedGoalId?`, `notes?`). Do NOT add the prototype's looser `NewBlockDraft`.
  `NewTrainingBlockScreen` builds a `BlockDraft`.
- **`VolumeUnit` reconciliation:** the canonical union is in `frontend/src/types.ts`:
  `'km' | 'mi' | 'm' | 'kg' | 'reps' | 'sets' | 'sessions' | 'minutes'`. The prototype's
  `UNIT_OPTS` omits `m` and `kg` and is otherwise a subset. `ActivityManagerScreen` must emit a
  valid `VolumeUnit`; reuse the unit list already used by the production `NewActivitySheet`
  rather than widening the type. (Flagged: Open Question Q3 — default: match `NewActivitySheet`.)
- **Review endpoint reuses the active dashboard for the active block where simplest.** The new
  `GET /training-blocks/{id}/review` (B9.2) serves both active and historical blocks correctly
  by scoping to the block date range, so `BlockReviewScreen` can call it uniformly. But because
  the production hook already exposes `dailyScores`/`loadSeries`/`flareUpDates` for the **active**
  block from the dashboard, F9.7 may render the active block from the dashboard payload and only
  fetch the review endpoint for **previous** blocks — whichever keeps the hook shape simplest.
  (Flagged: Open Question Q4 — default: fetch the review endpoint for previous blocks only; use
  the dashboard payload for the active block, matching the existing prototype `BlockReviewScreen`
  which already branches on `isActive`.)
- **InlineLogSheet is a modal overlay, NOT a stack push.** It renders above the current screen
  (own state in `App`, like the existing `overlay` enum), is triggered from Dashboard suggestion
  cards, and is dismissed without a history entry. It does NOT go on `screenStack`. (Flagged:
  Open Question Q5 — default: add InlineLogSheet alongside the existing `overlay` mechanism and
  route Dashboard suggestion "Log" to it instead of the full `LogActivityScreen` overlay.)
- **Mobile-first AppShell display:** all four Settings stack screens render inside the Phase 8
  `stack-screen-overlay` container (`absolute inset-0 ... bg-bg`) which is itself inside
  `AppShell`. New screens must NOT set `100vh`/full-browser-width or their own fixed positioning
  — the prototype's `style={{ minHeight: '100vh' }}` must be dropped/replaced with
  `min-h-full`/`flex-1` to stay within the AppShell column. (Hard constraint, AGENTS.md.)
- **No schema changes** — Phase 9 touches no models and needs no Alembic migration.

### Hard constraints (from `AGENTS.md`)

- Tests before code — failing tests exist before production code, per ticket.
- No business logic in routers — review assembly and rule-copy live in `services/`.
- No `any` in TS; `tsc --noEmit` + `eslint` clean. `mypy backend/app --strict` + `ruff` clean.
- One logical change per ticket; all work on branch `feat/phase-9-settings-flow`.
- Do not push or merge — prepare and report.

---

## Ticket ordering rationale

1. **B9.1** (dashboard `previous_blocks`) — independent backend; closes the api-map ↔
   implementation gap. The hook already derives `previousBlocks` from a separate
   `['training-blocks']` query, so this is additive and low-risk.
2. **B9.2** (`GET /training-blocks/{id}/review`) — independent backend; the data source
   `BlockReviewScreen` (F9.7) needs for previous blocks. Built on the existing `block_scores`
   scoping pattern + `compute_load_series`.
3. **B9.3** (`POST /training-blocks` rule copy + archive `end_date`) — independent backend;
   completes the block-create service contract that `NewTrainingBlockScreen` (F9.8) relies on.
4. **H9.0** (hook: `updateActivity` + `deactivateActivity`) — tiny hook addition the
   `ActivityManagerScreen` (F9.9) needs; everything else the screens call already exists.
5. **F9.4** (navigation: register Settings stack keys) — extends the Phase 8 scaffold; F9.5–F9.9
   push onto it.
6. **F9.5** (`SettingsScreen` props + `BlockSummaryCard.onReview`) — adds the 5 props and routes
   the existing/added buttons to `pushScreen`; depends on F9.4.
7. **F9.6–F9.9** (the four Settings stack screens) — depend on F9.4 (stack), F9.5 (entry points),
   and their backend tickets (F9.7→B9.2; F9.8→B9.3; F9.9→H9.0).
8. **F9.10** (`InlineLogSheet`) — independent modal; depends only on existing
   `submitLog`/`checkViolations` and the Dashboard trigger rewire.
9. **Q9.11** (quality gates + verification) — last; runs gates + the manual Settings-flow matrix.

---

## B9.1 — Backend: add `previous_blocks` to the dashboard payload

**Type:** backend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** Phase 8 on `main`

### Goal

Extend `GET /api/dashboard` to return `previous_blocks` (summary-only, completed/archived blocks)
so the payload matches the contract in `docs/api-map.md`.

### Acceptance criteria

1. Tests in `backend/app/tests/test_dashboard_service.py` and
   `backend/app/tests/test_dashboard_api.py` are extended **first** and fail before the code.
2. `DashboardRead` (`backend/app/schemas/dashboard.py`) gains
   `previous_blocks: list[TrainingBlockRead]`. Reuse the existing `TrainingBlockRead` schema — do
   not define a new block summary shape (it already carries id, name, start_date, end_date,
   status, is_review_milestone_hit, etc.).
3. `get_dashboard` (`backend/app/services/dashboard.py`) populates `previous_blocks` from
   `list_training_blocks(session)` filtered to blocks whose `status != "active"` (i.e.
   `completed`/`archived`), serialised via `TrainingBlockRead.model_validate(...)`. No querying
   logic is added to the router (`routers/dashboard.py` returns `get_dashboard(...)` verbatim).
4. Ordering: by `end_date` descending (most recently ended first), with `start_date` desc / `id`
   as a stable tiebreak. (`list_training_blocks` currently orders by `start_date desc, id`;
   re-sort the filtered list by `end_date desc` in the service, treating a null `end_date` as
   "ongoing"/last.)
5. `previous_blocks` excludes the current active block. If there is no active block, all
   non-active blocks still appear. JSON key is snake_case `previous_blocks`.
6. All existing dashboard fields (including `goals`, already present) are unchanged.
7. `mypy backend/app --strict` and `ruff check backend` pass clean.

### Implementation notes

- Import `from app.services.training_blocks import list_training_blocks` (already imported:
  `get_active_training_block`). Filter + sort in the service, near where `active_goals` is built.
- The hook already maintains a separate `['training-blocks']` query and derives `previousBlocks`
  client-side; B9.1 makes the dashboard self-consistent with the documented contract. (See Open
  Question Q6 — default: do NOT switch the hook to read dashboard `previous_blocks`; keep the
  separate query, no hook change.)

### Test strategy

- **Service:** seed an active block + two completed blocks with distinct `end_date`s, call
  `get_dashboard`, assert `len(previous_blocks) == 2`, the active block is absent, and ordering is
  `end_date` desc. Add a case with a null-`end_date` non-active block and assert it sorts last.
- **API:** `GET /api/dashboard` returns 200 with a top-level `previous_blocks` array; assert one
  entry has snake_case `is_review_milestone_hit` and `end_date`. Add a no-previous-blocks case →
  `previous_blocks == []`.
- Confirm the no-active-block path still returns `previous_blocks` for the non-active rows.

### Dependencies

None (independent backend ticket).

---

## B9.2 — Backend: `GET /api/training-blocks/{block_id}/review` endpoint

**Type:** backend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** none (independent backend ticket)
**Spec:** `docs/api-map.md` §Training Blocks, technical-design §2b

### Goal

Add a per-block review endpoint returning `block`, `daily_scores`, `load_series`, and
`flare_up_dates` scoped to the block's date range, for `BlockReviewScreen` (both active and
historical blocks).

### Acceptance criteria

1. New tests in `backend/app/tests/test_training_blocks_api.py` (or a dedicated
   `test_block_review_api.py` + service test) are written **first** and fail before the code.
2. New response schema (e.g. `backend/app/schemas/block_review.py`) `BlockReviewRead` with:
   - `block: TrainingBlockRead`
   - `daily_scores: list[DailySafetyScoreRead]` (reuse the existing schema from
     `schemas/dashboard.py`)
   - `load_series: list[LoadPointRead]` (reuse the existing `LoadPointRead`)
   - `flare_up_dates: list[str]`
   - `total_sessions: int` — count of `activity_logs` rows within the block date range
   - `clean_days: int` — count of days with no flare-up incident within the block date range
   Reuse existing schemas; do not redefine score/point shapes.
3. New service (e.g. `backend/app/services/block_review.py`) `get_block_review(session, block_id)`:
   - 404 (`TrainingBlockNotFoundError`) when the block does not exist for the local user.
   - Scope to `block.start_date` … (`block.end_date` or `date.today()` if active/open) — mirror
     `services/block_scores.get_block_scores` exactly for the date range + log/check-in/incident
     querying.
   - `daily_scores`: from `compute_daily_safety_scores(...)`, filtering out `neutral` days (match
     `block_scores` behaviour — `[s for s in raw if s["state"] != "neutral"]`).
   - `load_series`: from `compute_load_series(class_id, activity_dicts, log_dicts,
     block_start_str, block_end_str)`. Resolve `class_id` with the **same** `_resolve_graph_class_id`
     logic the dashboard uses (enabled `weekly_load_cap` rule's class, else first performance
     class). The block's rules come from `list_rules(session, block_id)`. If no class resolves,
     `load_series == []`.
   - `flare_up_dates`: sorted unique ISO dates of flare-up incidents within the block range
     (mirror the dashboard's `flare_up_dates` construction).
4. New router route `@router.get("/{block_id}/review", response_model=BlockReviewRead)` in
   `routers/training_blocks.py`, translating `TrainingBlockNotFoundError` → 404. **No business
   logic in the router.**
5. Route ordering does not shadow existing `/{block_id}/scores` or `/active` routes.
6. `mypy backend/app --strict` and `ruff check backend` pass clean.

### Implementation notes

- `_resolve_graph_class_id` and `_week_load_threshold` currently live as module-private helpers
  in `services/dashboard.py`. Either import-and-reuse (preferred — promote to a shared
  helper if needed) or replicate minimally; do not fork divergent copies. Flag if promotion
  changes the dashboard's behaviour (it should not).
- `compute_load_series` signature (confirmed): `(class_id, activities, logs, start_date,
  end_date, window_days=7)` returning `list[LoadPoint]` of `{date, load, daily_load}`.
- Frontend api client (`frontend/src/lib/api/trainingBlocks.ts`) currently has
  `getTrainingBlockScores`. F9.7 will add a `getTrainingBlockReview(blockId)` companion — but the
  api-lib function itself can be added in F9.7 (frontend ticket), not here.

### Test strategy

- **Service:** seed a completed block with start/end dates, logs + a flare-up incident inside the
  range and one outside. Assert `block.id` matches, `daily_scores` excludes neutral days and
  excludes out-of-range data, `load_series` length == number of days in range, and
  `flare_up_dates` contains only the in-range incident date.
- **Active block:** call with the active block's id, no `end_date` → range ends at `today`;
  assert it returns a non-empty `load_series` and `daily_scores`.
- **404:** unknown `block_id` → 404.
- **No rules / no performance class:** assert `load_series == []` without error.

### Dependencies

None.

---

## B9.3 — Backend: `POST /api/training-blocks` copies rules + sets archive `end_date`

**Type:** backend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** none (independent backend ticket)
**Spec:** technical-design §1 + §2c, `docs/database-schema.md` §Service Behaviour Notes

### Goal

Extend the block-creation service so that creating a new **active** block copies the previous
active block's rules into the new block and sets `end_date = today` on the outgoing block before
marking it completed. No request/response shape change.

### Acceptance criteria

1. Tests in `backend/app/tests/test_training_blocks_api.py` (+ a service-level test) are extended
   **first** and fail before the code.
2. `create_training_block` (`backend/app/services/training_blocks.py`): when the new block is
   created with `status == "active"` and a previous active block exists:
   - All `rules` rows of the previous active block are **copied** into the new block (new rule
     ids via `uuid`), preserving `activity_class_id`, `rule_type`, `threshold_value`,
     `window_days`, `enabled`. Timestamps set to now.
   - The outgoing block gets `end_date = today` **only if it is currently null**, then
     `status = "completed"` (extend the existing `_complete_other_active_blocks`, which already
     sets `status` + `updated_at`).
3. If there is **no** previous active block, the new block is created with **no** rules (empty
   ruleset) and no error.
4. If the new block is created with a non-active `status`, no rule copy and no archive occurs
   (existing behaviour preserved).
5. Rule copy is a **service** operation — no router change, no schema/model change, no Alembic.
6. Idempotency / FK integrity: copied rules reference the **new** block id; original rules remain
   attached to the outgoing block (they are not moved). The outgoing block keeps its own rules.
7. `mypy backend/app --strict` and `ruff check backend` pass clean.

### Implementation notes

- The current `_complete_other_active_blocks(session, *, exclude_block_id)` iterates other active
  blocks and sets `status="completed"` + `updated_at`. Add the `end_date = today if None` there,
  and have `create_training_block` capture the outgoing block(s) so their rules can be copied
  **before** they are completed. Copy rules from the single previous active block (Phase 1 is
  single-user / single active block; if multiple somehow exist, copy from the one being completed
  — flag if ambiguous, default: the first/only active block).
- Reuse `list_rules(session, old_block_id)` to read source rules; insert copies with
  `app.models.block.Rule` directly (or via a small helper). Use `datetime.now(UTC)` for
  timestamps consistent with the rest of the service.
- "today" = server-local today consistent with how `block_scores`/`dashboard` resolve dates
  (`date.today()`); confirm against `resolve_as_of` usage — default `date.today()`.

### Test strategy

- **Copy:** seed an active block with 3 rules (mix of class-scoped and null-class, mix of
  enabled/disabled). `POST` a new active block. Assert: new block has 3 rules with new ids and
  identical field values; outgoing block now `status=completed` with `end_date == today`; outgoing
  block's original rules still exist.
- **Pre-set end_date preserved:** outgoing block already has an `end_date` → it is NOT overwritten.
- **No previous active block:** `POST` first-ever block → succeeds, new block has 0 rules.
- **Non-active create:** `POST` with `status="completed"` → no copy, no archive side effects.
- Existing `test_training_blocks_api` cases (409 on duplicate id, 404 on bad goal) still pass.

### Dependencies

None.

---

## H9.0 — Hook: add `updateActivity` + `deactivateActivity` mutations

**Type:** frontend (small)
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** none

### Goal

Add the two missing activity mutations the `ActivityManagerScreen` (F9.9) needs, following the
existing production mutation conventions. Everything else the Settings screens call
(`createRule`/`updateRule`/`deleteRule`, `createTrainingBlock`, `submitNewActivity`,
`createGoal`/`updateGoal`) already exists.

### Acceptance criteria

1. Tests in `frontend/src/hooks/useMilestoneEngine.test.tsx` are extended **first** and fail
   before the change.
2. `MilestoneEngineResult` (`frontend/src/hooks/useMilestoneEngine.ts`) gains:
   ```ts
   updateActivity: (activityId: ID, patch: Partial<NewActivityDraft>) => void;
   deactivateActivity: (activityId: ID) => void;
   ```
   Names follow the existing `update*` convention (not the design's `editActivity`). `Partial<NewActivityDraft>`
   covers `name`/`activityClassId`/`type`/`defaultVolumeUnit`. (Confirm `NewActivityDraft` is the
   right patch surface; if the screen also needs to toggle other fields, widen explicitly — no `any`.)
3. Both mutations call the existing `patchActivity(activityId, body)` from
   `frontend/src/lib/api/activities.ts` (already present). `deactivateActivity` sends
   `{ isActive: false }`.
4. `onSuccess` invalidates `['dashboard']` and `['activities']` — matching the existing
   `submitNewActivityMutation` invalidation set.
5. Both are exposed as `React.useCallback`-wrapped functions in the returned object, consistent
   with the other mutations.
6. No reactive-state or `resetMockData` changes (production uses React Query + `/dev/reset`).
7. `tsc --noEmit` and `eslint` clean; existing screens and tests unchanged.

### Implementation notes

- Mirror `submitNewActivityMutation` / `createGoalMutation` exactly for the `useMutation` +
  `useCallback` shape. `patchActivity` already maps the camelCase body via `mapActivityPatchBody`.
- Do **not** import `export-2/...`. The design's `editActivity(id, Partial<Activity>)` signature
  is the prototype's; production uses draft-typed patches — keep `Partial<NewActivityDraft>`.

### Test strategy

- Extend `useMilestoneEngine.test.tsx`: mock `frontend/src/lib/api`, assert `updateActivity`
  calls `patchActivity` with the id + patch and invalidates `['dashboard']` + `['activities']`;
  assert `deactivateActivity` calls `patchActivity(id, { isActive: false })`.

### Dependencies

None. Blocks F9.9.

---

## F9.4 — Navigation: register the Settings stack screen keys

**Type:** frontend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** none (extends Phase 8 scaffold)
**Spec:** `frontend/src/App.tsx` (existing `screenStack`/`resolveStackScreen`), technical-design §4

### Goal

Extend the existing Phase 8 push/pop stack in `App.tsx` to resolve the four new Settings stack
keys to their screens, keeping the Goals stack and existing overlays unchanged.

### Acceptance criteria

1. Tests in `frontend/src/App.test.tsx` are extended **first** and fail before the change.
2. `resolveStackScreen` in `App.tsx` gains four new keys, each rendering the corresponding screen
   with `engine`, `onBack={popScreen}`, and (where applicable) `onComplete={popScreen}`:
   - `'edit-block-rules'` → `<EditBlockRulesScreen engine onBack />`
   - `'block-review'` → `<BlockReviewScreen engine blockId={params.blockId as string | undefined} onBack />`
   - `'new-training-block'` → `<NewTrainingBlockScreen engine onBack onComplete />`
   - `'activity-manager'` → `<ActivityManagerScreen activity={params.activity as Activity} engine onBack onComplete />`
   Until F9.6–F9.9 land, a typed placeholder is acceptable per key; those tickets replace it.
3. Params are read type-safely (e.g. `params.blockId as string | undefined`,
   `params.activity as Activity`) — no `any`. Unknown keys continue to render the existing typed
   fallback (`<></>`), never crash (existing `test-push-unknown-screen` affordance still passes).
4. `showTabBar` logic is unchanged (`overlay === null && screenStack.length === 0`): the tab bar
   stays hidden while any Settings stack screen is open.
5. The Settings stack screens render **inside** the existing `stack-screen-overlay` container
   (`absolute inset-0 ... bg-bg` inside `AppShell`) — no new full-viewport/`100vh` wrapper is
   introduced in `App.tsx`.
6. The Goals stack (`'goal-editor'`), the three existing overlays, and all five tab screens behave
   exactly as before (regression-guarded by `App.test.tsx`).
7. `tsc --noEmit` and `eslint` clean.

### Implementation notes

- Add the new screen imports to the `./components/screens` import block in `App.tsx` and export
  them from `frontend/src/components/screens/index.ts` (F9.6–F9.9 create the files).
- Keep `resolveStackScreen` a single switch/if-chain as it is today; do not refactor the stack
  mechanism. The `Activity` type import already needs adding alongside the existing `Goal` import.
- F9.5 supplies the `pushScreen('...', params)` call-sites from `SettingsScreen`; this ticket only
  resolves the keys to screens. The two can land together but F9.4 is the stack-side half.

### Test strategy

- For each new key, push it (via a temporary test affordance or once F9.5 wires the buttons) and
  assert the placeholder/screen overlay renders and the tab bar hides; `popScreen` restores it.
- Regression: unknown key still renders nothing; Goals + overlays + tabs unchanged.

### Dependencies

None hard. Pairs with F9.5; blocks the four Settings screen tickets' `App` wiring.

---

## F9.5 — `SettingsScreen`: add navigation props + `BlockSummaryCard.onReview`

**Type:** frontend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** F9.4
**Spec:** `frontend/src/components/screens/SettingsScreen.tsx`, technical-design §5, handover §7–§8

### Goal

Add the five navigation props to `SettingsScreen`, route the relevant buttons to the stack, add a
"Review" affordance to `BlockSummaryCard`, and wire the activity Edit / previous-block View
buttons that currently no-op.

### Acceptance criteria

1. Tests in `frontend/src/components/screens/SettingsScreen.test.tsx` are extended **first** and
   fail before the change.
2. `SettingsScreenProps` gains five optional props (types match production conventions):
   ```ts
   onEditRules?: () => void;
   onReview?: () => void;
   onNewBlock?: () => void;
   onViewBlock?: (blockId: ID) => void;
   onEditActivity?: (activity: Activity) => void;
   ```
   (`Activity` is the production type from `../../types`; `ID` likewise.)
3. **Edit rules:** `BlockSummaryCard` gains an `onReview?: () => void` prop and renders a
   **Review** button alongside the existing **Edit rules** button. When `onEditRules`/`onReview`
   are provided to `SettingsScreen`, the card's CTAs call them (pushing the stack screens) instead
   of opening the inline `EditRulesForm`. When the props are **absent**, the existing inline
   `EditRulesForm` path remains (backward-compatible standalone use). (Default per Q7 — route to
   stack when prop provided; keep inline sheet as fallback.)
4. **+ New Training Block:** when `onNewBlock` is provided, the button calls `onNewBlock()`
   (push) instead of opening the inline `NewTrainingBlockSheet`; absent → inline sheet remains.
5. **Previous block "View":** the currently-handler-less `View` button calls
   `onViewBlock?.(pb.id)`.
6. **Activity Edit:** `ActivityManagerRow`'s `onEdit` (currently `() => undefined`) calls
   `onEditActivity?.(act)`. **Activity Deactivate** continues to call
   `engine.deactivateActivity(act.id)` **directly** (now available from H9.0; currently
   `() => undefined`) — confirm direct-call wiring per handover §7.
7. `App.tsx` passes the five props to `<SettingsScreen>`:
   `onEditRules={() => pushScreen('edit-block-rules')}`,
   `onReview={() => pushScreen('block-review')}` (active block, no `blockId`),
   `onNewBlock={() => pushScreen('new-training-block')}`,
   `onViewBlock={(blockId) => pushScreen('block-review', { blockId })}`,
   `onEditActivity={(activity) => pushScreen('activity-manager', { activity })}`.
8. The Preferences toggles, dev `Reset mock data` flow (`POST /dev/reset`), About section, and
   the empty/no-block states are unchanged.
9. `tsc --noEmit` and `eslint` clean; no change to other screens.

### Implementation notes

- Production `BlockSummaryCard` has `showEditRules`/`onEditRules` and the CTA row. Add a parallel
  `onReview` and render two buttons in the existing flex CTA row. Do not remove the inline
  `EditRulesForm`/`NewTrainingBlockSheet` — gate them behind "prop not provided" so the screen
  stays usable in isolation and existing tests pass.
- `engine.deactivateActivity` is added by H9.0; this ticket depends on H9.0 for the deactivate
  wiring (or wire it in the same change if H9.0 lands first). The Edit/View wiring does not need H9.0.
- Keep the two-step dev reset confirm exactly as-is.

### Test strategy

- Render `SettingsScreen` with all five prop spies; assert: Edit rules → `onEditRules` (and inline
  form does NOT open), Review → `onReview`, + New Training Block → `onNewBlock` (inline sheet does
  NOT open), a previous block's View → `onViewBlock(pb.id)`, an activity's Edit →
  `onEditActivity(activity)`.
- Render **without** the props → assert inline `EditRulesForm` and `NewTrainingBlockSheet` still
  open (backward-compat).
- Assert activity Deactivate calls `engine.deactivateActivity(id)`; assert dev-reset flow
  unchanged.

### Dependencies

F9.4 (needs the stack keys). Soft dep on H9.0 for the deactivate wiring.

---

## F9.6 — `EditBlockRulesScreen`: port the live rule editor

**Type:** frontend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** F9.4, F9.5
**Spec:** `export-2/src/components/screens/EditBlockRulesScreen.tsx`

### Goal

Port `EditBlockRulesScreen` into production strict TS as a Settings stack screen that edits the
active block's rules live (threshold steppers + enable/disable toggle), calling the existing
`engine.updateRule`.

### Acceptance criteria

1. Tests in `frontend/src/components/screens/EditBlockRulesScreen.test.tsx` are written **first**
   and fail before the component.
2. New file `frontend/src/components/screens/EditBlockRulesScreen.tsx`, exported from
   `screens/index.ts`. Strict TS, no `any`.
3. Props:
   ```ts
   interface EditBlockRulesScreenProps {
     engine: MilestoneEngineResult;
     onBack: () => void;
   }
   ```
4. Reads `engine.rules`, `engine.activityClasses`, `engine.block`. Renders rules grouped by class
   (and an "All Classes" group for null-`activityClassId` rules), with the empty state when
   `rules.length === 0`. Matches the prototype layout/labels.
5. **Mutation name on port:** each row's threshold stepper/input and the enable toggle call
   `engine.updateRule(rule.id, { thresholdValue })` / `engine.updateRule(rule.id, { enabled })`
   — **not** the prototype's `editRule`. (`updateRule` takes a `RulePatch` =
   `Partial<Pick<RuleDraft,'thresholdValue'|'windowDays'|'enabled'>>` — confirmed present.)
6. **No save button** — changes are live (matches prototype + handover §6). The header is a Back
   button + title + block name.
7. **AppShell display:** the root wrapper must NOT use `style={{ minHeight: '100vh' }}` (the
   prototype does). Use `min-h-full`/`flex flex-col` so it fills the `stack-screen-overlay`
   column within `AppShell` — no full-browser width, no own fixed positioning.
8. `App.tsx` resolves `'edit-block-rules'` to this screen (replacing any F9.4 placeholder).
9. `tsc --noEmit` and `eslint` clean.

### Implementation notes

- **Do not import** `export-2/...`. Re-author against production `Card` (`../ui/Card`) and `cn`
  (`../../lib/cn`). The prototype's `RULE_DEF` (min/max/unit per rule_type) can be reused as a
  local const; verify the `rule_type` values match production (`rest_between_class`,
  `frequency_limit`, `weekly_load_cap`, `consecutive_day_limit`, `weekly_activity_count` — they
  do, per `SettingsScreen` `RULE_LABEL`).
- Production `Rule.activityClassId` is `string | null`; the prototype filters on it — keep null
  handling for the "All Classes" group.
- This screen overlaps the existing inline `EditRulesForm` (which also supports add/delete). The
  stack screen ports the prototype's *threshold + toggle* live editor only; add/delete is out of
  scope here (the inline form retains it as a fallback). Flag if the owner wants the stack screen
  to also support add/delete (Q8 — default: no, threshold + toggle only, matching the prototype).

### Test strategy

- Render with seeded `engine.rules` (mock engine), assert grouping by class + "All Classes" group.
- Click a stepper "+" / "−" and the toggle → assert `engine.updateRule(id, { thresholdValue })`
  and `engine.updateRule(id, { enabled })` are called with correct payloads.
- Empty rules → empty-state message renders.
- Back button → `onBack` fired.

### Dependencies

F9.4 (stack key), F9.5 (Edit rules entry point).

---

## F9.7 — `BlockReviewScreen`: port + re-enable block review

**Type:** frontend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** F9.4, F9.5, B9.2
**Spec:** `export-2/src/components/screens/BlockReviewScreen.tsx`,
`frontend/src/components/composites/{CalendarHeatmap,WeeklyLoadGraph}.tsx`

### Goal

Port `BlockReviewScreen` into production strict TS as a Settings stack screen showing a block's
review (summary stats + charts), reusing the existing `CalendarHeatmap` and `WeeklyLoadGraph`
composites. Formally re-enables the screen deferred in Phase 7.5.

### Acceptance criteria

1. Tests in `frontend/src/components/screens/BlockReviewScreen.test.tsx` are written **first** and
   fail before the component.
2. New file `frontend/src/components/screens/BlockReviewScreen.tsx`, exported from
   `screens/index.ts`. Strict TS, no `any`.
3. Props:
   ```ts
   interface BlockReviewScreenProps {
     engine: MilestoneEngineResult;
     onBack: () => void;
     blockId?: string;
   }
   ```
4. **Active block (no `blockId`):** render from the dashboard-backed engine fields
   (`engine.block`, `engine.dailyScores`, `engine.loadSeries`, `engine.flareUpDates`,
   `engine.weekLoadThreshold`, `engine.todayDate`) — matching the prototype's `isActive` branch.
   Renders summary stats + `CalendarHeatmap` + `WeeklyLoadGraph`.
5. **Previous block (`blockId` set and found in `engine.previousBlocks`):** fetch
   `GET /api/training-blocks/{blockId}/review` (B9.2) and render the **same** stats + charts from
   the fetched `daily_scores`/`load_series`/`flare_up_dates` scoped to that block. (Default per
   Q4 — the previous block now HAS charts via the review endpoint; this is an intentional
   improvement over the prototype's "charts active-only" limitation. If the owner prefers
   stats-only for past blocks, drop the fetch and keep the prototype's inset message — flag Q4.)
6. Add `getTrainingBlockReview(blockId)` to `frontend/src/lib/api/trainingBlocks.ts` returning a
   typed `{ block, dailyScores, loadSeries, flareUpDates }` (reuse existing mappers
   `mapTrainingBlockFromApi`, `mapDailySafetyScoreFromApi`, and the load-point mapper used by the
   dashboard). Fetch via a `useQuery(['block-review', blockId])` inside the screen, enabled only
   when `blockId` is set. No `any`.
7. Composite props (confirmed): `CalendarHeatmap` takes
   `{ startDate, endDate, scores, title }`; `WeeklyLoadGraph` takes
   `{ startDate, endDate, series, threshold, flareUpDates, title, subtitle }`. Pass
   `scores={dailyScores.filter(d => d.state !== 'neutral')}` to the heatmap as the prototype does.
8. Summary stat boxes (Sessions / Clean / Safe days / Flares) computed as in the prototype, from
   the relevant block-scoped logs + daily scores. For previous blocks, derive sessions/clean from
   logs filtered to the block range (or extend B9.2 to return session counts — default: filter
   `engine.logs` to the block range client-side, matching the prototype). Flag if `engine.logs`
   (30-day dashboard window) is insufficient for old blocks → then read from the review endpoint
   (Q9 — default: client-side filter; if logs are windowed too tightly for old blocks, B9.2 should
   also return the session/clean counts. Recommend B9.2 returns counts to be safe — see Open Q9).
9. **AppShell display:** drop the prototype's `style={{ minHeight: '100vh' }}`; fill the
   `stack-screen-overlay` column (`min-h-full`/`flex-1`). Back button in the header.
10. Loading/error states for the previous-block fetch are handled gracefully (skeleton or simple
    "Loading…" / "Couldn't load review"), no crash, no `any`.
11. `App.tsx` resolves `'block-review'` to this screen with `blockId={params.blockId}`.
12. `tsc --noEmit` and `eslint` clean.

### Implementation notes

- **Do not import** `export-2/...`. Re-author against the production composites (paths confirmed:
  `../composites/CalendarHeatmap`, `../composites/WeeklyLoadGraph`) and `../ui/Card`.
- The dashboard load-point mapper: check `frontend/src/lib/api/mappers.ts` /
  `dashboard.ts` for the existing load-series mapping and reuse it; do not hand-roll a divergent
  shape. `LoadPoint`/`LoadSeriesPoint` types live in `frontend/src/lib/load.ts` (engine LoadPoint).
- `engine.weekLoadThreshold` is the active block's threshold; for a previous block, derive the
  threshold from the review endpoint if needed, or pass the active value (the prototype uses the
  active `weekLoadThreshold` for both — acceptable since past charts are illustrative). Flag if the
  per-block threshold matters (default: include it in B9.2 only if trivial; otherwise reuse active).

### Test strategy

- **Active:** render with no `blockId` and a mock engine → assert stat boxes + `CalendarHeatmap` +
  `WeeklyLoadGraph` render with the engine's active-block fields; Back → `onBack`.
- **Previous:** render with a `blockId` present in `engine.previousBlocks`, mock the
  `getTrainingBlockReview` api → assert the fetched scores/series feed the charts; assert loading
  and error branches render without crashing.
- **Unknown blockId:** not in `previousBlocks` and not active → graceful fallback (default to
  active or show "not found"), no crash.

### Dependencies

F9.4 (stack key), F9.5 (Review / View entry points), B9.2 (review endpoint).

---

## F9.8 — `NewTrainingBlockScreen`: port the block-create screen

**Type:** frontend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** F9.4, F9.5, B9.3
**Spec:** `export-2/src/components/screens/NewTrainingBlockScreen.tsx`

### Goal

Port `NewTrainingBlockScreen` into production strict TS as a Settings stack screen for creating a
new block (name / start date / optional end date) that archives the current block, calling the
existing `engine.createTrainingBlock`.

### Acceptance criteria

1. Tests in `frontend/src/components/screens/NewTrainingBlockScreen.test.tsx` are written **first**
   and fail before the component.
2. New file `frontend/src/components/screens/NewTrainingBlockScreen.tsx`, exported from
   `screens/index.ts`. Strict TS, no `any`.
3. Props:
   ```ts
   interface NewTrainingBlockScreenProps {
     engine: MilestoneEngineResult;
     onBack: () => void;
     onComplete: () => void;
   }
   ```
4. Form fields (port from prototype): **name** (required, autofocus), **start date** (defaults to
   `engine.todayDate`), **end date** (optional). Create disabled until `name.trim()` and
   `startDate` are set.
5. **Mutation name + draft on port:** Create builds a production **`BlockDraft`**
   (`{ name, startDate, endDate? }`; `relatedGoalId`/`notes` optional, omitted) and calls
   `engine.createTrainingBlock(draft)` (**not** the prototype's `submitNewBlock`/`NewBlockDraft`),
   then `onComplete()`. The hook injects `id` via `crypto.randomUUID()` — the screen passes no
   `id`. `endDate: ''` must be sent as omitted/undefined, not empty string.
6. The "creating this archives <current block>" info card renders when `engine.block.id !== ''`,
   using `engine.block.name`. (Archiving + rule-copy is handled server-side by B9.3.)
7. **AppShell display:** drop `style={{ minHeight: '100vh' }}`; fill the stack overlay column.
   Back button + header.
8. `App.tsx` resolves `'new-training-block'` to this screen.
9. `tsc --noEmit` and `eslint` clean.

### Implementation notes

- **Do not import** `export-2/...`. Re-author against `../ui/Card` + `cn`. The production
  `BlockDraft` type is in `useMilestoneEngine.ts`; `startDate`/`endDate` are `ISODate`.
- This overlaps the existing inline `NewTrainingBlockSheet` in `SettingsScreen` (which also calls
  `createTrainingBlock`). The stack screen is the new primary surface; the inline sheet remains the
  no-prop fallback (gated in F9.5). Keep both calling `createTrainingBlock` — do not introduce a
  second create path.
- After create, `createTrainingBlock`'s `onSuccess` already invalidates `['training-blocks']` +
  `['dashboard']`, so the new block + archived previous block refresh automatically.

### Test strategy

- Render, fill name + start date (+ optional end date), click Create → assert
  `engine.createTrainingBlock` called once with `{ name, startDate, endDate? }` (no `id`, no empty
  string `endDate`), then `onComplete`.
- Validation: empty name → Create disabled, no mutation.
- Archive notice renders when `engine.block.id` is non-empty; hidden when block empty.
- Back → `onBack`, no mutation.

### Dependencies

F9.4 (stack key), F9.5 (+ New Training Block entry point), B9.3 (rule-copy/archive service).

---

## F9.9 — `ActivityManagerScreen`: port the activity editor

**Type:** frontend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** F9.4, F9.5, H9.0
**Spec:** `export-2/src/components/screens/ActivityManagerScreen.tsx`

### Goal

Port `ActivityManagerScreen` into production strict TS as a Settings stack screen for editing an
activity's name/class/type/unit or deactivating it, calling the new `engine.updateActivity` /
`engine.deactivateActivity` (H9.0).

### Acceptance criteria

1. Tests in `frontend/src/components/screens/ActivityManagerScreen.test.tsx` are written **first**
   and fail before the component.
2. New file `frontend/src/components/screens/ActivityManagerScreen.tsx`, exported from
   `screens/index.ts`. Strict TS, no `any`.
3. Props:
   ```ts
   interface ActivityManagerScreenProps {
     activity: Activity;
     engine: MilestoneEngineResult;
     onBack: () => void;
     onComplete: () => void;
   }
   ```
4. Form fields (port): **name** (required), **activity class** single-select (from
   `engine.activityClasses`), **type** `SegmentedControl` (`performance`/`recovery`, reuse
   `../ui/SegmentedControl`), **volume unit** picker. Save disabled until name + class set.
5. **Mutation names on port:** Save calls `engine.updateActivity(activity.id, { name,
   activityClassId, type, defaultVolumeUnit })` (**not** the prototype's `editActivity`), then
   `onComplete()`. The Deactivate confirm calls `engine.deactivateActivity(activity.id)`, then
   `onComplete()`.
6. **VolumeUnit reconciliation:** the unit picker emits a valid `VolumeUnit`. Use the production
   unit list (match `NewActivitySheet`'s list / the `types.ts` union) — do NOT use the prototype's
   `UNIT_OPTS` verbatim if it diverges, and do NOT widen `VolumeUnit`. (Q3 default — match
   `NewActivitySheet`.)
7. Deactivate uses the inline two-step confirm (button → confirm card) from the prototype.
8. **AppShell display:** drop `style={{ minHeight: '100vh' }}`; fill the stack overlay column.
   Back + Save in the header.
9. `App.tsx` resolves `'activity-manager'` to this screen with `activity={params.activity}`.
10. `tsc --noEmit` and `eslint` clean.

### Implementation notes

- **Do not import** `export-2/...`. Reuse production `SegmentedControl`, `Card`, `cn`. Confirm the
  `NewActivitySheet` unit list and reuse the same source-of-truth array.
- `Activity.type` is `ActivityType` (`'performance' | 'recovery'`); `defaultVolumeUnit?` is
  `VolumeUnit`. Pre-fill all fields from the `activity` prop, including
  `defaultVolumeUnit ?? <sensible default in the union>`.

### Test strategy

- Render with an `activity` prop → assert fields pre-fill. Change name + unit, click Save → assert
  `engine.updateActivity(activity.id, {...})` then `onComplete`.
- Deactivate → confirm → assert `engine.deactivateActivity(activity.id)` then `onComplete`; cancel
  hides the confirm with no mutation.
- Validation: empty name → Save disabled, no mutation. Back → `onBack`, no mutation.

### Dependencies

F9.4 (stack key), F9.5 (Edit entry point from `ActivityManagerRow`), H9.0 (mutations).

---

## F9.10 — `InlineLogSheet`: port the Dashboard quick-log bottom sheet

**Type:** frontend
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** none hard (uses existing `submitLog`/`checkViolations`); pairs with Dashboard rewire
**Spec:** `export-2/src/components/screens/InlineLogSheet.tsx`,
`frontend/src/components/composites/RuleViolationBanner.tsx`,
`frontend/src/components/ui/{Slider,SegmentedControl}.tsx`

### Goal

Port `InlineLogSheet` into production strict TS as a **modal overlay** (not a stack push) opened
from Dashboard suggestion cards for quick logging, with live violation checks and
`engine.submitLog`.

### Acceptance criteria

1. Tests in `frontend/src/components/screens/InlineLogSheet.test.tsx` are written **first** and
   fail before the component.
2. New file `frontend/src/components/screens/InlineLogSheet.tsx`, exported from `screens/index.ts`.
   Strict TS, no `any`.
3. Props:
   ```ts
   interface InlineLogSheetProps {
     open: boolean;
     onClose: () => void;
     activity: Activity | null;
     engine: MilestoneEngineResult;
   }
   ```
4. Renders a bottom-sheet modal (scrim + bottom panel) when `open && activity`, with: duration
   stepper, volume stepper (unit from `activity.defaultVolumeUnit`), RPE `Slider`, feel
   `SegmentedControl`, and a `RuleViolationBanner` when `engine.checkViolations(...)` returns
   violations (override flow on `danger`). Reuse production `Slider`, `SegmentedControl`,
   `RuleViolationBanner` (paths confirmed present).
5. Submit builds a production `LogDraft`
   (`{ activityId, durationMinutes, volumeValue, volumeUnit?, rpe?, postActivityFeel?,
   ruleViolationsAtLog? }` — confirmed signature) and calls `engine.submitLog(draft)`, then
   `onClose()`. Submit disabled while a `danger` violation is unoverridden.
6. **Modal, not stack:** `InlineLogSheet` is rendered in `App.tsx` controlled by **its own state**
   (e.g. a `inlineLog: { activity } | null` state), NOT pushed onto `screenStack`. It renders
   above the current screen; the tab bar visibility rule is updated so the sheet behaves like the
   existing `overlay` modals if needed (default: the sheet floats above the dashboard with its own
   `z-50` scrim, tab bar can remain — match the existing overlay-vs-sheet behaviour; flag Q5).
7. **Dashboard trigger:** `DashboardScreen` suggestion cards currently call
   `onOpenLogActivity(s.id)` which opens the full `LogActivityScreen` overlay. Rewire the Dashboard
   suggestion "Log"/pick action to open `InlineLogSheet` with the picked activity instead (per
   handover §6: InlineLogSheet is for Dashboard safe/caution suggestions; the full
   `LogActivityScreen` stays the Log-tab flow). Resolve the picked suggestion id to an `Activity`
   via `engine.activities`. (Q5/Q10 default — Dashboard suggestions → InlineLogSheet; Log tab →
   full screen unchanged.)
8. The full `LogActivityScreen` overlay and the Log-tab flow are **unchanged**.
9. `tsc --noEmit` and `eslint` clean.

### Implementation notes

- **Do not import** `export-2/...`. The prototype's `defaultVol`/`volStep`/`NumStepper`/`FEEL_OPTS`
  helpers can be re-authored locally. `RuleViolationBanner` production props — confirm signature in
  `frontend/src/components/composites/RuleViolationBanner.tsx` and adapt (`onOverride`/`onDismiss`/
  `overrideLabel` in the prototype) to the production banner's actual props; do not assume they
  match.
- `engine.checkViolations` in production is **debounced** and returns the *last* resolved
  violations synchronously (it kicks off an async fetch and returns current `liveViolations`).
  This differs from the prototype's synchronous mock. Verify the sheet handles the
  "violations arrive a tick later" behaviour (re-render on state change) and that the test mocks
  `checkViolations` accordingly. Flag if the debounce makes the override UX awkward (Q11 —
  default: accept the existing debounce behaviour; the banner appears on the next render).
- Decide where `InlineLogSheet` state lives: `App.tsx` is the natural owner (it owns the Dashboard
  and the overlays). Add a minimal `inlineLogActivity: Activity | null` state + open/close, passed
  to `DashboardScreen` as a new callback prop (e.g. `onQuickLog(activity)`); keep `onOpenLogActivity`
  for any remaining full-screen entry points.

### Test strategy

- Render `open={true}` with an `activity` → assert fields render; change duration/volume/rpe/feel;
  submit → assert `engine.submitLog` called with the correct `LogDraft`, then `onClose`.
- Mock `engine.checkViolations` to return a `danger` violation → assert submit is disabled until
  override, banner renders, override enables submit.
- `open={false}` or `activity={null}` → renders nothing.
- Dashboard: clicking a suggestion's quick-log opens the sheet with the resolved activity (not the
  full `LogActivityScreen`).

### Dependencies

None hard. Pairs with the Dashboard trigger rewire.

---

## Q9.11 — Quality gates + Settings-flow verification

**Type:** frontend + backend + verification
**Branch:** `feat/phase-9-settings-flow`
**Depends on:** B9.1, B9.2, B9.3, H9.0, F9.4, F9.5, F9.6, F9.7, F9.8, F9.9, F9.10

### Goal

Run the full quality gates over the Phase 9 changes and verify the Settings flow + InlineLogSheet
end to end on the real backend.

### Acceptance criteria

1. `npx tsc --noEmit --project frontend/tsconfig.json` passes clean.
2. `npx eslint frontend/src` passes clean.
3. `npm --prefix frontend run test -- --coverage` passes; coverage thresholds hold with the four
   new Settings screens + `InlineLogSheet` + extended `SettingsScreen`/`App`/hook tests included.
   Do not lower thresholds without justification in the commit.
4. Backend gates over B9.1–B9.3: `ruff check backend`, `mypy backend/app --strict`, and
   `pytest backend/app/tests/test_dashboard_service.py backend/app/tests/test_dashboard_api.py
   backend/app/tests/test_training_blocks_api.py` (+ the new block-review test) pass.
5. `make lint` and `make test` (root) pass — no Makefile change expected; confirm.
6. **Manual verification matrix** (seeded backend + `docker compose up`, `http://localhost:5173`):
   1. `GET /api/dashboard` includes a top-level `previous_blocks` array (network tab / curl).
   2. `GET /api/training-blocks/{id}/review` returns `block`, `daily_scores`, `load_series`,
      `flare_up_dates` for both an active and a completed block; 404 for an unknown id.
   3. Settings tab renders Block summary, Previous Blocks, Activities, Preferences (unchanged).
   4. **Edit rules** pushes `EditBlockRulesScreen` (tab bar hidden, AppShell column width);
      changing a threshold/toggle updates the Dashboard traffic lights in the same session.
   5. **Review** (active) pushes `BlockReviewScreen` with charts; a previous block's **View**
      pushes `BlockReviewScreen` scoped to that block's dates.
   6. **+ New Training Block** pushes `NewTrainingBlockScreen`; creating a block archives the
      current block (status completed, `end_date` set) and **copies its rules** into the new block;
      persists across reload.
   7. An activity's **Edit** pushes `ActivityManagerScreen`; save updates the activity; deactivate
      removes it from the active list; persists across reload.
   8. **Reset mock data** (dev) still works via `POST /dev/reset`.
   9. A Dashboard suggestion's quick-log opens **InlineLogSheet** (bottom sheet, not a full
      screen); logging persists and updates the dashboard; the Log-tab full flow is unchanged.
   10. All five tab screens + the three existing modal overlays (check-in / log-activity /
       log-incident) + the Goals flow still function unchanged.
   11. All new stack screens render within the AppShell mobile column — no full-browser-width or
       unstyled overlays (the `100vh` removal is verified visually).

### Reuse / extend

- `Makefile`, `frontend/vitest.config.ts`, `AGENTS.md` §Quality Gates, the Phase 8 verification
  matrix (extend, do not duplicate).

### Edge cases to handle

- New screen branches dragging coverage down → add focused tests, don't lower thresholds.
- `tsc` strictness on ported prototype patterns (implicit `any`, untyped handlers, `React.FC`
  vs explicit return types) → type explicitly to match production style.
- Debounced `checkViolations` in `InlineLogSheet` → ensure tests don't rely on synchronous return.

### Dependencies

All other Phase 9 tickets.

---

## Out of scope (explicit — Phase 10 or later)

- Recovery-streaks UI, delayed-tax panel, load-graph dynamic title, review milestone, MCP stub.
- Editing `WEEKLY_TARGETS` / `ACTIVITY_CLASSES`; notification / unit toggles (remain prototype-only
  visual toggles); auth; multi-user.
- Switching the hook to read dashboard `previous_blocks` instead of the separate
  `['training-blocks']` query (Phase 10 cleanup — see Q6).
- Adding `resetMockData` to the hook (production uses `POST /dev/reset` directly — see Q2).
- Add/delete rule support in the stack `EditBlockRulesScreen` (the inline `EditRulesForm` retains
  it — see Q8).

---

## Open questions for owner (non-blocking defaults applied)

| # | Question | Recommended default |
| --- | --- | --- |
| Q1 | Hook mutation names — design lists `editRule`/`editActivity`/`submitNewBlock`; production uses `updateRule`/`createTrainingBlock` and (new) `updateActivity`. Keep production `update*`/`create*` naming? | **Yes — production naming.** New screens call existing names; H9.0 adds `updateActivity`/`deactivateActivity`. No renames of existing mutations. |
| Q2 | `resetMockData` — design lists it as a hook mutation; production already does dev reset via `POST /dev/reset` + `invalidateQueries()` in `SettingsScreen`. Add to hook anyway? | **No.** Verify the existing `/dev/reset` flow; do not add a hook mutation. |
| Q3 | `VolumeUnit` list in `ActivityManagerScreen` — prototype `UNIT_OPTS` omits `m`/`kg`; canonical union has 8 values. Which list to show? | **Match the production `NewActivitySheet` unit list** (single source of truth); never widen `VolumeUnit`. Flag if the two lists differ. |
| Q4 | `BlockReviewScreen` past blocks — prototype shows stats-only (no charts) for previous blocks. The new B9.2 endpoint now provides per-block charts. Show charts for past blocks too? | ✅ **CONFIRMED: Yes — show charts for past blocks** via B9.2. `BlockReviewScreen` renders the same charts for active and previous blocks. |
| Q5 | `InlineLogSheet` placement — modal overlay with its own state in `App` (not on `screenStack`), and Dashboard suggestions route to it instead of the full `LogActivityScreen`? | **Yes — modal via own `App` state; Dashboard suggestions → InlineLogSheet; Log tab → full screen unchanged.** |
| Q6 | After B9.1 adds dashboard `previous_blocks`, should the hook switch to it (drop the separate `['training-blocks']` query) or keep both? | **Keep both** for Phase 9 (no refetch rework); revisit as a Phase 10 cleanup. |
| Q7 | `SettingsScreen` already has inline `EditRulesForm`/`NewTrainingBlockSheet`. When the new nav props are provided, route to the stack screens and keep the inline sheets as the no-prop fallback? | **Yes — stack when prop provided; inline sheet as fallback.** Avoids two parallel surfaces wired to one button. Confirm if the owner wants the inline sheets removed entirely. |
| Q8 | Stack `EditBlockRulesScreen` — port only the prototype's threshold + enable/disable live editor, or also support add/delete (which the inline `EditRulesForm` already has)? | **Threshold + toggle only** (match the prototype). Add/delete stays in the inline form. |
| Q9 | `BlockReviewScreen` session/clean stat boxes for **previous** blocks rely on logs; `engine.logs` is a 30-day dashboard window and may not cover old blocks. Filter `engine.logs` client-side, or have B9.2 also return session/clean counts? | ✅ **CONFIRMED: B9.2 returns session/clean counts.** B9.2 response includes `total_sessions` and `clean_days` counts. F9.7 uses them for previous blocks; active block uses client-side engine fields. |
| Q10 | Dashboard currently routes suggestion picks to the full `LogActivityScreen`. Rewire all suggestion picks to InlineLogSheet, or only safe/caution suggestions (handover §6)? | ✅ **CONFIRMED: Rewire suggestion picks to InlineLogSheet**. Full `LogActivityScreen` remains available from the Log tab only. |
| Q11 | Production `checkViolations` is debounced/async (returns last resolved violations); the prototype's was synchronous. Accept the one-tick-late banner in InlineLogSheet? | **Accept the existing debounce behaviour.** Tests must not assume synchronous return. |

---

## Unresolved assumptions / risks the owner should know

- **The technical design and handover predate the current production code by two phases.** Most of
  the "Phase 9 hook work" (reactive `rules`/`activities`/`block`/`previousBlocks`, `createRule`/
  `updateRule`/`deleteRule`, `createTrainingBlock`, `submitNewActivity`) already shipped, and
  production `SettingsScreen` already contains inline `EditRulesForm`/`NewTrainingBlockSheet` plus a
  real `/dev/reset`. Phase 9 is therefore: 3 backend tickets (B9.1–B9.3), 1 tiny hook ticket
  (H9.0), the nav-key + props wiring (F9.4–F9.5), and the 5 new screens (F9.6–F9.10). It is **not**
  a literal port of the prototype hook — do not revert the production hook to the mock shape.
- **B9.3 partial-overlap risk:** `create_training_block` already auto-completes other active
  blocks but does NOT copy rules or set `end_date`. B9.3 must extend that path carefully so the
  outgoing block's rules are read **before** completion and copied to the new block. Watch FK
  integrity (copied rules point to the new block; originals stay on the old block).
- **B9.2 vs B3.0 overlap:** the existing `/scores` endpoint already does block-scoped daily scores.
  B9.2 should reuse that scoping pattern (and ideally share helpers) rather than diverge. The new
  `/review` endpoint is a superset (adds `block`, `load_series`, `flare_up_dates`, and — per Q9 —
  session/clean counts). Consider whether `/scores` should eventually be subsumed by `/review`
  (Phase 10 — out of scope now).
- **`_resolve_graph_class_id`/`_week_load_threshold` are private to `services/dashboard.py`.** B9.2
  needs the same class-resolution logic; promoting them to a shared module is preferable to copying.
  Confirm promotion doesn't change dashboard behaviour.
- **AppShell display regression risk:** every ported prototype screen uses
  `style={{ minHeight: '100vh' }}` and its own header chrome. Inside the Phase 8
  `stack-screen-overlay` (`absolute inset-0 ... bg-bg` within `AppShell`) that would break the
  mobile column. Each screen ticket explicitly requires dropping `100vh` for `min-h-full`/`flex-1`.
  Verify visually in Q9.11.
- **`checkViolations` debounce** (noted in F9.10/Q11) is a real behavioural difference from the
  prototype that the InlineLogSheet tests must account for.

---

**Status:** `SIGNED OFF` — all load-bearing questions resolved by owner (2026-06-03):
Q4 (charts for past blocks ✅), Q9 (B9.2 returns session/clean counts ✅), Q10 (Dashboard suggestions → InlineLogSheet ✅).
Q1, Q2, Q5, Q6, Q7, Q8, Q11 defaults applied. Ready for Test Writer in dependency order:
B9.1, B9.2, B9.3, H9.0 are independent; F9.4 → F9.5 → F9.6/F9.7/F9.8/F9.9 in parallel; F9.10 independent; Q9.11 last.
