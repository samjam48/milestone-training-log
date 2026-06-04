# Phase 8 — Goals Flow Tickets

*Source: `AGENTS.md` §Current Sprint, `agents/planner.md`,
`plans/feature-brief-v02-screen-completion-2026-06-02.md` §Phase 8,
`plans/technical-design-v02-screen-completion-2026-06-02.md`,
`export-2/handover.md`, `export-2/src/hooks/useMilestoneEngine.ts`,
`export-2/src/components/screens/GoalsScreen.tsx`,
`export-2/src/components/screens/GoalEditorScreen.tsx`,
`frontend/src/hooks/useMilestoneEngine.ts`,
`frontend/src/components/screens/GoalsScreen.tsx`,
`frontend/src/App.tsx`,
`backend/app/services/dashboard.py`, `backend/app/schemas/dashboard.py`,
`docs/api-map.md`, `docs/patterns.md` | Date: 2026-06-02*

---

## IMPORTANT — production has diverged from the prototype assumptions

The technical design and `export-2/handover.md` describe a **Tier-4 mock hook**
(`React.useState` over `mockData`). The **production** `frontend/src/hooks/useMilestoneEngine.ts`
is already a **React Query data hook** wired to the real backend, and **Phase 7
already shipped most of what the design lists as Phase 8 hook work.** Read the
"State of the world" table below before deriving any test or writing any code.
Several "port from prototype" steps are actually "reconcile / wire" steps.

### State of the world (verified 2026-06-02)

| Design item (Phase 8) | Prototype (`export-2`) | Production today | Phase 8 action |
| --- | --- | --- | --- |
| `goals` reactive state | `useState(GOALS)` | ✅ already reactive via `useQuery(['goals'])`, returned as `Omit<Goal,'userId'>[]` | **No hook change** — already done in Phase 7 F2.0 |
| `GoalDraft` interface | exported | ✅ already exported (richer: requires `targetDate`, `status`; supports `description`) | **Reuse existing** — do **not** replace with the prototype's looser shape |
| `submitGoal` mutation | `submitGoal(draft)` | ✅ exists as **`createGoal(draft)`** | **Name mismatch** — see B8.0; GoalEditorScreen must call `createGoal`, not `submitGoal` |
| `editGoal` mutation | `editGoal(id, updates)` | ✅ exists as **`updateGoal(id, patch)`** (takes `GoalPatch`) | **Name/shape mismatch** — GoalEditorScreen must call `updateGoal` with a `GoalPatch` |
| `archiveGoal` mutation | sets `status:'achieved'` | ✅ exists, sets **`status:'paused'`** (Phase 7 reversible-hide decision) | **Keep `'paused'`** — do not change to `'achieved'`; see Open Questions Q1 |
| Goal field naming `progressValue/Target/Unit` | uses `value/target/unit` internally | ✅ already `progressValue/progressTarget/progressUnit` throughout (`GoalCard`, `GoalDraft`, mappers) | **Already correct** — only the *new* `GoalEditorScreen` must adopt the production names while porting |
| Backend dashboard `goals` field | n/a | ❌ **NOT emitted** by `DashboardRead` / `get_dashboard` (api-map documents it as planned, schema/service do not implement it) | **Real backend work** — B8.1 |
| Navigation push/pop stack | `screenStack` in root `App` | ❌ `App.tsx` uses a flat `overlay` enum (`'check-in' \| 'log-activity' \| 'log-incident'`), no stack | **Real work** — F8.2 scaffolds the stack |
| `GoalsScreen` `onNewGoal`/`onEditGoal` props | present | ❌ not present; production has an inline `NewGoalForm` bottom sheet instead | **Real work** — F8.3 |
| `GoalEditorScreen` | exists in prototype | ❌ does not exist in production | **Real work — port** — F8.4 |

### Decisions locked for this ticket set

