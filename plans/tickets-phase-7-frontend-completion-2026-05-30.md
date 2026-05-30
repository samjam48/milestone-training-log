# Phase 7 — Frontend Completion Tickets
*Source: `plans/TRD.md` §Phase 7, `plans/PRD.md` §screens-to-port,
`MOCKUPS.md` §Screens 4 / 5 / 5b / 6 / 6b, `export/preview/*.jsx`,
`frontend/src/hooks/useMilestoneEngine.ts`, `docs/api-map.md`,
architect review 2026-05-30 | Date: 2026-05-30*

## Planning assumptions locked for this ticket set

- Phase 0–6 are complete and merged to `main`. Backend API, seed script,
  `GET /api/dashboard`, the typed API client (`frontend/src/lib/api/`), and the
  five Tier-3 screens are live on real data.
- Phase 7 is **frontend-only**. No backend schema, router, or service changes.
  If a test exposes a pre-existing backend bug, file a `fix/` ticket and add it
  to `plans/BACKLOG.md` — do not fix in Phase 7 scope.
- All work lands on branch **`feat/phase-7-frontend-completion`**.
- **All API client wrappers already exist** from Phase 6 F1.2 and are exported
  from `frontend/src/lib/api/index.ts`:
  - Goals: `listGoals`, `createGoal`, `patchGoal`
  - Rules: `listRulesByBlock`, `createRule`, `patchRule`, `deleteRule`
  - Weekly targets: `listWeeklyTargetsByBlock`, `createWeeklyTarget`, `patchWeeklyTarget`
  - Activities: `listActivities`, `createActivity`, `patchActivity`
  - Training blocks: `listTrainingBlocks`, `getActiveTrainingBlock`, `createTrainingBlock`, `patchTrainingBlock`
  - Phase 7 **consumes** these wrappers; it does **not** add new ones unless a
    gap is found (flag it, do not invent silently).
- **All domain types already exist** in `frontend/src/types.ts`: `Goal`,
  `GoalTimeframe`, `GoalStatus`, `Rule`, `RuleType`, `WeeklyTarget`,
  `RecoveryTarget`, `Activity`, `TrainingBlock`, `TrainingBlockStatus`.
- **JSON casing unchanged:** backend snake_case ↔ frontend camelCase; all mapping
  stays in `frontend/src/lib/api/`. Screens and hook see camelCase only.
- **Client-generated IDs:** every POST body requires a client-generated `id`
  (`crypto.randomUUID()`), matching the Phase 6 mutation pattern in the hook.
- **`export/` stays frozen.** `export/preview/*.jsx` are reference specs only —
  port to TypeScript under `frontend/src/`, do not import or copy at runtime.
- **Prototype consumes `engine.*`.** The preview JSX reads fields and calls
  mutations that the current `MilestoneEngineResult` does **not** yet expose
  (`goals`, `rules`, `weeklyTargets`, `previousBlocks`, `archiveGoal`,
  `submitNewActivity`, etc.). F2.0 closes that gap before the screens are ported.

## Owner decisions resolved (2026-05-30)

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Deferred-item routing | `CalendarHeatmap` block-review → **Phase 7.5**; `recovery_streaks` UI + delayed-tax panel + dynamic load-graph title → **Phase 8** |
| 2 | Phase 7 scope | **3 screen ports only** (NewActivitySheet, GoalsScreen, SettingsScreen) + the hook data plane they require |
| 3 | Backend changes | **None** — all endpoints and wrappers already exist |

## Planner assumptions (no owner block — change if wrong)

