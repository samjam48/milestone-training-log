# UX Overhaul — Ticket Plan

**Date:** 2026-06-12
**Branch:** `feat/ux-overhaul-2026-06`
**Status:** Planning
**Sources:** `plans/ux-assessment-2026-06-12.md` (AI), `plans/user-ux-assessment-12-06-2026.md` (owner)

---

## Locked Decisions

| # | Decision |
|---|----------|
| 1 | Dashboard gets 3 sub-tabs: **Today / Metrics / Safety** |
| 2 | No FAB — Log tab remains the primary log entry point |
| 3 | Clean streak UI **removed** from Dashboard; streaks feature tracked in backlog |
| 4 | Incidents surfaced in **Log History** with distinct visual; post-incident screen cleaned up |
| 5 | "All Classes" rule: **investigate before fixing** (may be data bug or display bug) |
| 6 | Delete pattern: **bin icon everywhere** (logs, goals, activity classes, exercises, rules) — no text "Delete" |
| 7 | Single feature branch; tickets commit sequentially — quick wins first, then structural |

---

## Group A — Quick Wins

These are pure UI / copy / display tweaks. No architecture changes. Each is a standalone commit.

---

### UX-A1: Check-in completion badge

**Problem:** `{!hasCheckedInToday && <CheckInCTA />}` — CTA disappears after check-in, leaving no evidence it happened.

**Fix:** Replace the conditional render with a `CheckInStatus` component that switches between CTA and a completion badge.

```tsx
// DashboardScreen.tsx — replace line 162 conditional
const CheckInStatus: React.FC<{ hasCheckedIn: boolean; onPress: () => void }> = ({
  hasCheckedIn, onPress,
}) => {
  if (hasCheckedIn) {
    return (
      <Card intent="success" pad="md">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-safe/20">
            {/* checkmark svg */}
          </span>
          <div>
            <p className="text-body font-semibold text-safe-fg">Check-in complete</p>
            <p className="text-caption text-ink-muted">Logged today</p>
          </div>
        </div>
      </Card>
    );
  }
  return <CheckInCTA onPress={onPress} />;
};
```

**File:** `frontend/src/components/screens/DashboardScreen.tsx:162`

**Acceptance criteria:**
- When `hasCheckedInToday = true`, a green success card is visible (not nothing)
- When `hasCheckedInToday = false`, the existing CTA renders unchanged
- No duplicate check-in attempt is needed to confirm state

---

### UX-A2: Load risk — timeframe prefix in labels

**Problem:** Load risk rows show `"0 / 3 km"` — unclear if daily or weekly.

**Fix:** Update `formatActualLimit` in `LoadRiskSection.tsx` to accept a `period` label and prefix it.

`LoadRiskRuleLimitRow` already has a `period` or equivalent field — check; if not, add `period: 'daily' | 'weekly'` to the interface and populate from engine.

```tsx
// Before: "0 / 3 km"
// After:  "Daily: 0 / 3 km"  or  "Weekly: 5 / 20 km"
function formatActualLimit(actual: number, limit: number, unit: string, period?: string): string {
  const prefix = period ? `${period.charAt(0).toUpperCase() + period.slice(1)}: ` : '';
  // ...
  return `${prefix}${roundedActual} / ${roundedLimit} ${unit}`;
}
```

**File:** `frontend/src/components/composites/LoadRiskSection.tsx`

**Acceptance criteria:**
- Daily rules show `"Daily: X / Y unit"`
- Weekly rules show `"Weekly: X / Y unit"`
- Existing progress bar layout unchanged

---

### UX-A3: Activity status — fix "Done Today" redundant meta

**Problem:** Items under the "Done today" section show `"Last done 0 days ago"` — redundant.

**Fix:** In the Activity Status render loop in `DashboardScreen.tsx`, detect when `cs.reason` contains "0 days" (or when the last-done date == today) and substitute a more useful string: either the weekly unit count or suppress the meta entirely.