- **Goal field naming:** `progressValue` / `progressTarget` / `progressUnit`
  everywhere. Production is already on this convention; the only place that needs
  the rename-on-port is the new `GoalEditorScreen` (prototype uses `value/target/unit`).
- **Mutation names:** Phase 8 uses the **existing production names** `createGoal`
  and `updateGoal`. The design doc's `submitGoal`/`editGoal` are prototype names —
  do **not** rename the production hook to match the doc. (Flagged: Open Question Q2.)
- **Archive maps to `status: 'paused'`** (Phase 7 F2.5 decision, reversible). Do
  not change to `'achieved'`. (Flagged: Open Question Q1.)
- **`goals` lives in the existing `GET /api/dashboard` payload** — no separate
  endpoint. (The hook also has a standalone `useQuery(['goals'])`; B8.1 makes the
  dashboard payload self-consistent with the api-map. See Open Question Q3 on
  whether the hook should switch to the dashboard `goals` field or keep the
  separate query — default: keep both, no hook change.)
- **Navigation:** overlay push/pop stack (Option B, handover §5) added to
  `App.tsx`. Phase 8 wires the **Goals stack only**; the scaffold must be shaped
  so the Settings stack can be added in Phase 9 without rework.
- **`previous_blocks` is Phase 9** — do NOT add it to the dashboard in B8.1.
- **No schema changes** — Phase 8 touches no models and needs no Alembic migration.

### Hard constraints (from `AGENTS.md`)

- Tests before code — failing tests exist before production code, per ticket.
- No business logic in routers — dashboard `goals` assembly lives in
  `backend/app/services/dashboard.py`, not the router.
- No `any` in TS; `tsc --noEmit` and `eslint` clean. `mypy --strict` clean for backend.
- One logical change per ticket; all work on branch `feat/phase-8-goals-flow`.
- Do not push or merge — prepare and report.

---

## Ticket ordering rationale

1. **B8.1** (backend dashboard `goals`) first — it is independent, closes the
   api-map ↔ implementation gap, and is the only backend change in the phase.
2. **B8.0** (hook reconciliation) is a tiny clarifying ticket: confirm/no-op the
   hook surface and (only if owner approves Q2) add thin `submitGoal`/`editGoal`
   aliases. It precedes the screen work so the screen ticket has a settled API to
   call. If owner declines aliases, B8.0 is documentation-only and the screen
   calls `createGoal`/`updateGoal` directly.
3. **F8.2** (navigation scaffold) next — `GoalsScreen` props (F8.3) and
   `GoalEditorScreen` (F8.4) both need a stack to push onto.
4. **F8.3** (`GoalsScreen` props) — adds `onNewGoal`/`onEditGoal` and wires the
   buttons to the stack from F8.2.
5. **F8.4** (`GoalEditorScreen`) — the new screen the buttons push to; depends on
   the stack (F8.2), the props (F8.3), and the settled mutation API (B8.0).
6. **Q8.5** (quality gates + verification) — last; runs the gates and the manual
   Goals-flow matrix end to end.

---

## B8.1 — Backend: add `goals` to the dashboard payload

**Type:** backend
**Branch:** `feat/phase-8-goals-flow`
**Depends on:** Phase 7.5 on `main`

### Goal

Extend `GET /api/dashboard` to return the active goals list so the dashboard
payload matches the contract already documented in `docs/api-map.md`.

### Acceptance criteria

1. Tests in `backend/app/tests/test_dashboard_service.py` and
   `backend/app/tests/test_dashboard_api.py` are extended **first** and fail
   before the implementation lands.
2. `DashboardRead` (`backend/app/schemas/dashboard.py`) gains a
   `goals: list[GoalRead]` field. Reuse the existing `GoalRead` schema from
   `backend/app/schemas/goals.py` — do not define a new goal shape.
3. `get_dashboard` (`backend/app/services/dashboard.py`) populates `goals` by
   calling the existing `list_goals(session, status="active")` service
   (`backend/app/services/goals.py`) and serialising each via
   `GoalRead.model_validate(...)`. No goal querying logic is added to the router.
