# Technical Design — v0.2 Screen Completion
**Date:** 2026-06-02
**Status:** APPROVED — API contracts, rule-copy behaviour, and goal field naming signed off. Split into Phase 8 (Goals flow) and Phase 9 (Settings flow + InlineLogSheet).
**Feature brief:** `plans/feature-brief-v02-screen-completion-2026-06-02.md`
**Prototype source:** `export-2/` — full diff in `export-2/handover.md`

---

## Architecture Boundary Check

| Boundary | Verdict |
|---|---|
| No business logic in routers | ✓ — rule copy lives in block creation service |
| No schema changes without Alembic | ✓ — no new columns or tables; existing schema is sufficient |
| No `any` in TypeScript | ✓ — all new types are defined in `types.ts` and `useMilestoneEngine.ts` |
| Server data not duplicated in local state | ✓ — `useMilestoneEngine` reactive state is the single client-side owner |
| No new cross-cutting abstractions | ✓ — overlay push/pop extends the existing navigation pattern |

---

## 1. Database — No Schema Changes

The existing schema already covers all required fields:
- `goals` — `progress_value`, `progress_target`, `progress_unit`, `status`, `timeframe`, `target_date` all present
- `training_blocks` — `is_review_milestone_hit` present; `status` covers active/completed lifecycle
- `rules` — scoped to `training_block_id`; copying rows to a new block is a service operation

**Rule copy behaviour (service only):** When `POST /api/training-blocks` is called, the block creation service queries the current active block's rules and inserts copies under the new block's ID before marking the old block `completed`. No schema change needed.

---

## 2. API Changes

### 2a. `GET /api/dashboard` — extend payload

Add two top-level fields to the existing response:

```
goals:           Goal[]          // all active goals; status filter = 'active' by default
previous_blocks: TrainingBlock[] // completed/archived blocks, ordered by end_date desc
```

`previous_blocks` contains summary-only data (id, name, start_date, end_date, status, is_review_milestone_hit). No logs or scores — those are fetched on demand via the review endpoint.

The existing fields are unchanged.

### 2b. New endpoint: `GET /api/training-blocks/{block_id}/review`

Purpose: serve per-block review data for `BlockReviewScreen`, including historical blocks where the active dashboard data would be wrong.

Response shape:

```
block:        TrainingBlock         // block metadata
daily_scores: DailySafetyScore[]    // one per calendar day in block date range
load_series:  LoadSeriesPoint[]     // rolling load per class, scoped to block dates
flare_up_dates: ISODate[]           // flare-up incident dates within block
```

Query scoped to `block.start_date` … `block.end_date` (or today if block is still active).

Returns 404 if `block_id` does not exist for the local user.

### 2c. `POST /api/training-blocks` — rule copy behaviour

No change to the request body or response shape. The creation service adds a new step:

1. Find the current active block (if any).
2. Copy its rules to the new block (same `rule_type`, `threshold_value`, `window_days`, `enabled`, `activity_class_id`).
3. Mark the old block `status = 'completed'`, set `end_date = today` if not already set.
4. Insert and return the new block.

If there is no current active block, the new block is created with no rules (empty ruleset).

---

## 3. Frontend — Hook (`useMilestoneEngine`)

### 3a. New reactive state (replace static refs)

```ts
const [activities,     setActivities]     = useState<Activity[]>()
const [rules,          setRules]          = useState<Rule[]>()
const [block,          setBlock]          = useState<TrainingBlock>()
const [previousBlocks, setPreviousBlocks] = useState<TrainingBlock[]>()
const [goals,          setGoals]          = useState<Goal[]>()
```

`logs`, `checkIns`, `incidents` are already reactive — unchanged.

All memos that reference `activities`, `rules`, or `block` must add those to their deps arrays (see `export-2/handover.md` §4e).

### 3b. New mutations

| Mutation | Calls API |
|---|---|
| `submitNewActivity(draft)` | `POST /api/activities` |
| `editActivity(id, updates)` | `PATCH /api/activities/{id}` |
| `deactivateActivity(id)` | `PATCH /api/activities/{id}` (`is_active: false`) |
| `submitGoal(draft)` | `POST /api/goals` |
| `editGoal(id, updates)` | `PATCH /api/goals/{id}` |
| `archiveGoal(id)` | `PATCH /api/goals/{id}` (`status: 'achieved'`) |
| `editRule(id, updates)` | `PATCH /api/rules/{id}` |
| `submitNewBlock(draft)` | `POST /api/training-blocks` |
| `resetMockData()` | no API call — dev tool only |

### 3c. New draft interfaces (add to `useMilestoneEngine.ts`)

```ts
export interface NewActivityDraft { name, activityClassId, type, defaultVolumeUnit? }
export interface GoalDraft { title, timeframe, targetDate?, activityClassId?, progressValue?, progressTarget?, progressUnit? }
export interface NewBlockDraft { name, startDate, endDate? }
```

### 3d. Extended `MilestoneEngineResult`

Add to return object: `rules`, `goals`, `previousBlocks`, `weeklyTargets`, all 9 mutations above, and `resetMockData`.

---

## 4. Frontend — Navigation

