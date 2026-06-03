# Handover

# Milestone v0.2 — Developer Handover
## Preview → Production Transition

> **Scope of this document:** Everything added in the "dead-ends elimination" pass.
> The core loop (check-in, log activity, log incident, dashboard, log history) is unchanged.
> All changes are additive — no existing screen logic was removed or restructured.

---

## 1. What changed at a glance

| Area | Change |
| --- | --- |
| `useMilestoneEngine` | 5 pieces of state made reactive; 9 new mutations added; `MilestoneEngineResult` interface extended |
| `mockData.ts` | 2 new exports: `GOALS`, `PREVIOUS_BLOCKS` |
| `GoalsScreen` | 2 new props: `onNewGoal`, `onEditGoal` |
| `SettingsScreen` | 5 new props: `onEditRules`, `onReview`, `onNewBlock`, `onViewBlock`, `onEditActivity` |
| Navigation | Lightweight push/pop stack added to root `App` (or navigator equivalent) |
| New screens (×6) | `GoalEditorScreen`, `EditBlockRulesScreen`, `BlockReviewScreen`, `NewTrainingBlockScreen`, `ActivityManagerScreen`, `InlineLogSheet` |

---

## 2. Type discrepancies to resolve first

The `Goal` type in `src/types.ts` uses different field names from what the prototype screens use internally. **Reconcile this before porting any screen.**

| `types.ts` field | Prototype screen field | Notes |
| --- | --- | --- |
| `progressValue` | `value` | Current progress toward target |
| `progressTarget` | `target` | Numeric target |
| `progressUnit` | `unit` | Unit string |
| `targetDate` | `targetDate` | ✓ same |
| `timeframe` | `timeframe` | ✓ same |
| `activityClassId` | `activityClassId` | ✓ same |
| `status` | `status` | ✓ same |

**Recommendation:** rename the prototype fields when porting (`value` → `progressValue` etc.), or add a thin adapter. Either works — just be consistent across `GoalEditorScreen`, `GoalCard`, and `submitGoal`/`editGoal`.

Also note: `TrainingBlock` has a required `isReviewMilestoneHit: boolean` field. The `submitNewBlock` mutation must include it (default `false`).

---

## 3. `src/lib/mockData.ts` — add two exports

Add to the bottom of the file (after `INCIDENTS`):

```ts
import type { Goal, TrainingBlock } from '../types';

export const GOALS: Goal[] = [
  {
    id: 'goal-1', userId: USER_ID, status: 'active', timeframe: 'monthly',
    title: 'Walk 20 km without flare-up',
    targetDate: '2026-05-31', activityClassId: 'cls-foot',
    progressValue: 12, progressTarget: 20, progressUnit: 'km',
    createdAt: '2026-04-07T06:00:00Z',
  },
  {
    id: 'goal-2', userId: USER_ID, status: 'active', timeframe: 'monthly',
    title: 'Complete 12 recovery sessions',
    targetDate: '2026-05-31', activityClassId: 'cls-recovery',
    progressValue: 8, progressTarget: 12, progressUnit: 'sessions',
    createdAt: '2026-04-07T06:00:00Z',
  },
  {
    id: 'goal-3', userId: USER_ID, status: 'active', timeframe: 'quarterly',
    title: 'Reduce recovery window from 3 → 2 days for foot load',
    targetDate: '2026-06-30', activityClassId: 'cls-foot',
    createdAt: '2026-04-07T06:00:00Z',
  },
  {
    id: 'goal-4', userId: USER_ID, status: 'active', timeframe: 'quarterly',
    title: 'Four consecutive weeks without a flare-up',
    targetDate: '2026-06-30',
    progressValue: 2, progressTarget: 4, progressUnit: 'sessions',
    createdAt: '2026-04-07T06:00:00Z',
  },
];

export const PREVIOUS_BLOCKS: TrainingBlock[] = [
  {
    id: 'blk-0', userId: USER_ID,
    name: 'Return to Walking — Phase 1',
    startDate: '2026-02-24', endDate: '2026-04-06',
    status: 'completed', isReviewMilestoneHit: true,
    createdAt: '2026-02-24T06:00:00Z',
  },
];
```

---

## 4. `src/hooks/useMilestoneEngine.ts` — full diff

### 4a. New imports