4. `goals` contains **only `status == 'active'`** goals (the "active goals list"
   per the feature brief). Ordering follows `list_goals` (by `target_date`, then `id`).
5. `previous_blocks` is **NOT** added — that is Phase 9.
6. The serialized JSON key is snake_case `goals` (FastAPI default), consistent
   with the other dashboard fields. Each goal object carries the same fields
   `GoalRead` already exposes (`progress_value`/`progress_target`/`progress_unit`,
   `status`, `timeframe`, `target_date`, `activity_class_id`, etc.).
7. All existing dashboard fields and their values are unchanged.
8. `mypy backend/app --strict` and `ruff check backend` pass clean.

### Implementation notes

- Add the import `from app.services.goals import list_goals` and
  `from app.schemas.goals import GoalRead` in `services/dashboard.py`.
- Insert the `goals=[...]` argument into the existing `DashboardRead(...)`
  constructor at the end of `get_dashboard`.
- The `as_of` filter does **not** apply to goals (goals are not date-windowed
  like logs); return all active goals regardless of `as_of`.
- No model, migration, or router change. The router `backend/app/routers/dashboard.py`
  already returns `get_dashboard(...)` verbatim.

### Test strategy

- **Service test:** seed two active goals + one `paused` goal, call
  `get_dashboard`, assert `len(result.goals) == 2`, the paused goal is absent,
  and a known goal's `progress_target`/`status` round-trip correctly.
- **API test:** `GET /api/dashboard` returns 200 with a top-level `goals` array;
  assert the array length and that one goal object contains snake_case
  `progress_target` and `status`. Add a case with **no** active goals → `goals == []`.
- Confirm the no-active-block path still returns `goals` (goals are independent of
  the active block).

### Dependencies

None (independent backend ticket).

---

## B8.0 — Hook reconciliation for the Goals editor (clarify + optional aliases)

**Type:** frontend (small)
**Branch:** `feat/phase-8-goals-flow`
**Depends on:** B8.1 (so the dashboard contract is settled) — soft; can run in parallel

### Goal

Settle the exact hook API the new `GoalEditorScreen` will call, reconciling the
technical-design names (`submitGoal`/`editGoal`) with the production names
(`createGoal`/`updateGoal`) so F8.4 has a stable target.

### Context

The technical design lists `submitGoal`, `editGoal`, `archiveGoal` as new Phase 8
hook mutations. In production these **already exist** as `createGoal`,
`updateGoal`, `archiveGoal` (Phase 7 F2.0). No new reactive state, no new
`GoalDraft`, and no field renames are needed — that work is done. This ticket
exists to make the divergence explicit and to apply the owner's decision on
naming **before** the screen is written.

### Acceptance criteria

1. **Default path (no alias):** No production code change. The ticket records
   that `GoalEditorScreen` will call the existing `engine.createGoal(draft)` and
   `engine.updateGoal(goalId, patch)`. The existing
   `useMilestoneEngine.test.tsx` already covers these mutations — confirm the
   coverage and add a focused assertion only if a gap is found.
2. **Only if owner approves Open Question Q2 (thin aliases):** add
   `submitGoal = createGoal` and `editGoal = updateGoal` aliases to
   `MilestoneEngineResult` and the returned object, with tests asserting the
   alias forwards to the same mutation. The existing names stay (additive only).
   No behaviour change.
3. `archiveGoal` behaviour is **unchanged** — it continues to PATCH
   `status: 'paused'`. Do not change to `'achieved'`.
4. `tsc --noEmit` and `eslint` clean; existing screens and tests unchanged.

### Implementation notes

- The production `GoalDraft` requires `title`, `targetDate`, `timeframe`,
  `status` and accepts optional `activityClassId`, `progressValue`,
  `progressTarget`, `progressUnit`, `description`. `GoalPatch` is
  `Partial<Omit<GoalDraft,'title'>> & { title?; status? }`. F8.4 must build a
  `GoalDraft` for create and a `GoalPatch` for edit using these existing types —
  not the prototype's looser `GoalDraft`.