| # | Topic | Assumption |
| --- | --- | --- |
| A | `previousBlocks` source | `listTrainingBlocks()` minus the active block (status `completed` / `archived`, or `id !== block.id`). No new endpoint. |
| B | Hook data/view split | **F2.0 owns the entire data plane** (new queries + mutations + result-type fields). Screen tickets are pure view + interaction + routing and call `engine.*`. Keeps hook edits in one ticket, avoids cross-ticket merge churn, and each screen ticket stays end-to-end verifiable because its mutation already exists. |
| C | Query keys | `['goals']`, `['rules', blockId]`, `['weekly-targets', blockId]`, `['training-blocks']`. Block-scoped queries `enabled` only when `block` exists. |
| D | Invalidation | Goal mutations invalidate `['goals']`; rule mutations invalidate `['rules', blockId]`; new-activity invalidates `['dashboard']` + `['activities']` (dashboard supplies `activities`); block mutations invalidate `['training-blocks']` + `['dashboard']`. |
| E | Preferences toggles | Settings "Notifications" / "Metric units" / "Reset mock data" stay **local-only / non-functional** (no backend persistence in Phase 7) — render the controls, no API calls. Flag if owner wants them wired. |
| F | Edit affordances | Per-goal **Edit** and per-activity **Edit** were `() => {}` no-ops in the prototype. Phase 7 ships **create + archive/status** flows (the TRD verification path); inline per-row Edit of an existing goal/activity is **out of scope** unless trivially reusing the create form. Flag if full edit is required. |
| G | New-block creation | Minimal create sheet: name + start date → `createTrainingBlock`. Setting rules/targets on a brand-new block reuses the Edit-Rules flow afterward; not bundled into block creation. |
| H | NewActivitySheet trigger | Wired into `LogActivityScreen` via a new `onOpenNewActivity` affordance (the "+" / Activity Manager entry from MOCKUPS §Screen 6). On create, the sheet closes and the new activity is selectable in the picker. |

---

## Ticket ordering rationale

**F2.0** extends the hook (`MilestoneEngineResult`) with the data and mutations
the three screens depend on — the integration seam. Nothing renders the new data
yet, but it is independently testable against the mocked API client.

**F2.1** (NewActivitySheet) is smallest and unblocks a concrete verification
loop (create activity → appears in Log Activity picker). It exercises the
`submitNewActivity` mutation from F2.0.

**F2.2** (GoalsScreen) ports the Goals tab and its create/archive flow,
replacing the "Coming soon" placeholder.

**F2.3** (SettingsScreen) is the largest — block summary, rules list, Edit-Rules
form, and New-Block sheet — and depends on the most F2.0 surface area.

**F2.4** hardens quality gates for the new files and runs the end-to-end manual
verification matrix.

---

## F2.0 — Hook data plane for completion screens

**Type:** frontend
**Branch:** `feat/phase-7-frontend-completion`
**Depends on:** Phase 6 on `main`

### Acceptance criteria

- Tests in `frontend/src/hooks/useMilestoneEngine.test.tsx` are extended **before**
  hook changes and fail first (mock the `frontend/src/lib/api` module).
- **`MilestoneEngineResult` gains read fields:**
  - `goals: Goal[]` — from `listGoals()` (all statuses; screen filters by
    `status` / `timeframe`), query key `['goals']`
  - `rules: Rule[]` — from `listRulesByBlock(block.id)`, key `['rules', blockId]`,
    `enabled: !!block`
  - `weeklyTargets: WeeklyTarget[]` — from `listWeeklyTargetsByBlock(block.id)`,
    key `['weekly-targets', blockId]`, `enabled: !!block`
  - `previousBlocks: TrainingBlock[]` — from `listTrainingBlocks()` filtered to
    exclude the active block (status `completed` / `archived`, or `id !== block.id`),
    key `['training-blocks']`
- **`MilestoneEngineResult` gains mutation fields** (all generate a client UUID
  for create, map camel→snake via existing wrappers, invalidate per assumption D):
  - `submitNewActivity(draft: NewActivityDraft): void` → `createActivity`
    (`{ id, name, activityClassId, type, defaultVolumeUnit, isActive: true }`)
  - `createGoal(draft: GoalDraft): void` → `createGoal`
  - `updateGoal(goalId: ID, patch: GoalPatch): void` → `patchGoal`
  - `archiveGoal(goalId: ID): void` → `patchGoal(goalId, { status: 'archived' })`
    — **flag:** `GoalStatus` is `'active' | 'achieved' | 'missed' | 'paused'`;
    there is no `'archived'`. Resolve before implementation: either map "Archive"
    → `status: 'paused'`, or confirm backend accepts an archived status. **Default
    if silent: `status: 'paused'`** (reversible hide; no schema change).
  - `createRule(draft: RuleDraft): void` → `createRule(block.id, …)`
  - `updateRule(ruleId: ID, patch: RulePatch): void` → `patchRule`
  - `deleteRule(ruleId: ID): void` → `deleteRule`
  - `createTrainingBlock(draft: BlockDraft): void` → `createTrainingBlock`