```ts
import {
  TODAY, PERIOD_START, USER_ID, USER_NAME,
  BLOCK, ACTIVITY_CLASSES, ACTIVITIES, LOGS, RULES,
  WEEKLY_TARGETS, CHECK_INS, INCIDENTS,
  GOALS,          // ← new
  PREVIOUS_BLOCKS // ← new
} from '../lib/mockData';
```

Add `Goal`, `TrainingBlock` to the types import:
```ts
import type {
  ActivityLog, DailyCheckIn, FlareUpIncident, Activity, Rule,
  TrainingBlock, Goal,
  ActivityClassStatus, DailySafetyScore,
  Score0to10, RPE, PostActivityFeel, VolumeUnit, ISODate, ID,
  RuleViolationSnapshot, GoalTimeframe, GoalStatus,
} from '../types';
```

### 4b. New mutation draft interfaces

Add below the existing draft interfaces:

```ts
export interface NewActivityDraft {
  name: string;
  activityClassId: ID;
  type: 'performance' | 'recovery';
  defaultVolumeUnit?: VolumeUnit;
}

export interface GoalDraft {
  title: string;
  timeframe: GoalTimeframe;
  targetDate?: ISODate | null;
  activityClassId?: ID | null;
  progressValue?: number | null;
  progressTarget?: number | null;
  progressUnit?: VolumeUnit | null;
}

export interface NewBlockDraft {
  name: string;
  startDate: ISODate;
  endDate?: ISODate | null;
}
```

### 4c. Extended `MilestoneEngineResult`

Add these to the interface (alongside the existing fields):

```ts
// Newly reactive state
rules: Rule[];
goals: Goal[];
activities: Activity[];         // was already there but now reactive
block: TrainingBlock;           // was static, now reactive
previousBlocks: TrainingBlock[];
weeklyTargets: typeof WEEKLY_TARGETS; // still static in mock, exposed for SettingsScreen

// New mutations
submitNewActivity:   (draft: NewActivityDraft) => Activity;
editActivity:        (activityId: ID, updates: Partial<Activity>) => void;
deactivateActivity:  (activityId: ID) => void;
submitGoal:          (draft: GoalDraft) => void;
editGoal:            (goalId: ID, updates: Partial<GoalDraft>) => void;
archiveGoal:         (goalId: ID) => void;
editRule:            (ruleId: ID, updates: Partial<Pick<Rule, 'thresholdValue' | 'enabled'>>) => void;
submitNewBlock:      (draft: NewBlockDraft) => void;
resetMockData:       () => void;
```

### 4d. State declarations — replace static refs with `useState`

In the hook body, replace the three static assignments with reactive state:

```ts
// BEFORE (static):
// activities used directly from import
// rules used directly from import
// block used directly from import

// AFTER (reactive):
const [activities,     setActivities]     = React.useState<Activity[]>(() => [...ACTIVITIES]);
const [rules,          setRules]          = React.useState<Rule[]>(() => [...RULES]);
const [block,          setBlock]          = React.useState<TrainingBlock>(() => ({ ...BLOCK }));
const [previousBlocks, setPreviousBlocks] = React.useState<TrainingBlock[]>(() => [...PREVIOUS_BLOCKS]);
const [goals,          setGoals]          = React.useState<Goal[]>(() => [...GOALS]);
```

> `logs`, `checkIns`, `incidents` are already reactive — leave them unchanged.

### 4e. Update derived memos to use reactive state

The three memos that referenced static `ACTIVITIES` / `RULES` / `BLOCK` must switch to the reactive variables and add them to their deps arrays:

```ts
const classStatuses = React.useMemo(
  () => computeClassStatuses(TODAY, ACTIVITY_CLASSES, activities, logs, rules),
  [activities, logs, rules], // added `activities` and `rules`
);

const suggestions = React.useMemo(
  () => computeSuggestions(classStatuses, activities, ACTIVITY_CLASSES),
  [classStatuses, activities], // added `activities`
);

const weeklyProgress = React.useMemo(
  () => computeWeeklyProgress(WEEKLY_TARGETS, ACTIVITY_CLASSES, activities, logs, PERIOD_START, TODAY),
  [activities, logs], // added `activities`
);

const dailyScores = React.useMemo(
  () => computeDailySafetyScores(block.startDate, TODAY, logs, checkIns, incidents),
  [block, logs, checkIns, incidents], // added `block`
);

const loadSeries = React.useMemo(
  () => computeLoadSeries('cls-foot', activities, logs, block.startDate, TODAY),
  [block, activities, logs], // added `block` and `activities`
);

// weekLoadThreshold: read from reactive rules instead of static RULES
const weekLoadThreshold =
  rules.find(r => r.activityClassId === 'cls-foot' && r.ruleType === 'weekly_load_cap')
    ?.thresholdValue ?? 120;
```