- Do **not** import or copy `export-2/src/hooks/useMilestoneEngine.ts`; it is a
  reference-only mock hook.

### Test strategy

- If no alias: verify `frontend/src/hooks/useMilestoneEngine.test.tsx` already
  asserts `createGoal` and `updateGoal` invalidate `['goals']`; this is the API
  F8.4 relies on.
- If aliases added: one test per alias asserting it triggers the same underlying
  `patchGoal`/`createGoal` API call (mock `frontend/src/lib/api`).

### Dependencies

None hard. Resolve **Open Question Q2** before starting F8.4.

---

## F8.2 — Navigation: overlay push/pop screen stack in `App`

**Type:** frontend
**Branch:** `feat/phase-8-goals-flow`
**Depends on:** none (App-level; safe to land before screen work)
**Spec:** `export-2/handover.md` §5 Option B,
`plans/technical-design-v02-screen-completion-2026-06-02.md` §4

### Goal

Add a lightweight push/pop screen-stack to `frontend/src/App.tsx` that renders the
top-of-stack screen as a full-viewport overlay above the tab bar, replacing the
need to add another flat `overlay` enum value per editor screen. Phase 8 wires the
**Goals stack only**; the scaffold must be Phase-9-ready for the Settings stack.

### Acceptance criteria

1. Tests in `frontend/src/App.test.tsx` are extended **first** and fail before
   the change.
2. `App.tsx` gains stack state and helpers, typed (no `any`):
   ```ts
   type StackEntry = { screen: string; params: Record<string, unknown> };
   const [screenStack, setScreenStack] = React.useState<StackEntry[]>([]);
   const pushScreen = (screen: string, params: Record<string, unknown> = {}) =>
     setScreenStack((s) => [...s, { screen, params }]);
   const popScreen = () => setScreenStack((s) => s.slice(0, -1));
   ```
   (A small discriminated-union variant is acceptable if it stays type-safe and
   extensible; the string-key form above matches the handover and is the default.)
3. When `screenStack` is non-empty, the **top** entry renders as a full-viewport
   overlay (existing overlay/AppShell pattern — `position` fixed/absolute filling
   the shell) **above** the bottom tab bar, and the tab bar is hidden
   (`showTabBar` is false while a stack screen or an existing overlay is open).
4. The existing flat `overlay` enum (`'check-in' | 'log-activity' | 'log-incident'`)
   is **left intact and functional** — these modal overlays are not migrated in
   Phase 8. The stack coexists with them. (Precedence rule must be defined and
   tested: if both an overlay and a stack entry could be active, document which
   wins — default: an open `overlay` takes precedence, and stack screens are only
   pushed from tab screens, so they cannot collide in practice.)
5. Phase 8 registers exactly one stack screen key: `'goal-editor'`. Rendering it
   resolves to `<GoalEditorScreen ... />` (added in F8.4). Until F8.4 lands, the
   switch may render a typed placeholder; F8.4 replaces it. Unknown stack keys
   render nothing (or a typed fallback) — never crash.
6. The five existing screens and three existing overlays behave exactly as before
   when the stack is empty (regression-guarded by `App.test.tsx`).
7. `tsc --noEmit` and `eslint` clean.

### Implementation notes

- Keep the change minimal and additive: do not refactor the existing
  `overlay`/`activeTab` branching beyond what is needed to host the stack render.
- Compute `showTabBar = overlay === null && screenStack.length === 0`.
- Render order: tab content → stack overlay (top entry) on top → tab bar when
  visible. Reuse `AppShell`'s `withTabBar` prop.
- Pushing/popping is owner state in `App`; pass `pushScreen`/`popScreen`-derived
  callbacks down as the screen props in F8.3/F8.4 (e.g. `onNewGoal`, `onEditGoal`,
  `onBack`, `onComplete`).