- **New draft interfaces** exported from the hook module (camelCase, mirror the
  existing `LogDraft` / `CheckInDraft` style): `NewActivityDraft`, `GoalDraft`,
  `GoalPatch`, `RuleDraft`, `RulePatch`, `BlockDraft`.
- Existing result fields and the five existing screens are **unchanged** — the
  result type extends additively; no existing screen import changes.
- Mutations are fire-and-forget (`void`) with query invalidation, matching the
  Phase 6 mutation contract. Do not block the UI on the network round-trip.
- Hook tests cover at minimum:
  - `goals`, `rules`, `weeklyTargets`, `previousBlocks` queries fire on mount
    (rules/weeklyTargets only when a block exists)
  - `submitNewActivity` POSTs snake_case body with generated `id` and invalidates
    `['dashboard']` + `['activities']`
  - `createGoal` / `archiveGoal` invalidate `['goals']`
  - `createRule` / `deleteRule` invalidate `['rules', blockId]`
  - `previousBlocks` excludes the active block

### Reuse / extend

- `frontend/src/lib/api/{goals,rules,weeklyTargets,activities,trainingBlocks}.ts`
- `frontend/src/types.ts` — `Goal`, `Rule`, `WeeklyTarget`, `Activity`,
  `TrainingBlock`, enums
- `frontend/src/hooks/useMilestoneEngine.ts` — existing `useMutation` +
  `invalidateQueries` pattern; existing `crypto.randomUUID()` usage

### Edge cases to handle

- No active block (`block` null) → `rules` / `weeklyTargets` queries disabled,
  default to `[]`; `previousBlocks` still lists all blocks
- Empty `[]` list responses (not null) for every new query
- Goal with no `progressTarget` → qualitative; hook passes through untouched
- `archiveGoal` status mapping (see flag above)
- Block-scoped query keys must include `blockId` so switching active blocks
  refetches correctly

### Files to create / modify

- `frontend/src/hooks/useMilestoneEngine.ts`
- `frontend/src/hooks/useMilestoneEngine.test.tsx`

### Out of scope

- Any screen rendering (F2.1–F2.3)
- New API wrappers or backend changes
- `CalendarHeatmap` / block-review data (Phase 7.5)

---

## F2.1 — NewActivitySheet.tsx (ad-hoc activity creator)

**Type:** frontend
**Branch:** `feat/phase-7-frontend-completion`
**Depends on:** F2.0
**Spec:** `export/preview/NewActivitySheet.jsx`, `MOCKUPS.md` §Screen 6 / 6b

### Acceptance criteria

- Component tests in `frontend/src/components/screens/NewActivitySheet.test.tsx`
  written **before** the component and fail first.
- `frontend/src/components/screens/NewActivitySheet.tsx` ported from the JSX
  prototype to strict TypeScript (no `any`):
  - Props: `{ open: boolean; onClose: () => void; activityClasses: ActivityClass[];
    onCreate: (draft: NewActivityDraft) => void; onCreated?: (draft: NewActivityDraft) => void }`
    (consume `engine.submitNewActivity` via `onCreate`)
  - Bottom-sheet panel + scrim, `role="dialog"`, `aria-modal`, drag handle, close
    button (preserve prototype markup / Tailwind classes)
  - Fields: **name** (text, autofocus), **class picker** (list from
    `activityClasses`, single-select), **type** segmented control
    (`performance` / `recovery`), **volume unit** grid
    (`km | miles | minutes | reps | sets | sessions`)
  - State resets every time `open` flips true
  - Submit disabled until `name.trim()` non-empty **and** a class is selected
  - On submit: call `onCreate({ name, activityClassId, type, defaultVolumeUnit })`,
    fire `onCreated`, then `onClose`
- **Wiring into `LogActivityScreen`:** add an "Add new activity" / "+" affordance
  (MOCKUPS §Screen 6 Activity Manager entry) that opens the sheet. After create,
  the sheet closes and the new activity is selectable in the activity picker
  (data arrives via `['activities']` / `['dashboard']` invalidation from F2.0).
- Strict types: `SegmentedControl` reused from existing UI primitives; unit list
  typed against `VolumeUnit`.

### Reuse / extend