### 4f. Update `checkViolations` to use reactive state

Replace the two lines that reference static `ACTIVITIES` / `RULES` with the reactive variables, and add `rules` to the `useCallback` dep array:

```ts
const checkViolations = React.useCallback((
  activityId: ID, volumeValue: number, rpe: number,
): RuleViolationSnapshot[] => {
  const activity = activities.find(a => a.id === activityId); // was ACTIVITIES.find
  if (!activity) return [];
  const clsIds = activities                                    // was ACTIVITIES.filter
    .filter(a => a.activityClassId === activity.activityClassId)
    .map(a => a.id);
  const result: RuleViolationSnapshot[] = [];

  const restRule = rules.find(                                 // was RULES.find
    r => r.activityClassId === activity.activityClassId
      && r.ruleType === 'rest_between_class' && r.enabled,
  );
  // ... rest of body unchanged ...
  const capRule = rules.find(                                  // was RULES.find
    r => r.activityClassId === activity.activityClassId
      && r.ruleType === 'weekly_load_cap' && r.enabled,
  );
  // ...
  return result;
}, [logs, activities, rules]); // added `activities` and `rules`
```

### 4g. New mutations — add before the `return` statement

```ts
const submitNewActivity = React.useCallback((draft: NewActivityDraft): Activity => {
  const newAct: Activity = {
    id: `act-${Date.now()}`, userId: USER_ID,
    activityClassId: draft.activityClassId,
    name: draft.name, type: draft.type,
    defaultVolumeUnit: draft.defaultVolumeUnit,
    isActive: true, createdAt: new Date().toISOString(),
  };
  setActivities(prev => [...prev, newAct]);
  return newAct;
}, []);

const editActivity = React.useCallback((activityId: ID, updates: Partial<Activity>) => {
  setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
}, []);

const deactivateActivity = React.useCallback((activityId: ID) => {
  setActivities(prev => prev.map(a => a.id === activityId ? { ...a, isActive: false } : a));
}, []);

const archiveGoal = React.useCallback((goalId: ID) => {
  setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: 'achieved' as GoalStatus } : g));
}, []);

const submitGoal = React.useCallback((draft: GoalDraft) => {
  setGoals(prev => [...prev, {
    id: `goal-${Date.now()}`, userId: USER_ID, status: 'active' as GoalStatus,
    title: draft.title, timeframe: draft.timeframe,
    targetDate: draft.targetDate ?? TODAY,
    activityClassId: draft.activityClassId ?? undefined,
    progressValue: draft.progressValue ?? undefined,
    progressTarget: draft.progressTarget ?? undefined,
    progressUnit: draft.progressUnit ?? undefined,
    createdAt: new Date().toISOString(),
  }]);
}, []);

const editGoal = React.useCallback((goalId: ID, updates: Partial<GoalDraft>) => {
  setGoals(prev => prev.map(g => g.id === goalId ? {
    ...g,
    title:           updates.title           ?? g.title,
    timeframe:       updates.timeframe        ?? g.timeframe,
    targetDate:      updates.targetDate       ?? g.targetDate,
    activityClassId: updates.activityClassId  ?? g.activityClassId,
    progressValue:   updates.progressValue    ?? g.progressValue,
    progressTarget:  updates.progressTarget   ?? g.progressTarget,
    progressUnit:    updates.progressUnit     ?? g.progressUnit,
  } : g));
}, []);

const editRule = React.useCallback((
  ruleId: ID,
  updates: Partial<Pick<Rule, 'thresholdValue' | 'enabled'>>,
) => {
  setRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));
}, []);

const submitNewBlock = React.useCallback((draft: NewBlockDraft) => {
  setPreviousBlocks(prev => [...prev, { ...block, status: 'completed' as const }]);
  setBlock({
    id: `blk-${Date.now()}`, userId: USER_ID,
    name: draft.name, startDate: draft.startDate,
    endDate: draft.endDate ?? undefined,
    status: 'active', isReviewMilestoneHit: false,
    createdAt: new Date().toISOString(),
  });
}, [block]);

const resetMockData = React.useCallback(() => {
  setLogs([...LOGS]);
  setCheckIns([...CHECK_INS]);
  setIncidents([...INCIDENTS]);
  setActivities([...ACTIVITIES]);
  setGoals([...GOALS]);
  setRules([...RULES]);
  setBlock({ ...BLOCK });
  setPreviousBlocks([...PREVIOUS_BLOCKS]);
}, []);
```