Rule: if the class was done today, show `"X sessions this week"` (derive from `weeklyProgress`) or omit the meta text.

**File:** `frontend/src/components/screens/DashboardScreen.tsx:231–244`

**Acceptance criteria:**
- No `"Last done 0 days ago"` text visible in Activity Status
- Done-today items show a useful secondary label or no secondary label

---

### UX-A4: Remove Clean Streak from Dashboard + backlog entry

**Problem:** Clean streak logic may not be tracking rule violations correctly; section doesn't add clear value in its current form.

**Fix:**
1. Remove the `/* Clean streak */` section from `DashboardScreen.tsx` (lines 246–252)
2. Remove `cleanStreak` from the destructured engine fields in `DashboardScreen.tsx:145`
3. Add a backlog item in `BACKLOG.md` under a new "Future UX" section: "True streak counter — derive consecutive-week (or session) streaks from weekly target history; replace the retired `cleanStreak` UI with a well-designed streaks section once the product model is clear."

**Files:** `frontend/src/components/screens/DashboardScreen.tsx`, `plans/BACKLOG.md`

**Acceptance criteria:**
- Dashboard renders without the Clean Streak card
- `cleanStreak` field is still returned by the engine (no backend change needed) — it's just not rendered
- Backlog entry is written

---

### UX-A5: Delete → bin icon pattern everywhere

**Problem:** Text buttons saying "Delete" are inconsistent and take up too much space. Owner wants a faded red bin icon at the right of every list row that has a delete action.

**Shared component:** Add a `DeleteButton` (or `TrashIconButton`) in `frontend/src/components/ui/`:

```tsx
// frontend/src/components/ui/DeleteButton.tsx
export const DeleteButton: React.FC<{ onClick: () => void; label?: string }> = ({
  onClick, label = 'Delete',
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="flex h-8 w-8 items-center justify-center rounded text-danger-fg/50 hover:text-danger-fg hover:bg-danger/10 transition-colors duration-snap"
  >
    {/* trash SVG — 16×16 */}
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
);
```

**Apply to:**
- `LogHistoryScreen.tsx` — `LogRow` delete button (currently text "Delete" at line ~76)
- `GoalsScreen.tsx` — goal row delete action (if present)
- `ActivityManagerScreen.tsx` — exercise/activity row delete
- `EditBlockRulesScreen.tsx` — rule row delete
- Any other list row with a text "Delete" action (audit all)

**Files:** New `frontend/src/components/ui/DeleteButton.tsx`, all screen files listed above

**Acceptance criteria:**
- No screen has a text-only "Delete" button in a list row
- All delete actions show the bin icon (faded red, full-colour on hover)
- All actions still trigger confirmation where they currently do

---

### UX-A6: Log Activity — skip volume field when unit is "minutes"

**Problem:** Activities with `defaultVolumeUnit = 'min'` (or `'minutes'`) show both a Duration field (minutes) and a Volume field (also minutes), which is redundant and confusing.

**Fix:** In `LogActivityScreen.tsx:322`, add a guard:

```tsx
// Before:
{selAct?.defaultVolumeUnit && (
  <div>
    <p>Volume</p>
    <NumberField value={volume} onChange={setVolume} unit={selAct.defaultVolumeUnit} />
  </div>
)}

// After:
{selAct?.defaultVolumeUnit && selAct.defaultVolumeUnit !== 'min' && selAct.defaultVolumeUnit !== 'minutes' && (
  <div>
    <p>Volume</p>
    <NumberField value={volume} onChange={setVolume} unit={selAct.defaultVolumeUnit} />
  </div>
)}
```

Also ensure `volumeValue` is not included in the log draft when the guard suppresses the field (set to 0 / undefined).

**File:** `frontend/src/components/screens/LogActivityScreen.tsx:322`

**Acceptance criteria:**
- Activities with minute-based volume units show no Volume input in the log form
- Submitted log for such activities has `volumeValue = 0` or is omitted
- Activities with other units (km, sessions, hours) are unaffected

---