- `export/preview/NewActivitySheet.jsx` (reference only)
- `frontend/src/components/ui/SegmentedControl` (or existing equivalent)
- `frontend/src/components/screens/LogActivityScreen.tsx` (add trigger + sheet host)
- `engine.submitNewActivity`, `engine.activityClasses` from F2.0
- `frontend/src/components/screens/index.ts` (export new screen)

### Edge cases to handle

- `activityClasses` empty → class picker shows empty state; submit stays disabled
- Default `classId` = first class id; falls back to `''` when none
- Mismatched `defaultVolumeUnit` vs class type → allowed (free choice in prototype)
- Closing via scrim / close button / Cancel all reset and dismiss without submit
- Backend reachable but POST in flight → fire-and-forget; sheet closes immediately
  (no optimistic row required; invalidation refreshes the picker)

### Files to create / modify

- `frontend/src/components/screens/NewActivitySheet.tsx`
- `frontend/src/components/screens/NewActivitySheet.test.tsx`
- `frontend/src/components/screens/LogActivityScreen.tsx` (trigger + host)
- `frontend/src/components/screens/index.ts`

### Out of scope

- Editing / deactivating existing activities (Settings F2.3 Activity Manager)
- Recovery-rule creation for the new activity (post-MVP hint text only)

---

## F2.2 — GoalsScreen.tsx (goals list + create + archive)

**Type:** frontend
**Branch:** `feat/phase-7-frontend-completion`
**Depends on:** F2.0
**Spec:** `export/preview/GoalsScreen.jsx`, `MOCKUPS.md` §Screen 4

### Acceptance criteria

- Component tests in `frontend/src/components/screens/GoalsScreen.test.tsx`
  written **before** the component and fail first.
- `GoalsScreen.tsx` + `GoalCard` ported to strict TypeScript:
  - Props: `{ engine: MilestoneEngineResult }`
  - Groups active goals by `timeframe`: **This month** (`monthly`) and **This
    quarter** (`quarterly`); collapsible **Achieved** section (`status === 'achieved'`)
  - `GoalCard`: title, optional class chip (resolve `activityClassId` →
    `activityClasses` name), progress bar when `progressValue`/`progressTarget`
    present else "Qualitative" placeholder, due date, Edit + Archive actions
  - Header count: "N active · M achieved"
  - Empty state ("No goals yet") when no active goals
  - **Archive** action → `engine.archiveGoal(goal.id)` → row leaves active list
    on `['goals']` refetch
- **+ New Goal form** (sticky CTA opens it): fields per PRD/MOCKUPS — title
  (required), target date (required), timeframe (`monthly`/`quarterly`), optional
  activity class, optional numeric target (`progressTarget` + `progressUnit`).
  Submit → `engine.createGoal(draft)` → appears in the correct group on refetch.
  Form may be a bottom sheet (reuse NewActivitySheet shell pattern) or inline
  panel — implementer's choice; keep it accessible (`role="dialog"` if modal).
- **Status update** path covered: archiving (and, if owner confirms flag F,
  marking achieved) routes through `engine.updateGoal` / `engine.archiveGoal`
  → `PATCH /api/goals/{id}`.
- Replace `App.tsx` `activeTab === 'goals'` `ComingSoonPlaceholder` with
  `<GoalsScreen engine={engine} />`.

### Reuse / extend

- `export/preview/GoalsScreen.jsx` (reference only)
- `ProgressBar`, `Card` UI primitives
- `engine.goals`, `engine.activityClasses`, `engine.createGoal`,
  `engine.archiveGoal`, `engine.updateGoal` from F2.0
- `frontend/src/App.tsx` (replace placeholder), `screens/index.ts`

### Edge cases to handle

- No active goals → empty state, CTA still visible
- Goal with no class → no chip; `className()` returns null
- Qualitative goal (no `progressTarget`) → placeholder bar, no value text
- `targetDate` formatting in UTC (prototype uses `+'T00:00:00Z'`, `timeZone:'UTC'`)
- Achieved section collapsed by default; toggle persists for the session only
- Numeric target provided without unit (or vice versa) → validate or default unit

### Files to create / modify

- `frontend/src/components/screens/GoalsScreen.tsx`
- `frontend/src/components/screens/GoalsScreen.test.tsx`
- `frontend/src/App.tsx` (route Goals tab)
- `frontend/src/components/screens/index.ts`

### Out of scope

- Inline per-goal Edit beyond reusing the create form (flag F)
- Goal ↔ training-block linking (`relatedGoalId`)