- Do not introduce React Navigation or any new dependency (handover §5 Option A
  is explicitly not chosen).

### Test strategy

- Mount `App`, assert stack is empty and a tab screen renders.
- Simulate `pushScreen('goal-editor', { goal })` (via a test hook on the rendered
  Goals screen once F8.3 is in, or via a temporary test affordance) → assert the
  placeholder/editor overlay renders and the tab bar is hidden.
- `popScreen` → assert the overlay unmounts and the tab bar returns.
- Regression: opening each existing overlay still hides the tab bar and renders
  the correct screen; closing returns to the tab.

### Dependencies

None. Blocks F8.3 and F8.4.

---

## F8.3 — `GoalsScreen`: add `onNewGoal` / `onEditGoal` props and wire buttons

**Type:** frontend
**Branch:** `feat/phase-8-goals-flow`
**Depends on:** F8.2
**Spec:** `export-2/src/components/screens/GoalsScreen.tsx`,
`plans/technical-design-v02-screen-completion-2026-06-02.md` §5

### Goal

Add the two new props to the production `GoalsScreen` and route the "+ New Goal"
CTA and each goal's "Edit" button to push `GoalEditorScreen` onto the stack,
keeping the existing archive flow intact.

### Acceptance criteria

1. Tests in `frontend/src/components/screens/GoalsScreen.test.tsx` are extended
   **first** and fail before the change.