### UX-A7: Improved empty state cards

**Problem:** "No weekly targets configured." is a dead-end message. Users don't know what to do.

**Fix:** Replace empty-state strings with actionable cards that include context + a CTA link to the relevant screen.

**Locations:**
1. `DashboardScreen.tsx:189` — weekly targets empty → card: "No weekly targets set yet. Head to Goals to create your first target." + "→ Go to Goals" button (calls `onOpenLogActivity` or a new `onViewGoals` prop)
2. `LogHistoryScreen.tsx` — the existing empty state is already reasonable (illustration + text), but add a CTA: "→ Log your first session" button calling `onOpenLogActivity`
3. `DashboardScreen.tsx` Activity Status — if `classStatuses.length === 0`, show: "No activity classes configured. Go to Settings to set up your training blocks."

**Files:** `frontend/src/components/screens/DashboardScreen.tsx`, `frontend/src/components/screens/LogHistoryScreen.tsx`

**Props note:** `DashboardScreen` may need a new `onViewGoals?: () => void` and `onViewSettings?: () => void` callback prop passed from `App.tsx`. Check existing callbacks before adding.

**Acceptance criteria:**
- Empty weekly targets section shows an actionable card with a navigation CTA
- Empty log history has a visible "Log your first session" button
- All CTAs navigate to the correct screen

---

### UX-A8: Post-incident screen cleanup

**Problem:** After submitting an incident, the confirmation screen shows:
- `<DelayedTaxAttributionSection>` — a long wall of contributing activity data
- A Done button styled as `bg-danger` (red) — the wrong semantic for "confirm / dismiss"
- The button is cramped

**Fix:** In `LogIncidentScreen.tsx:80–99` (submitted state):
1. Remove `<DelayedTaxAttributionSection>` from the confirmation state entirely
2. Change Done button class from `bg-danger` to `bg-ink` (neutral confirm style)
3. Keep the button at full width and `h-12`
4. Keep the confirmation copy: "Incident recorded." + "Rest up. The heatmap and dashboard reflect today's status."

The `DelayedTaxAttributionSection` import can remain (still used elsewhere if applicable) but is not rendered post-submit.

**File:** `frontend/src/components/screens/LogIncidentScreen.tsx:80–99`

**Acceptance criteria:**
- Post-incident screen shows icon + headline + body text + neutral Done button only
- No contributing-activities list visible
- Done button is full width, `h-12`, neutral background (not red)

---

### UX-A9: Block safety map — legend and summary

**Problem:** `BlockSafetyMapSection` renders a calendar heatmap with no legend, no title context, no summary count.

**Fix:** Add to `BlockSafetyMapSection.tsx`:
1. A short summary label above the map: `"N / 14 days without issues"`
2. A legend below the map: green / yellow / red dots + labels ("All clear", "Warning", "Rule violated")
3. Improve the section heading from the generic label to "Block Progress"

**File:** `frontend/src/components/composites/BlockSafetyMapSection.tsx`

**Acceptance criteria:**
- Summary count renders above the heatmap
- Legend with 3 colour swatches renders below
- "Block Progress" section label used

---

## Group B — Structural Changes

Each is a larger change. Work one area at a time; commit each before starting the next.

---

### UX-B1: Incidents in Log History

**Problem:** Flare-up incidents are never visible after being logged. Users lose track of them.

**Fix:** Merge `engine.incidents` (FlareUpIncident[]) with `engine.logs` (ActivityLog[]) into a single chronological timeline in `LogHistoryScreen`.

**Implementation:**

1. Create a discriminated union type for timeline items:
```ts
type TimelineItem =
  | { kind: 'log'; log: ActivityLog }
  | { kind: 'incident'; incident: FlareUpIncident };
```

2. Extend `groupLogs` to `groupTimeline(logs, incidents)` — returns the same month→day structure but with `TimelineItem[]` per day instead of `ActivityLog[]`.