---

## F2.3 — SettingsScreen.tsx (block summary + rules + new block)

**Type:** frontend
**Branch:** `feat/phase-7-frontend-completion`
**Depends on:** F2.0
**Spec:** `export/preview/SettingsScreen.jsx`, `MOCKUPS.md` §Screen 5 / 5b

### Acceptance criteria

- Component tests in `frontend/src/components/screens/SettingsScreen.test.tsx`
  written **before** the component and fail first.
- `SettingsScreen.tsx` + `BlockSummaryCard` + `ActivityManagerRow` +
  `PreferenceRow` ported to strict TypeScript:
  - Props: `{ engine: MilestoneEngineResult }`
  - **Active Block** card: name, start/end dates, "Active" status dot, weekly
    targets list (resolve `activityClassId` → name), enabled recovery rules list
    (use `RULE_LABEL` map for each `RuleType` → human label), Edit-rules +
    Review-block CTAs. No-block fallback card.
  - **Previous Blocks** section from `engine.previousBlocks` (View action may be a
    no-op stub in Phase 7 — block review is Phase 7.5)
  - **Activities** manager grouped by class with last-log date per activity
    (`logs` → max `loggedDate` per `activityId`); Edit / Deactivate actions
    (Deactivate → `engine.updateActivity`/`patchActivity isActive:false` — **flag:**
    F2.0 exposes `submitNewActivity` but not an activity-patch mutation; if
    Deactivate is in scope, add `updateActivity` to F2.0, else render Deactivate
    as a disabled/stub control. **Default if silent: stub the row actions**, ship
    read-only activity list; activity edit/deactivate → Phase 8 backlog.)
  - **Preferences** + **About** sections render with local-only toggles (no
    persistence, per assumption E); "Reset mock data" is a non-functional stub.
- **Edit Rules form** (MOCKUPS §Screen 5b): per-class rule editing —
  threshold inputs for `rest_between_class`, `frequency_limit`, `weekly_load_cap`,
  `consecutive_day_limit`; cross-class `weekly_activity_count`. Save →
  `engine.updateRule` / `engine.createRule` / `engine.deleteRule` →
  `['rules', blockId]` refetch; **verification:** new/edited rule reflected in the
  block summary and (per TRD) in the dashboard load summary after invalidation.
- **+ New Training Block** sheet: name + start date → `engine.createTrainingBlock`
  → appears as active/most-recent block on refetch (assumption G: rules/targets
  set afterward via Edit Rules, not bundled).
- Replace `App.tsx` `settings` `ComingSoonPlaceholder` with
  `<SettingsScreen engine={engine} />`.

### Reuse / extend

- `export/preview/SettingsScreen.jsx` (reference only)
- `Card`, `CardHeader`, `CardTitle`, `CardMeta`, `StatusDot` UI primitives
- `engine.block`, `engine.rules`, `engine.weeklyTargets`, `engine.previousBlocks`,
  `engine.activities`, `engine.activityClasses`, `engine.logs`,
  `engine.createRule`, `engine.updateRule`, `engine.deleteRule`,
  `engine.createTrainingBlock` from F2.0
- `frontend/src/App.tsx` (route Settings tab), `screens/index.ts`

### Edge cases to handle

- No active block → "No active training block" card; Edit Rules / New Block still
  reachable (New Block enabled; Edit Rules hidden or disabled)
- Rule with null `activityClassId` (cross-class) → "All classes" label
- Disabled rules (`enabled === false`) excluded from the active list
- Activity never logged → "Never" last-log label
- Weekly target referencing an unknown class → fall back to raw id (prototype does)
- Rule `RuleType` not in `RULE_LABEL` → fall back to raw `ruleType`
- Deactivate mutation gap (see flag above)

### Files to create / modify

- `frontend/src/components/screens/SettingsScreen.tsx`
- `frontend/src/components/screens/SettingsScreen.test.tsx`
- `frontend/src/App.tsx` (route Settings tab)
- `frontend/src/components/screens/index.ts`

### Out of scope

- `CalendarHeatmap` / block-review grid (Phase 7.5 — "Review block" stays a stub)
- Recovery-target editing UI (beyond what `RULE_LABEL` shows)
- Notification / unit-preference persistence (assumption E)
- Activity edit/deactivate if mutation gap deferred (flag)

---