2. `GoalsScreenProps` gains two optional props (matching the design signature):
   ```ts
   onNewGoal?: () => void;
   onEditGoal?: (goal: Omit<Goal, 'userId'>) => void;
   ```
   (Use `Omit<Goal,'userId'>` to match the production `goals` element type, not
   the prototype's bare `Goal`.)
3. The sticky "+ New Goal" button calls `onNewGoal?.()` when provided. Each active
   goal card's **Edit** button calls `onEditGoal?.(goal)` when provided.
4. **Inline `NewGoalForm` handling (decide and apply Open Question Q4):**
   - **Default:** when `onNewGoal` is provided, the "+ New Goal" button routes to
     the editor (push) instead of opening the inline `NewGoalForm` bottom sheet;
     when `onNewGoal` is **not** provided, the existing inline sheet still opens
     (backward compatible). This avoids two parallel create UIs while keeping the
     screen usable standalone in tests.
   - Document clearly which path is active; do not silently leave both create
     surfaces wired to the same button.
5. The existing **Archive** flow (confirm row → `engine.archiveGoal`), the
   **Paused/Restore** section, the **Achieved** collapsible, grouping by
   timeframe, and the empty state are all **unchanged**.
6. `App.tsx` passes `onNewGoal={() => pushScreen('goal-editor', {})}` and
   `onEditGoal={(goal) => pushScreen('goal-editor', { goal })}` to `<GoalsScreen>`.
7. `tsc --noEmit` and `eslint` clean; no change to other screens.

### Implementation notes

- The production `GoalCard` already has an `onEdit?: () => void` prop wired into an
  Edit button (currently passed `() => undefined` from `GoalsScreen`). Replace
  those call-sites with `onEditGoal ? () => onEditGoal(g) : undefined` for the
  monthly and quarterly groups (achieved goals stay read-only — no Edit).
- Keep the `confirmingArchive` inline-confirm UX from Phase 7 intact.
- The prototype passes `onArchive={archiveGoal}` directly; production wraps it in
  a confirm step (Phase 7 F2.5). Keep production's confirm behaviour.

### Test strategy

- Render `GoalsScreen` with `onNewGoal`/`onEditGoal` spies; assert clicking
  "+ New Goal" calls `onNewGoal` (and does **not** open the inline sheet), and
  clicking a goal's Edit calls `onEditGoal` with that goal object.
- Render **without** the new props; assert the legacy inline `NewGoalForm` still
  opens (backward-compat path).
- Assert Archive/Restore/Achieved behaviours are unchanged (regression).

### Dependencies

F8.2 (needs `pushScreen` from `App`). Pairs with F8.4 for end-to-end flow.

---

## F8.4 — `GoalEditorScreen`: port the create/edit goal screen

**Type:** frontend
**Branch:** `feat/phase-8-goals-flow`
**Depends on:** F8.2, F8.3, B8.0
**Spec:** `export-2/src/components/screens/GoalEditorScreen.tsx`

### Goal

Port `GoalEditorScreen` from the prototype into production strict TypeScript as a
full-screen stack screen for creating a new goal or editing an existing one,
adopting the production field names and the production hook mutation API.

### Acceptance criteria

1. Tests in `frontend/src/components/screens/GoalEditorScreen.test.tsx` are
   written **first** and fail before the component.
2. New file `frontend/src/components/screens/GoalEditorScreen.tsx`, exported from
   `frontend/src/components/screens/index.ts`. Strict TS, no `any`.
3. Props:
   ```ts
   interface GoalEditorScreenProps {
     goal?: Omit<Goal, 'userId'> | null;
     engine: MilestoneEngineResult;
     onBack: () => void;
     onComplete: () => void;
   }
   ```
   (`goal` element type matches production `engine.goals`.)
4. **Field naming on port:** the prototype's internal `value` / `target` / `unit`
   form state must be renamed to read/write `progressValue` / `progressTarget` /
   `progressUnit`. No `value/target/unit` field names survive the port.
5. Form fields (port from prototype): **title** (required, autofocus),
   **timeframe** segmented control (`monthly` / `quarterly`), **target date**
   (optional in prototype — but production `GoalDraft.targetDate` is **required**;
   see note), **activity class** single-select (optional, includes a "None"
   option), and a **"Track numeric progress"** toggle revealing
   current/target/unit inputs.
6. **Save (create):** builds a production `GoalDraft`
   (`{ id is generated by the hook, title, targetDate, timeframe, status: 'active',
   activityClassId?, progressValue?, progressTarget?, progressUnit? }`) and calls
   `engine.createGoal(draft)`, then `onComplete()`.
7. **Save (edit):** builds a production `GoalPatch` from the changed fields and
   calls `engine.updateGoal(goal.id, patch)`, then `onComplete()`.
8. **Back:** `onBack()` discards and pops the stack with no mutation.
9. Save disabled until `title.trim()` is non-empty **and** (per production
   `GoalDraft`) a target date is set — see Open Question Q5 for whether to relax
   the date requirement; default keeps it required to satisfy the existing type
   and backend.
10. The screen renders correctly both as **New Goal** (no `goal` prop) and
    **Edit Goal** (with a `goal` prop pre-filling all fields, including the
    numeric-progress toggle state when `progressTarget != null`).
11. `App.tsx` resolves the `'goal-editor'` stack key to
    `<GoalEditorScreen goal={params.goal as ... } engine={engine}
    onBack={popScreen} onComplete={popScreen} />` (replacing the F8.2 placeholder).
12. `tsc --noEmit` and `eslint` clean.

### Implementation notes

- **Do not import** `export-2/...`; it is reference-only. Re-author against
  production UI primitives. Reuse the existing production `SegmentedControl`,
  `Card`, and `cn` utilities (same imports the prototype uses — confirm they exist
  under `frontend/src/components/ui/`).
- Use `engine.activityClasses` for the class picker (production element type
  `ActivityClass`).
- Production `GoalDraft.progressUnit` is typed `VolumeUnit`; the unit picker must
  emit a `VolumeUnit` value. The prototype's `UNIT_OPTS` (`km, mi, sessions, sets,
  minutes, reps`) should be reconciled with the production `VolumeUnit` union and
  the unit list already used in the inline `NewGoalForm`
  (`km, mi, m, minutes, reps, sets, sessions`). Use the production `VolumeUnit`
  set; flag any mismatch rather than widening the type.
- For **edit**, only send changed fields in the `GoalPatch` (the patch validator
  rejects explicit nulls for required fields like `title`, `targetDate`,
  `timeframe`, `status` — never send those as `null`).
- Generate IDs the production way: the hook's `createGoal` already injects
  `crypto.randomUUID()`; the screen passes a draft **without** an `id`.

### Test strategy

- **Create:** render with no `goal`, fill title + target date + timeframe, enable
  numeric progress, set target/unit, click Create → assert `engine.createGoal`
  called once with a correctly shaped `GoalDraft` (camelCase, `status:'active'`,
  no `id`), then `onComplete` called.
- **Edit:** render with a `goal` prop, assert fields pre-fill (including the
  numeric toggle on when `progressTarget != null`), change the title, click Save →
  assert `engine.updateGoal(goal.id, patch)` called with only the changed field(s)
  and `onComplete` fired.
- **Validation:** empty title (and missing date if kept required) → Save disabled,
  no mutation.
- **Back:** click Back → `onBack` fired, no mutation.

### Dependencies

F8.2 (stack), F8.3 (push entry points), B8.0 (settled mutation API).

---

## Q8.5 — Quality gates + Goals-flow verification

**Type:** frontend + verification
**Branch:** `feat/phase-8-goals-flow`
**Depends on:** B8.1, B8.0, F8.2, F8.3, F8.4

### Goal

Run the full quality gates over the Phase 8 changes and verify the Goals flow end
to end on the real backend.

### Acceptance criteria

1. `npx tsc --noEmit --project frontend/tsconfig.json` passes clean.
2. `npx eslint frontend/src` passes clean.
3. `npm --prefix frontend run test -- --coverage` passes; the Phase 6/7 coverage
   thresholds hold with the new `GoalEditorScreen` + extended `GoalsScreen`/`App`
   tests included. Do not lower thresholds without justification in the commit.
4. Backend gates over the B8.1 change: `ruff check backend`,
   `mypy backend/app --strict`, and
   `pytest backend/app/tests/test_dashboard_service.py backend/app/tests/test_dashboard_api.py`
   pass.
5. `make lint` and `make test` (root) pass — no Makefile change expected; confirm.
6. **Manual verification matrix** (seeded backend + `docker compose up`,
   `http://localhost:5173`):
   1. `GET /api/dashboard` response includes a top-level `goals` array of active
      goals (verify via network tab or curl).
   2. Goals tab renders goals grouped by timeframe (unchanged from Phase 7).
   3. "+ New Goal" pushes `GoalEditorScreen` as a full-screen overlay; the tab bar
      is hidden while it is open.
   4. Create a goal in the editor → Save → returns to Goals tab → new goal appears
      in the correct group; persists across reload.
   5. A goal's "Edit" pushes `GoalEditorScreen` pre-filled → change a field → Save
      → change reflected in the list; persists across reload.
   6. Back from the editor discards changes with no mutation.
   7. Archive / Restore / Achieved behaviours unchanged.
   8. All five original screens and the three existing modal overlays
      (check-in / log-activity / log-incident) still function unchanged.

### Reuse / extend

- `Makefile`, `frontend/vitest.config.ts`, `AGENTS.md` §Quality Gates.
- Phase 7 verification matrix (extend, do not duplicate).

### Edge cases to handle

- New screen branches dragging coverage down → add focused tests, don't lower
  thresholds.
- `tsc` strictness on ported prototype patterns (implicit `any`, untyped event
  handlers) → type explicitly.

### Dependencies

All other Phase 8 tickets.

---

## Out of scope (explicit — Phase 9 or later)

- Settings flow screens: `EditBlockRulesScreen`, `BlockReviewScreen`,
  `NewTrainingBlockScreen`, `ActivityManagerScreen`.
- `InlineLogSheet` (Dashboard quick-log bottom sheet).
- Backend `previous_blocks` in the dashboard payload.
- New `GET /api/training-blocks/{block_id}/review` endpoint.
- `POST /api/training-blocks` rule-copy service behaviour.
- Settings stack in the navigation scaffold (the scaffold is built Phase-9-ready,
  but only the Goals stack is wired in Phase 8).
- Remaining hook mutations (`submitNewActivity` edits, `editActivity`,
  `deactivateActivity`, `editRule`, `submitNewBlock`, `resetMockData` are either
  already present from Phase 7 or are Phase 9 — Phase 8 adds no new ones).
- Editing `WEEKLY_TARGETS` / `ACTIVITY_CLASSES`; notification / unit toggles; auth.

---

## Open questions for owner (non-blocking defaults applied)

| # | Question | Decision |
| --- | --- | --- |
| Q1 | Archive goal status — design doc says `'achieved'`, production (Phase 7) uses `'paused'` (reversible hide). Keep `'paused'`? | ✅ **CONFIRMED: Keep `'paused'`** — unchanged from Phase 7; no Phase 8 change |
| Q2 | Hook mutation names — design lists `submitGoal`/`editGoal`; production has `createGoal`/`updateGoal`. Add thin aliases, or have the new screen call the production names directly? | ✅ **CONFIRMED: Call production names directly** (`createGoal`/`updateGoal`); no aliases — B8.0 is documentation-only |
| Q3 | The hook already loads goals via a standalone `useQuery(['goals'])`. After B8.1 adds `goals` to the dashboard payload, should the hook switch to the dashboard field (one fewer request) or keep the separate query? | **Keep both** for Phase 8 (no hook refetch rework); revisit as a Phase 10 cleanup |
| Q4 | `GoalsScreen` already has an inline `NewGoalForm` bottom sheet (Phase 7). When `onNewGoal` is provided, should "+ New Goal" route to the new editor instead of the sheet? | **Yes — route to the editor when `onNewGoal` is provided**; inline sheet remains as the no-prop fallback |
| Q5 | Prototype makes target date optional; production `GoalDraft.targetDate` and the backend schema make it required. Relax to optional (schema change) or keep required? | **Keep required** — no schema change in Phase 8; editor requires a target date |

---

## Unresolved assumptions / risks the owner should know

- **The technical design predates the current production hook.** Roughly half of
  the design's "Phase 8 hook work" (reactive goals, `GoalDraft`, create/edit/
  archive mutations, field naming) already shipped in Phase 7. These tickets treat
  that work as done and focus Phase 8 on: the backend dashboard `goals` field, the
  navigation stack scaffold, the `GoalsScreen` props, and the new
  `GoalEditorScreen`. If the owner expected a literal port of the prototype hook,
  flag before implementation — the production hook should **not** be reverted to
  the mock shape.
- **`docs/api-map.md` already documents `goals` (and `previous_blocks`) in the
  dashboard** even though the backend does not emit them yet. B8.1 closes the
  `goals` half of that gap; the `previous_blocks` half stays a documented-but-
  unimplemented Phase 9 item. The doc may read as if both already exist — they do
  not.
- **`VolumeUnit` reconciliation:** the prototype's goal unit list and the
  production inline `NewGoalForm` unit list differ slightly. F8.4 must emit a
  valid `VolumeUnit`; resolve the canonical list against `frontend/src/types.ts`
  rather than widening the type.
- **Two create surfaces:** until Q4 is confirmed, `GoalsScreen` could end up with
  both the inline sheet and the editor wired to "+ New Goal". The default
  (editor-when-prop-provided) avoids this; confirm if the owner wants the inline
  sheet removed entirely instead.

---

**Status:** `SIGNED OFF` — all five open questions resolved (Q1 + Q2 confirmed by owner 2026-06-02; Q3–Q5 defaults applied). Ready for Test Writer to start on **B8.1** and **B8.0 / F8.2** in dependency order.