### 4h. Update the `return` statement

Add all new state and mutations to the returned object:

```ts
return {
  // existing unchanged fields...
  todayDate: TODAY, userName: USER_NAME,
  block,               // was: block: BLOCK
  activityClasses: ACTIVITY_CLASSES,
  activities,          // was: activities: ACTIVITIES
  rules,               // ← new (was static)
  weeklyTargets: WEEKLY_TARGETS,
  previousBlocks,      // ← new
  logs, incidents, goals, // goals ← new
  hasCheckedInToday, classStatuses, suggestions, weeklyProgress,
  dailyScores, loadSeries, flareUpDates, weekLoadThreshold, cleanStreak,
  // existing mutations...
  submitCheckIn, submitLog, submitIncident,
  // new mutations:
  submitNewActivity, editActivity, deactivateActivity,
  submitGoal, editGoal, archiveGoal,
  editRule, submitNewBlock, resetMockData,
  checkViolations,
};
```

---

## 5. Navigation architecture

The prototype uses a lightweight push/pop stack layered on top of the existing overlay pattern. In your production app the right approach depends on your navigator:

### Option A — React Navigation (recommended if you're already using it)
Create a nested stack navigator for the editor screens:

```
RootNavigator
  BottomTabs
    Dashboard
    Log
    Goals (stack)
      GoalsScreen
      GoalEditorScreen        ← pushed by "+ New Goal" / "Edit"
    Settings (stack)
      SettingsScreen
      EditBlockRulesScreen    ← pushed by "Edit rules"
      BlockReviewScreen       ← pushed by "Review block" / "View"
      NewTrainingBlockScreen  ← pushed by "+ New Training Block"
      ActivityManagerScreen   ← pushed by activity "Edit"
  Overlays (modal stack)
    CheckInScreen
    LogActivityScreen / InlineLogSheet
    LogIncidentScreen
```

Pass navigation callbacks as props from the screen to the engine-aware parent, or use `useNavigation()` directly inside the screens.

### Option B — Extend the overlay pattern (simpler, if you have no router yet)
Exactly what the prototype does. In your root `App`:

```ts
// Navigation stack state
const [screenStack, setScreenStack] = useState<Array<{ screen: string; params: Record<string, unknown> }>>([]);
const pushScreen = (screen: string, params = {}) =>
  setScreenStack(s => [...s, { screen, params }]);
const popScreen = () => setScreenStack(s => s.slice(0, -1));
const topScreen = screenStack[screenStack.length - 1] ?? null;
```

Render the top screen as a fixed full-viewport overlay (`position: absolute` / `StyleSheet.absoluteFill` in RN) that sits above the tab bar.

---

## 6. New screens — porting guide

All six screens live in `preview/` and are self-contained. Port them to your component structure. Key notes per screen:

### `GoalEditorScreen`
- Props: `goal?: Goal | null`, `engine`, `onBack`, `onComplete`
- **Field name mapping:** the form state uses `value`/`target`/`unit` internally but must call `submitGoal`/`editGoal` with `progressValue`/`progressTarget`/`progressUnit`
- On save: calls `engine.submitGoal(draft)` (new) or `engine.editGoal(goal.id, draft)` (edit), then `onComplete()`

### `EditBlockRulesScreen`
- Props: `engine`, `onBack`
- Reads `engine.rules` (now reactive); each row calls `engine.editRule(ruleId, { thresholdValue })` or `engine.editRule(ruleId, { enabled })`
- No save button needed — changes are live immediately

### `BlockReviewScreen`
- Props: `engine`, `onBack`, `blockId?: string`
- If `blockId` is undefined → shows the active block with charts
- If `blockId` matches a `previousBlocks` entry → shows summary only (charts not available for past blocks)
- Reuses `CalendarHeatmap` and `WeeklyLoadGraph` from your composites layer

### `NewTrainingBlockScreen`
- Props: `engine`, `onBack`, `onComplete`
- Calls `engine.submitNewBlock({ name, startDate, endDate })` — this archives the current block automatically