3. Add an `IncidentRow` component:
```tsx
const IncidentRow: React.FC<{ incident: FlareUpIncident }> = ({ incident }) => (
  <div className="flex items-start gap-3 py-3 px-4 bg-caution/5">
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-caution/20 text-caution-fg">
      {/* warning svg */}
    </span>
    <div>
      <p className="text-body font-semibold text-caution-fg">
        Incident — {incident.bodyPart}
      </p>
      <p className="text-caption text-ink-muted">
        Severity {incident.severity}/10
        {incident.notes ? ` · ${incident.notes}` : ''}
      </p>
    </div>
  </div>
);
```

4. Render `IncidentRow` or `LogRow` based on `item.kind` inside the day loop.

5. `LogHistoryScreen` destructures `incidents` from `engine` — check the type in `MilestoneEngineResult`.

**Files:** `frontend/src/components/screens/LogHistoryScreen.tsx`

**Acceptance criteria:**
- Incidents appear inline in the log history timeline on the correct date
- Incidents have a visually distinct treatment (caution/orange tint, warning icon)
- Existing log rows are unaffected
- Incident rows do not have edit/delete actions (read-only for now)

---

### UX-B2: Log History — day and week visual breaks

**Problem:** All logs within a month are inside one flat card with `divide-y`. Days blur together; weeks are indistinguishable.

**Fix:**

**Day break:** Each day group gets its own Card (or a visually separated block) with a small gap between days — instead of a flat divider line. Use `mb-2` spacing between day blocks within the month card.

**Week break:** Add a week separator (thin rule + "Week of Jun 9" label) between day groups that cross a Monday boundary.

```tsx
// In groupTimeline / render loop: detect week boundary crossings
function isSameWeek(dayA: string, dayB: string): boolean {
  // Both are ISO dates — compare ISO week (Monday-based)
  const getMonday = (d: Date) => {
    const day = d.getDay(); // 0=Sun
    const diff = d.getDate() - ((day + 6) % 7);
    return new Date(d.setDate(diff));
  };
  return getMonday(new Date(dayA + 'T00:00:00Z')).getTime()
    === getMonday(new Date(dayB + 'T00:00:00Z')).getTime();
}
```

Between day keys that cross a week boundary, render a `<WeekSeparator>` component (subtle `<hr>` + week label).

The month card stays (one card per month), but internally day groups have `pt-2.5 pb-3 rounded-lg mx-1 my-1` to feel visually distinct.

**File:** `frontend/src/components/screens/LogHistoryScreen.tsx`

**Acceptance criteria:**
- Each day's logs are visually grouped (subtle card-within-card or padded block)
- A "Week of [date]" separator appears between days that span different calendar weeks
- Month header labels unchanged
- Log rows unchanged

---

### UX-B3: "All Classes" rule — fix stale FK orphan + add DB guard

**Root cause (confirmed 2026-06-12):**

`SettingsScreen.tsx:135` has this fallback chain:
```tsx
{activity ? activity.name : cls ? cls.name : 'All classes'}
```

`cls` is resolved via `classMap.get(rule.activityClassId)`. When `activityClassId` references a class that has been **deleted** from the DB, `classMap.get(...)` returns `undefined` and the label falls back to `'All classes'`.

This is a **stale foreign key bug**: one or more rules in the production Supabase DB reference an `activity_class_id` that no longer exists in `activity_classes`. It only manifests in production (not locally) because that class was deleted from the live Supabase instance.

Screenshot evidence: production Settings screen shows `"All classes · Minimum days between sessions · 2"` — a `rest_between_class` rule with a deleted class ID. The rule `"Minimum days between sessions · 2"` also appears separately for "Gentle walk", confirming it's a duplicate orphan record, not an intentional cross-class rule.

**Fix — three parts:**