## F2.4 — Quality gates + end-to-end verification

**Type:** frontend + verification
**Branch:** `feat/phase-7-frontend-completion`
**Depends on:** F2.1, F2.2, F2.3

### Acceptance criteria

- `npx tsc --noEmit --project frontend/tsconfig.json` passes clean (incl. new screens).
- `npx eslint frontend/src` passes clean (zero errors).
- `npm --prefix frontend run test -- --coverage` passes; coverage threshold from
  Phase 6 config holds with the new screen + hook tests included (≥ 70% on
  `frontend/src/lib/api/` and `frontend/src/hooks/`; new screen tests count
  toward overall). Adjust scoped thresholds only with justification in the commit.
- `make lint` and `make test` (root) pass — no Makefile change expected (Phase 6
  F1.4 already wired frontend gates); confirm and document if a tweak is needed.
- **End-to-end manual verification matrix** (documented in handoff, seeded backend
  + `docker compose up`):
  1. Goals tab renders real goals grouped by timeframe (no "Coming soon")
  2. Create goal via + New Goal → persists, appears on reload in correct group
  3. Archive goal → leaves active list, survives reload
  4. Settings tab renders active block, weekly targets, recovery rules (no placeholder)
  5. Edit rule via Settings → save → reflected in block summary and dashboard
     load summary after refresh
  6. Create training block → appears in Settings
  7. Open New Activity from Log Activity → create → new activity selectable in
     the picker and appears in Settings Activities list
  8. All five original screens still function unchanged

### Reuse / extend

- `Makefile`, `frontend/vitest.config.ts`, `AGENTS.md` §Quality Gates
- Phase 6 verification checklist (extend, don't duplicate)

### Edge cases to handle

- New screen files raising eslint issues not caught per-ticket → fix here
- Coverage dip from large untested screen branches → add focused tests, do not
  lower thresholds without justification
- `tsc` strictness on ported prototype patterns (implicit `any`, untyped event
  handlers) → type explicitly

### Files to create / modify

- `frontend/vitest.config.ts` (only if thresholds need rescoping)
- `Makefile` (only if a gap is found)
- Test files under `frontend/src/components/screens/` (top-ups)

### Out of scope

- Phase 7.5 / Phase 8 work
- Backend changes

---

## Out of scope (explicit)

- `CalendarHeatmap` / block-review grid — **Phase 7.5**
- `recovery_streaks` compliance UI — **Phase 8**
- Delayed-tax / load-risk dashboard panel — **Phase 8**
- Dynamic rule-driven load-graph title — **Phase 8**
- Review-milestone auto-detection — Phase 8 F3.2
- MCP context endpoint — Phase 8 B6.1
- Loading skeletons / error boundary — Phase 8 F3.1
- Notification / unit-preference persistence
- Inline edit of existing goals/activities beyond the create-form reuse (flag F)
- Auth / multi-user, log pagination, backend Pydantic alias churn
- Deleting `export/` or `engine.ts` (keep as reference)

---

## Verification (phase complete)

```bash
# From repo root after seed + compose
make lint
make test
docker compose up   # backend + frontend
# open http://localhost:5173 — exercise the F2.4 matrix
```

Expected: eight functional screens on real API data (Goals + Settings no longer
"Coming soon"); create-goal, edit-rule, create-block, and new-activity round-trips
persist across reload; the five original screens unchanged.

---

## Open questions for owner (non-blocking defaults applied)

| # | Question | Default if silent |
| --- | --- | --- |
| 1 | "Archive" goal maps to which `GoalStatus`? (`archived` is not in the enum) | **`status: 'paused'`** (reversible hide, no schema change) |
| 2 | Is inline Edit of existing goals/activities in Phase 7 scope, or create-only? | **Create + archive/status only**; full inline edit deferred |
| 3 | Activity Deactivate — add `updateActivity` patch mutation to F2.0, or stub? | **Stub the row actions**; activity edit/deactivate → Phase 8 backlog |
| 4 | Wire Settings preference toggles (notifications / units) to a backend? | **Local-only, non-functional** for Phase 7 |

---

**Status:** `NEEDS OWNER` — ticket set is implementation-ready; four non-blocking
defaults are applied (table above). Confirm or override #1 (archive status) and #3
(activity-deactivate mutation) before Test Writer starts **F2.0**, since both
affect the hook's mutation surface.