### `ActivityManagerScreen`
- Props: `activity: Activity`, `engine`, `onBack`, `onComplete`
- Calls `engine.editActivity(id, updates)` on save
- Calls `engine.deactivateActivity(id)` on confirm — no separate mutation, handled inline
- Reuses the same form layout as `NewActivitySheet`

### `InlineLogSheet`
- Props: `open: boolean`, `onClose`, `activity: Activity | null`, `engine`
- A bottom sheet (modal) — not a full screen; render it as a `Modal` or sheet overlay
- Calls `engine.checkViolations()` live and shows `RuleViolationBanner` on violations
- Calls `engine.submitLog(draft)` on confirm
- Used from Dashboard "Log" buttons (safe/caution suggestions only); the full `LogActivityScreen` is still used from the Log tab

---

## 7. Updated screen prop signatures

### `GoalsScreen`
```ts
// Add two new optional props:
interface GoalsScreenProps {
  engine: MilestoneEngineResult;
  onNewGoal?: () => void;   // ← new
  onEditGoal?: (goal: Goal) => void; // ← new
}
```
Wire in the component:
- `+ New Goal` button → `onNewGoal?.()`
- Each goal's `Edit` button → `onEditGoal?.(goal)`
- `Archive` still calls `engine.archiveGoal(goal.id)` directly (unchanged)

Note: `GoalCard` internally reads `goal.value`/`goal.target`/`goal.unit` — these must be updated to `goal.progressValue`/`goal.progressTarget`/`goal.progressUnit` to match the real `Goal` type.

### `SettingsScreen`
```ts
interface SettingsScreenProps {
  engine: MilestoneEngineResult;
  onEditRules?:     () => void;           // ← new — "Edit rules" button
  onReview?:        () => void;           // ← new — "Review block" button
  onNewBlock?:      () => void;           // ← new — "+ New Training Block"
  onViewBlock?:     (blockId: ID) => void; // ← new — previous block "View"
  onEditActivity?:  (activity: Activity) => void; // ← new — activity "Edit"
}
```
Additional inline wiring (no new prop needed):
- Activity "Deactivate" → `engine.deactivateActivity(activity.id)` (called directly)
- "Reset mock data" → `engine.resetMockData()` with a two-step confirm

---

## 8. `BlockSummaryCard` — pass through new props

`BlockSummaryCard` already accepts `onEditRules` and `onReview`. In `SettingsScreen` these are currently `() => {}`. Replace with the forwarded props:

```ts
// Before:
onEditRules={() => {}}
onReview={() => {}}

// After:
onEditRules={onEditRules}
onReview={onReview}
```

---

## 9. Smooth transition checklist

Before switching your production codebase to this state:

- [ ] **Decide Goal field naming** — adopt `progressValue/Target/Unit` throughout (matches `types.ts`) or alias in screens
- [ ] **Add `GOALS` + `PREVIOUS_BLOCKS` to `mockData.ts`** (step 3 above)
- [ ] **Update `useMilestoneEngine`** state + mutations + return type (step 4)
- [ ] **Choose navigation pattern** (step 5) and create the stack/navigator structure
- [ ] **Port 6 new screens** (step 6), updating field names for Goal as you go
- [ ] **Add new props to `GoalsScreen` + `SettingsScreen`** and wire them up (step 7–8)
- [ ] **Port `InlineLogSheet`** — if using React Native, replace the HTML bottom-sheet with a `Modal` or your sheet library (e.g. `@gorhom/bottom-sheet`)
- [ ] **Smoke test the engine** — after making rules reactive, verify that toggling a rule in `EditBlockRulesScreen` changes the dashboard traffic lights in the same session
- [ ] **TypeScript check** — run `tsc --noEmit` after changes; the new mutations and reactive state will surface any missed type updates in existing screens

---

## 10. What was intentionally NOT changed

To keep scope tight, these remain as-is:

- `WEEKLY_TARGETS` and `ACTIVITY_CLASSES` are still static (editing them requires a more complex UI not in scope)
- `TODAY` is still a hardcoded constant — real app will use `new Date()` or a date service
- No persistence layer — all state is still in-memory `useState`; the real app swaps this for expo-sqlite / your DB without changing screen code
- Notification and metric-unit toggles in Settings flip visually but don't drive anything (prototype-only)
- Primitive component extraction (Button, TextField, etc.) was deliberately skipped — inlined styles work fine