Pattern: **overlay push/pop stack** (Option B from `export-2/handover.md` §5). Extends the existing overlay pattern; no new dependency.

```ts
// Root App state
const [screenStack, setScreenStack] = useState<{ screen: string; params: Record<string, unknown> }[]>([])
const pushScreen = (screen, params = {}) => setScreenStack(s => [...s, { screen, params }])
const popScreen  = () => setScreenStack(s => s.slice(0, -1))
```

Top screen renders as `position: fixed` (web) or `StyleSheet.absoluteFill` (RN) above the tab bar.

### Screen stack map

```
BottomTabs
  Dashboard         (no stack — no new push targets from Dashboard)
  Log               (no stack — existing overlays unchanged)
  Goals stack
    GoalsScreen       → push GoalEditorScreen (new goal)
                      → push GoalEditorScreen (edit goal, passes goal param)
  Settings stack
    SettingsScreen    → push EditBlockRulesScreen
                      → push BlockReviewScreen (active block, no blockId param)
                      → push BlockReviewScreen (previous block, blockId param)
                      → push NewTrainingBlockScreen
                      → push ActivityManagerScreen (activity param)
Overlays / modals (existing)
  MorningCheckInScreen
  LogActivityScreen
  LogIncidentScreen
  InlineLogSheet      ← bottom sheet, not a full-screen push; rendered as Modal overlay
```

---

## 5. Frontend — Screen Prop Signatures

### `GoalsScreen`
```ts
interface GoalsScreenProps {
  engine: MilestoneEngineResult
  onNewGoal?:  () => void
  onEditGoal?: (goal: Goal) => void
}
```

### `SettingsScreen`
```ts
interface SettingsScreenProps {
  engine: MilestoneEngineResult
  onEditRules?:    () => void
  onReview?:       () => void
  onNewBlock?:     () => void
  onViewBlock?:    (blockId: ID) => void
  onEditActivity?: (activity: Activity) => void
}
```

`BlockSummaryCard` already accepts `onEditRules` and `onReview` — update SettingsScreen to forward props rather than passing `() => {}`.

---

## 6. Frontend — Component Boundaries

| Screen | Classification | Justification |
|---|---|---|
| `GoalEditorScreen` | Full screen (stack) | Owns a multi-field form with its own save flow |
| `EditBlockRulesScreen` | Full screen (stack) | Rule changes are live — owns the rule list and its mutations |
| `BlockReviewScreen` | Full screen (stack) | Reuses `CalendarHeatmap` + `WeeklyLoadGraph` composites; owns the review data fetch |
| `NewTrainingBlockScreen` | Full screen (stack) | Owns the block creation form and archive confirmation step |
| `ActivityManagerScreen` | Full screen (stack) | Owns the activity edit form and deactivate confirmation |
| `InlineLogSheet` | Modal overlay (not a stack push) | Compact quick-log; no navigation state; dismissed without leaving a history entry |

All six are new files. No existing screen is absorbed or replaced.

---

## 7. Goal Field Naming — Resolved

Use `progressValue`, `progressTarget`, `progressUnit` throughout (matches `types.ts` and the DB snake_case equivalents). When porting `GoalCard` and `GoalEditorScreen`, update the internal form state variable names from the prototype's `value/target/unit` to match. Do not introduce an adapter layer.

---

## 8. What Is Not Changing

- `WEEKLY_TARGETS` and `ACTIVITY_CLASSES` remain static in the engine (no edit UI).
- The "Block safety map" on the Dashboard is unchanged (existing component, no new navigation target).
- `LogActivityScreen` (full log flow from the Log tab) is unchanged; `InlineLogSheet` is additive.
- Notification and metric-unit toggles in Settings remain prototype-only (no backend).

---

## Phase Allocation

| Area | Phase 8 (Goals flow) | Phase 9 (Settings flow + InlineLogSheet) |
|---|---|---|
| Backend: dashboard `goals` field | ✓ | |
| Backend: dashboard `previous_blocks` field | | ✓ |
| Backend: `GET /api/training-blocks/{block_id}/review` | | ✓ |
| Backend: `POST /api/training-blocks` rule-copy service | | ✓ |
| Hook: `goals` reactive + `submitGoal/editGoal/archiveGoal` | ✓ | |
| Hook: `rules/activities/block/previousBlocks` reactive + 6 mutations | | ✓ |
| Navigation: push/pop stack scaffolded | ✓ | |
| Navigation: Settings stack | | ✓ |
| `GoalsScreen` new props | ✓ | |
| `SettingsScreen` new props + BlockSummaryCard wiring | | ✓ |
| `GoalEditorScreen` | ✓ | |
| `EditBlockRulesScreen` | | ✓ |
| `BlockReviewScreen` | | ✓ |
| `NewTrainingBlockScreen` | | ✓ |
| `ActivityManagerScreen` | | ✓ |
| `InlineLogSheet` | | ✓ |

## Status: APPROVED

All owner decisions resolved:
- [x] API contract additions approved
- [x] Rule-copy-on-block-create service behaviour approved
- [x] Goal field naming convention (`progressValue/progressTarget/progressUnit`) confirmed