**Part 1 — Production data cleanup (do first):**
Run against Supabase production:
```sql
-- Find orphan rules (rules whose class no longer exists)
SELECT r.id, r.rule_type, r.threshold, r.activity_class_id
FROM rules r
LEFT JOIN activity_classes ac ON r.activity_class_id = ac.id
WHERE r.activity_class_id IS NOT NULL AND ac.id IS NULL;

-- Delete them (confirm the rows look correct first)
DELETE FROM rules
WHERE id IN (
  SELECT r.id FROM rules r
  LEFT JOIN activity_classes ac ON r.activity_class_id = ac.id
  WHERE r.activity_class_id IS NOT NULL AND ac.id IS NULL
);
```

**Part 2 — Frontend defensive label (don't silently mislead):**
Change the fallback in `SettingsScreen.tsx:135` so orphan rules are either skipped or labelled clearly:
```tsx
// Option A (recommended): filter them out of visibleRecoveryRules before rendering
const visibleRecoveryRules = rawRecoveryRules.filter(({ rule }) => {
  if (rule.activityId) return activityMap.has(rule.activityId);
  if (rule.activityClassId) return classMap.has(rule.activityClassId);
  return false; // no class and no activity — orphan, skip
});

// Remove the 'All classes' fallback; if both lookups fail, the row is gone
```

**Part 3 — Backend: add FK constraint via Alembic migration:**
Add `ON DELETE CASCADE` (or `RESTRICT`) on `rules.activity_class_id → activity_classes.id` so future class deletions either cascade-delete their rules or block the delete with a clear error.

Check `backend/app/models.py` or equivalent SQLModel model for the `Rule` table. If the FK is defined without cascade, add a new Alembic migration.

Note: `RESTRICT` is safer (forces the caller to explicitly handle rules before deleting a class). `CASCADE` is simpler. Align with whatever the class-delete flow in `ActivityManagerScreen` + backend does today.

**Files:**
- Production Supabase DB (manual SQL)
- `frontend/src/components/screens/SettingsScreen.tsx:127–136`
- `backend/app/models.py` (or equivalent) + new Alembic migration

**Acceptance criteria:**
- "All classes" label does not appear in production Settings
- Orphan rule rows deleted from Supabase
- Frontend filters out rules with unresolvable class/activity IDs (no fallback label rendered)
- Backend FK constraint prevents future orphan rules on class delete
- `make test` passes with new Alembic migration applied

---

### UX-B4: Activity status — expandable rule detail panel

**Problem:** `classStatuses[].reason` gives terse text. Users don't know which rule was violated or when they'll be clear.

**Fix:** Make each Activity Status row tappable to expand a detail panel.

**Frontend:**
```tsx
// DashboardScreen.tsx — Activity status section
const [expandedClassId, setExpandedClassId] = React.useState<string | null>(null);

// In the classStatuses.map:
<li key={cs.activityClassId}>
  <button
    type="button"
    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
    onClick={() => setExpandedClassId(id => id === cs.activityClassId ? null : cs.activityClassId)}
  >
    <StatusDot state={cs.state} label={...} meta={cs.reason} />
    <span className="text-caption text-ink-faint shrink-0">
      {cs.nextSafeDate && `Safe ${formatShort(cs.nextSafeDate)}`}
    </span>
  </button>
  {expandedClassId === cs.activityClassId && (
    <div className="bg-bg-sunken px-4 pb-3 text-caption text-ink-muted">
      {cs.estimatedRestDays != null && (
        <p className="mb-1">Rest {cs.estimatedRestDays} more day(s) to clear.</p>
      )}
      {cs.violatedRuleLabel && (
        <p>Rule: {cs.violatedRuleLabel}</p>
      )}
    </div>
  )}
</li>
```

**Backend/engine changes:**
- Inspect `ClassStatus` shape in the backend engine service (Python) or frontend engine hook
- Add optional fields: `violatedRuleLabel?: string`, `estimatedRestDays?: number`
- `violatedRuleLabel`: the human-readable name of the violated rule (from `ruleTaxonomy` labels)
- `estimatedRestDays`: days until `nextSafeDate` from today (can be computed in frontend if `nextSafeDate` is already present)

If `nextSafeDate` is already in the response, `estimatedRestDays` can be derived in the frontend: `differenceInDays(nextSafeDate, todayDate)`.

**Files:** `frontend/src/components/screens/DashboardScreen.tsx`, `frontend/src/hooks/useMilestoneEngine.ts` (type), backend engine service if `violatedRuleLabel` must come from server

**Acceptance criteria:**
- Tapping an activity status row expands a detail panel
- Panel shows rest-days estimate when available
- Panel shows the rule label (plain-English) when a violation exists
- Tapping again collapses the panel
- Non-tapped rows are unaffected

---

### UX-B5: Rules screen — preview grouping

**Problem:** Rules preview (wherever it appears in Settings/Rules) shows a flat wall of rules in creation order — not grouped by class, and exercises within a class are not adjacent.

**Fix:** In the rules list rendering (likely `SettingsScreen.tsx` or `EditBlockRulesScreen.tsx` preview area), group rules:
1. First by `activityClassId` (class-level rules first within each class group)
2. Within each class, class-level rules first, then exercise-level rules grouped by `activityId`

The grouping function:
```ts
type RuleGroup = {
  cls: ActivityClass;
  classRules: Rule[];
  exerciseGroups: { activity: Activity; rules: Rule[] }[];
};

function groupRulesForPreview(rules: Rule[], classes: ActivityClass[], activities: Activity[]): RuleGroup[] { ... }
```

Render each class group with its name as a section header.

**Files:** Wherever the rules preview list is rendered — identify the exact file first (likely `SettingsScreen.tsx` or a sub-component)

**Acceptance criteria:**
- Rules for the same class appear together under that class's name as a sub-header
- Exercise-level rules appear under their class, grouped by exercise
- No rules are reordered within the same class/exercise group (original order preserved within group)

---

### UX-B6: Edit Rules — compact row layout

**Problem:** Each rule row in `EditBlockRulesScreen.tsx` takes up too much vertical space with an always-visible description, a full-line number input, and text "Delete" button.

**New layout (per owner spec):**
```
[toggle]  Rule name  [-] [value] [unit] [+]  [🗑]
```

**Changes:**
1. **Toggle left** — move the enable/disable toggle to the start of the row
2. **'i' tooltip** — replace the always-visible helper/description text with a small info icon (`ⓘ`) that shows a tooltip on hover/tap using `title` attribute or a lightweight popover
3. **Inline controls** — `[−] [number-input] [unit-selector] [+]` all on one line, right-aligned within the row
4. **Delete → bin icon** — use `<DeleteButton>` from UX-A5 at the far right

**Structure per rule row:**
```tsx
<div className="flex items-center gap-2 py-2.5">
  {/* Toggle */}
  <Toggle checked={rule.isActive} onChange={...} />
  {/* Label + info */}
  <span className="flex-1 text-body text-ink truncate">{ruleLabel}</span>
  <button type="button" title={ruleHelper} className="text-ink-faint hover:text-ink">ⓘ</button>
  {/* Inline value controls */}
  <button type="button" onClick={decrement}>−</button>
  <input type="number" className="w-14 text-center ..." value={rule.threshold} onChange={...} />
  <span className="text-caption text-ink-muted w-8">{ruleUnit}</span>
  <button type="button" onClick={increment}>+</button>
  {/* Delete */}
  <DeleteButton onClick={() => onDeleteRule(rule.id)} />
</div>
```

**File:** `frontend/src/components/screens/EditBlockRulesScreen.tsx`

**Acceptance criteria:**
- Every rule row fits on one visual line (no wrapping description text below each rule)
- Toggle is at the left
- `ⓘ` icon shows the helper text on hover/tap
- Number + unit + increment/decrement are on the same line
- Delete is a bin icon at far right
- No `<DeleteButton>` regressions (existing logic preserved)

---

### UX-B7: Log Activity — collapse exercise picker after selection

**Problem:** After selecting an exercise, the full picker (all classes + all exercises) remains expanded, forcing the user to scroll past it to reach duration/RPE fields.

**Fix:** Add collapsed state to the activity picker section.

```tsx
// LogActivityScreen.tsx
const [pickerCollapsed, setPickerCollapsed] = React.useState(false);

// When an activity is selected:
onClick={() => {
  setSelectedId(act.id);
  setPickerCollapsed(true); // collapse on select
}}

// In the picker Card:
{pickerCollapsed && selectedId ? (
  <button
    type="button"
    onClick={() => setPickerCollapsed(false)}
    className="flex items-center justify-between gap-3 w-full text-left py-1"
  >
    <div>
      <p className="text-caption text-ink-muted uppercase">{selectedClass.name}</p>
      <p className="text-body font-medium text-ink">{selectedActivity.name}</p>
    </div>
    <span className="text-caption text-info">Change ↓</span>
  </button>
) : (
  /* full grouped picker */
)}
```

When `initialActivityId` is pre-set (from suggestion tap), set `pickerCollapsed = true` initially if `initialActivityId` is valid.

In edit mode (`logId` set), also start collapsed since the exercise is already selected.

**File:** `frontend/src/components/screens/LogActivityScreen.tsx`

**Acceptance criteria:**
- Selecting an exercise collapses the picker to a one-line summary (class name + exercise name)
- A "Change ↓" tap target re-expands the full picker
- Session details (Date, Duration, RPE etc.) are immediately visible without scrolling once an exercise is selected
- Pre-selected activities (from suggestions or edit mode) start collapsed

---

### UX-B8: Load risk — actionable guidance for caution/danger states

**Problem:** `LoadRiskSection` shows the load state but gives no guidance on what to do.

**Fix:** Add a contextual guidance strip below the rule-limit rows for caution/danger overall state.

```tsx
// LoadRiskSection.tsx
const overallState = ruleLimitRows.some(r => r.state === 'danger') ? 'danger'
  : ruleLimitRows.some(r => r.state === 'caution') ? 'caution'
  : 'safe';

{overallState === 'caution' && (
  <div className="mt-3 rounded-lg bg-caution/10 border border-caution/20 px-3 py-2.5 text-caption text-caution-fg">
    Approaching your weekly limit. Consider lighter sessions or a rest day.
  </div>
)}
{overallState === 'danger' && (
  <div className="mt-3 rounded-lg bg-danger/10 border border-danger/20 px-3 py-2.5 text-caption text-danger-fg">
    Weekly cap reached. Rest is recommended before your next high-load session.
  </div>
)}
```

Keep it read-only for now. No new screens or navigation required.

**File:** `frontend/src/components/composites/LoadRiskSection.tsx`

**Acceptance criteria:**
- Caution state shows a yellow advisory strip
- Danger state shows a red advisory strip
- Safe state shows nothing extra
- Existing progress bars and week strip unchanged

---

### UX-B9: Dashboard sub-tabs refactor

**Problem:** Dashboard stacks 10+ sections vertically. Cognitive overload on first load.

**Implementation plan:**

**Step 1 — Add tab state to DashboardScreen:**
```tsx
const [dashTab, setDashTab] = React.useState<'today' | 'metrics' | 'safety'>(() => {
  return (localStorage.getItem('dash_tab') as 'today' | 'metrics' | 'safety' | null) ?? 'today';
});
```

**Step 2 — Tab switcher using existing `SegmentedControl`:**
```tsx
const TAB_OPTIONS = [
  { value: 'today',   label: 'Today' },
  { value: 'metrics', label: 'Metrics' },
  { value: 'safety',  label: 'Safety' },
];
<SegmentedControl
  value={dashTab}
  onChange={v => { setDashTab(v); localStorage.setItem('dash_tab', v); }}
  options={TAB_OPTIONS}
  ariaLabel="Dashboard section"
/>
```

**Step 3 — Extract sub-components:**

Extract to separate files to keep `DashboardScreen.tsx` manageable:

`DashboardTodayTab.tsx`:
- Greeting + date
- Check-in status badge (UX-A1)
- `SuggestedActivityCard`
- One key metric: load risk state (green/yellow/red at a glance, no full detail)

`DashboardMetricsTab.tsx`:
- This week (weekly targets progress bars)
- `GoalsCard`

`DashboardSafetyTab.tsx`:
- `WeeklyLoadGraph`
- `LoadRiskSection` (full, with UX-B8 guidance)
- `BlockSafetyMapSection` (with UX-A9 legend)
- Activity Status (with UX-B4 expandable)

**Step 4 — Update `DashboardScreen.tsx`:**
Render the correct tab component based on `dashTab`. Props passed through unchanged.

**Component boundary rules:**
- `DashboardTodayTab`, `DashboardMetricsTab`, `DashboardSafetyTab` are page-local components (not shared design system) — live in `frontend/src/components/screens/`
- Each receives the same `engine` prop (no new API calls, no lifting state)
- `onOpenCheckIn`, `onOpenLogActivity`, `onQuickLog` passed through to `DashboardTodayTab`

**File:** `frontend/src/components/screens/DashboardScreen.tsx` + 3 new sibling files

**Acceptance criteria:**
- Three tabs render the correct section groups (no bleed between tabs)
- Active tab persists in `localStorage` across refreshes
- All existing props are still passed through correctly
- `SegmentedControl` tab switcher is visible at top of Dashboard, below greeting or as sticky header
- Greeting + date appear on Today tab only (or as a fixed header outside the tabs — decide during implementation based on feel)
- No regressions in existing Dashboard tests

---

## Backlog Additions

After completing this sprint, add the following to `plans/BACKLOG.md`:

```markdown
## UX — Future (post-overhaul)

- **True streak counter** — consecutive-week (or session) streak derived from weekly target history.
  Replace the retired `cleanStreak` UI with a well-designed streaks section. Distinct from the
  retired F10.1 recovery streaks.

- **Load breakdown screen** — tap-through from LoadRiskSection to a per-class breakdown:
  "X of Y budget used by class Z." Helps power users tune caps.

- **Block safety map interactivity** — tap a heatmap cell to see which rules applied that day
  (rest window, frequency, consecutive days). Adds context to the calendar view.

- **Activity status → link to Edit Rules** — in the expanded rule detail panel (UX-B4),
  add a "Adjust rules for this class →" navigation shortcut.
```

---

## Ticket Order (commit sequence)

```
UX-A1  check-in badge
UX-A2  load risk label prefix
UX-A3  activity status done-today meta fix
UX-A4  remove clean streak
UX-A5  delete → bin icon (new component + apply everywhere)
UX-A6  log activity minute unit guard
UX-A7  improved empty states
UX-A8  post-incident screen cleanup
UX-A9  block safety map legend
---
UX-B1  incidents in log history
UX-B2  log history day/week breaks
UX-B3  all-classes rule investigation + fix
UX-B4  activity status expandable tooltip
UX-B5  rules preview grouping
UX-B6  edit rules compact row
UX-B7  log activity collapse picker
UX-B8  load risk actionable guidance
UX-B9  dashboard sub-tabs refactor
```

---

## Notes for Implementer

- **State ownership:** All new UI state in this plan is ephemeral local `useState`. Nothing new goes to React Context or a global store. `localStorage` only for the dashboard tab preference.
- **No new API endpoints.** All changes are frontend-only except UX-B3 (possible backend guard) and UX-B4 (possible ClassStatus field additions — check first if `nextSafeDate` is enough to derive `estimatedRestDays` in the frontend).
- **Reuse `SegmentedControl`** for the dashboard tabs — it already exists in the UI kit.
- **`DeleteButton`** created in UX-A5 is used by UX-B6. Do UX-A5 before UX-B6.
- **Tests:** Each ticket must follow the standard TDD gate — failing test before code, `make test` green before commit.
- **Do not change anything outside the listed files per ticket.** Out-of-scope observations go to `BACKLOG.md`.
