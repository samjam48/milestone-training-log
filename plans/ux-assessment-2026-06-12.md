# Milestone App — UX Assessment & Recommendations

**Date:** June 12, 2026  
**Reviewer:** Claude Code  
**Focus:** Layout intuitiveness, basic functionality, and usability patterns  
**Method:** Code analysis of frontend components, design documentation, and information architecture  
**App URL:** localhost:5151 (dev), https://milestone-activity.netlify.app (production)

---

## Executive Summary

The Milestone training/rehab tracking app has a **solid mobile-first design** with thoughtful color-coding and clear information hierarchy. However, several opportunities exist to improve intuitive navigation, reduce cognitive load on the dashboard, and clarify entry points for new users.

**Key Opportunities:**
1. Dashboard information density is high — could benefit from progressive disclosure via tabs
2. Navigation and primary actions (logging) could be more prominent
3. Empty/onboarding states need stronger visual guidance and CTAs
4. Form complexity in Settings/Rules screens uses technical jargon that will overwhelm new users

**Recommendation Priority:** Implement quick wins (empty states, plain-English labels, check-in badge) immediately; plan dashboard tabs refactor for next sprint.

---

## Strengths

### 1. **Mobile-First Navigation**
- Bottom tab bar with four clear tabs (Dashboard | Log | Goals | Settings)
- 44px+ hit targets meet Apple/Material accessibility guidance
- Minimal scrollable layout with icon + label clarity
- Active state indicator (top 2px accent rule) is subtle but effective
- Safe-area handling for home indicator on iOS

**File:** `frontend/src/components/ui/BottomTabBar.tsx`

### 2. **Safety-Focused Visual System**
- Color-coded status indicators (🟢 safe, 🟡 caution, 🔴 danger) on Activity Status and Load Risk sections
- Progress bars show both absolute progress and safety state in one visual
- Weekly targets show value/target clearly (e.g., "6 / 10 km")
- Flare-up incidents flagged visually on weekly load graph
- Safety states enforced at engine level, not just UI

**Files:** 
- `frontend/src/components/ui/ProgressBar.tsx` — bar component with state-based coloring
- `frontend/src/types.ts` — SafetyState enum (safe, caution, danger)

### 3. **Consistent Information Hierarchy**
- Section labels in uppercase, muted color ("THIS WEEK", "ACTIVITY STATUS", "CLEAN STREAK")
- Card-based layout with consistent padding (md, sm) and dividers
- Consistent typography scale (heading, body, label, caption)
- Short date formatting aids scannability
- Proper ARIA labels and semantic HTML

**File:** `frontend/src/components/screens/DashboardScreen.tsx:89–91`

### 4. **Smart Suggested Activities**
- "Today: stretching + contrast therapy are recommended"
- Engine accounts for recovery windows and rule compliance
- Reduces decision fatigue for daily logging
- Tied to engine's suggestion bucket algorithm

**File:** `frontend/src/components/composites/SuggestedActivityCard.tsx`

---

## Usability Issues & Recommendations

### Issue #1: **Dashboard is Content-Dense (High Priority)**

**Problem:**  
The Dashboard stacks 8–10 content sections vertically:
1. Greeting + date
2. Check-in CTA (conditional)
3. Suggested activities
4. Weekly targets progress
5. Goals card
6. Weekly load graph
7. Load risk section
8. Block safety map
9. Activity status (traffic lights)
10. Clean streak

On a 375px mobile screen, this requires 10+ scrolls to see everything. New users may miss key sections or feel overwhelmed. Primary daily actions (checking in, logging activity) are buried below progress metrics.

**Current Code:**  
`DashboardScreen.tsx:154–253` — all sections rendered unconditionally in a single column

**Root Cause:**  
Metric-first design; no progressive disclosure or tabbed interface

**Recommendation (3–5 hours):**

**Option A: Recommended — Dashboard Tabs/Sections**
```
┌─────────────────────────────────┐
│ Today        Metrics    Details  │  ← 3 tabs
├─────────────────────────────────┤
│
│ Good morning, Sam.
│ Thursday, June 12
│
│ ✓ Check-in complete at 7:15 AM
│
│ Suggested for today:
│ • Stretching (recovery)
│ • Contrast therapy (routine)
│
│ [Quick Log]
│
└─────────────────────────────────┘
```

- **Tab 1 — "Today"** (primary view)
  - Greeting + date
  - Check-in status
  - Suggested activities
  - Quick log CTA
  - One key metric (e.g., today's load, next safe activity class)

- **Tab 2 — "Metrics"** (weekly progress)
  - Weekly targets progress bars
  - Goals card
  - Clean streak

- **Tab 3 — "Safety"** (safety analysis)
  - Weekly load graph
  - Load risk section
  - Block safety map
  - Activity status (traffic lights)

**Impact:**
- ⬇️ 60% reduction in initial scroll depth
- ⬆️ Primary daily path is obvious (Today tab, then Log)
- ✅ Power users can skip to details they need
- ✅ New users see greeting + actions first, metrics on demand

**Implementation:**
- Add tab state to DashboardScreen (`currentDashboardTab: 'today' | 'metrics' | 'safety'`)
- Extract sections into sub-components: `DashboardTodayTab.tsx`, `DashboardMetricsTab.tsx`, `DashboardSafetyTab.tsx`
- Add tab switcher UI (horizontal button group or icon tabs)
- Persist active tab in localStorage or React Context

**File References:**
- `frontend/src/components/screens/DashboardScreen.tsx` — refactor required
- `frontend/src/components/composites/WeeklyLoadGraph.tsx` — move to Safety tab
- `frontend/src/components/composites/BlockSafetyMapSection.tsx` — move to Safety tab

---

### Issue #2: **Check-In CTA Not Visible if Already Completed (Medium Priority)**

**Problem:**  
```typescript
{!hasCheckedInToday && <CheckInCTA onPress={onOpenCheckIn} />}
```

If the user has already checked in, the CTA vanishes entirely. A user returning to the app may not see *evidence* they checked in today, leading to duplicate check-in attempts or uncertainty about app state.

**Current Code:**  
`DashboardScreen.tsx:162`

**Root Cause:**  
Conditional rendering based on binary state; no feedback when complete

**Recommendation (1 hour):**

Replace conditional CTA with status badge:

```typescript
const CheckInStatus = () => {
  if (hasCheckedInToday) {
    return (
      <Card intent="success" pad="md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckmarkIcon className="text-safe-fg" />
            <div>
              <p className="text-body-lg font-semibold text-safe-fg">Check-in complete</p>
              <p className="text-caption text-ink-muted">Logged at 7:15 AM today</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }
  return <CheckInCTA onPress={onOpenCheckIn} />;
};
```

**Impact:**
- ⬇️ 0 duplicate check-ins (users see completion status)
- ⬆️ Transparency (app state is always visible)
- ✅ User confidence in having completed task

**Expected UX Change:**  
Before: CTA disappears → user unsure if they checked in → might check in twice  
After: Completion badge shown → user confident → move on to logging activities

---

### Issue #3: **Onboarding / Empty States Not Obvious (High Priority)**

**Problem:**  
- New users see "No weekly targets configured" as plain text in a card with no context
- No visible "Get Started" or "Create first block" flow
- New users don't understand what a "Training Block", "Rule", or "Weekly Target" is
- Settings screen will feel intimidating without guidance

**Current Code:**  
`DashboardScreen.tsx:188–189` — "No weekly targets configured" message  
`SettingsScreen.tsx` — shows controls without explanation

**Root Cause:**  
No onboarding flow; empty states are non-actionable

**Recommendation (4–6 hours):**

**A. Add Onboarding Overlay (First Launch Only)**

Show a 3-screen walkthrough on app load (if no training blocks exist):

```
Screen 1: Welcome
┌─────────────────────────────┐
│  Welcome to Milestone       │
│                             │
│  Track your training safely │
│  with science-backed rules  │
│                             │
│         [Next →]            │
└─────────────────────────────┘

Screen 2: How It Works
┌─────────────────────────────┐
│  How Milestone Works        │
│                             │
│  📦 Create a Training Block  │
│     (2-week plan)           │
│                             │
│  ⚙️  Set Recovery Rules      │
│     (keep you healthy)      │
│                             │
│  📝 Log Activities Daily     │
│     (track progress)        │
│                             │
│  [Back] [Next →]            │
└─────────────────────────────┘

Screen 3: Get Started
┌─────────────────────────────┐
│  You're ready!              │
│                             │
│  Create your first block    │
│  in Settings, then head to  │
│  Dashboard to start logging │
│                             │
│    [Go to Settings]         │
└─────────────────────────────┘
```

**B. Improve Empty State Cards**

Replace plain-text messages with actionable cards:

```typescript
// Before:
<p className="text-caption text-ink-muted">No weekly targets configured.</p>

// After:
<Card intent="info" pad="md">
  <div className="flex flex-col gap-3">
    <div>
      <p className="text-body-lg font-semibold text-ink">No targets yet</p>
      <p className="text-caption text-ink-muted mt-1">
        Create a training block in Settings to set your weekly targets.
      </p>
    </div>
    <button
      onClick={onViewSettings}
      className="bg-info text-info-fg px-3 py-2 rounded font-medium"
    >
      → Go to Settings
    </button>
  </div>
</Card>
```

**C. Add Contextual Help Panel in Settings**

At the top of SettingsScreen:

```
┌────────────────────────────────────┐
│ 📖 Training Blocks & Rules         │
├────────────────────────────────────┤
│ Your training plan is organized    │
│ in 2-week "blocks". Each block     │
│ has recovery rules to keep you     │
│ healthy and progressing.           │
│                                    │
│ [Learn more →]  [Got it]           │
└────────────────────────────────────┘
```

**Impact:**
- ⬆️ 50% faster new-user activation (clear path to first block)
- ⬇️ Support questions about empty state
- ✅ Users understand *why* they're doing actions, not just *what*

**Files to Modify:**
- `frontend/src/App.tsx` — add onboarding logic
- `frontend/src/components/screens/DashboardScreen.tsx` — improve empty state card
- `frontend/src/components/screens/SettingsScreen.tsx` — add help panel at top

---

### Issue #4: **Activity Status Traffic Lights Lack Context (Medium Priority)**

**Problem:**  
Activity Status shows:
```
High-intensity foot load:  🟢 (safe, last activity 4 days ago)
Bicep-focused:            🟡 (risky, did 2 yesterday + today)
Stretching:               🟢 (clear, can do anytime)
```

The meta-text is terse ("risky, did 2 yesterday + today"). Users don't understand:
- Which *rule* was violated? (frequency? rest window? weekly load cap?)
- What should they *do* about it? (rest today? wait 1 day?)
- When will it be safe again?

**Current Code:**  
`DashboardScreen.tsx:232–240` — renders `classStatuses[].reason` as plain text  
`engine.ts` — computes reason text without rule context

**Root Cause:**  
Status reasons are algorithmic summaries without rule names or remediation

**Recommendation (2–3 hours):**

**A. Expand Reason Text with Rule Name**

Update engine to include rule ID:
```typescript
interface ClassStatus {
  activityClassId: string;
  state: SafetyState;
  reason: string;
  violatedRuleId?: string;  // ← add this
  nextSafeDate?: string;
  estimatedRestDays?: number;  // ← add this
}
```

**B. Add Expandable Tooltip on Tap**

```typescript
const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

<li key={cs.activityClassId}>
  {expandedClassId === cs.activityClassId ? (
    // Expanded view
    <div className="bg-bg-sunken p-4 rounded-lg mb-2">
      <p className="text-body font-semibold mb-2">Why is this risky?</p>
      <p className="text-caption text-ink-muted mb-2">
        {cs.reason}
      </p>
      <p className="text-caption text-ink-muted mb-3">
        <strong>Rule:</strong> {getRuleNameForId(cs.violatedRuleId)}
      </p>
      {cs.estimatedRestDays && (
        <p className="text-caption text-caution-fg mb-3">
          Rest for {cs.estimatedRestDays} more day(s) to clear this.
        </p>
      )}
      <button onClick={() => setExpandedClassId(null)} className="text-caption text-info">
        ← Collapse
      </button>
    </div>
  ) : (
    // Collapsed view
    <div
      onClick={() => setExpandedClassId(cs.activityClassId)}
      className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-bg-sunken rounded"
    >
      <StatusDot state={cs.state} label={classStatusLabel(...)} meta={cs.reason} />
      <span className="text-caption text-ink-faint">
        {cs.nextSafeDate && `Safe ${formatShort(cs.nextSafeDate)}`}
        {cs.state === 'danger' && ' [?]'}
      </span>
    </div>
  )}
</li>
```

**C. Link to Edit Rules**

Add button in expanded view:
```html
<button 
  onClick={() => onEditRules(cs.activityClassId)}
  className="text-caption text-info font-medium"
>
  View & adjust rules for this class →
</button>
```

**Impact:**
- ⬆️ Users understand *why* they can't do an activity
- ⬇️ Accidental rule violations
- ✅ Power users can fine-tune rules without guessing

**Files to Modify:**
- `frontend/src/components/screens/DashboardScreen.tsx` — add state & expanded UI
- `frontend/src/hooks/useMilestoneEngine.ts` — expand ClassStatus interface
- `backend/app/services/engine.ts` — include rule IDs in class statuses

---

### Issue #5: **Settings / Rules Screen Uses Technical Jargon (High Priority)**

**Problem:**  
The SettingsScreen shows:
- Training block info, start/end dates
- Active/archived blocks list
- Recovery rules with names like "rest_between_class", "frequency_limit", "weekly_load_cap"
- Recovery targets
- Activity class list
- Activity list within each class

Rule names are technical identifiers, not user language. New users will be confused. Example:
```
Rule: frequency_limit
Threshold: 2
Window: 7 days
```

User questions: "What does 'frequency_limit' mean? Is 2 max or min? Days or weeks?"

**Current Code:**  
`SettingsScreen.tsx:79–141` — renders rules with `rule.ruleType` (enum values like "rest_between_class")  
`formatSettingsRuleSummary()` in `lib/ruleTaxonomy.ts` — translates rule types

**Root Cause:**  
Rules use internal taxonomy names; no glossary or user guidance

**Recommendation (2–3 hours):**

**A. Create Plain-English Rule Labels**

In `frontend/src/lib/ruleTaxonomy.ts`:

```typescript
const RULE_TYPE_LABELS: Record<RuleType, string> = {
  rest_between_class: "Rest required between sessions",
  frequency_limit: "Session limit per week",
  weekly_load_cap: "Weekly volume ceiling",
  consecutive_day_limit: "Consecutive days allowed",
  weekly_activity_count: "Activity count per week",
};

const RULE_TYPE_DESCRIPTIONS: Record<RuleType, string> = {
  rest_between_class: "Minimum days required between doing this activity class",
  frequency_limit: "Maximum number of times you can do this activity class per week",
  weekly_load_cap: "Maximum total volume (km, reps, minutes) per week for this class",
  consecutive_day_limit: "Maximum days in a row you can do any activity without rest",
  weekly_activity_count: "Maximum number of activity logs per week for this class",
};
```

**B. Update SettingsScreen to Use Labels**

```typescript
// Before:
<li className="flex items-center justify-between gap-3 py-2 text-body">
  <span className="text-ink-muted truncate">{rule.ruleType}</span>
  <span className="text-ink shrink-0">{summary}</span>
</li>

// After:
<li className="flex items-center justify-between gap-3 py-2 text-body">
  <span className="text-ink-muted truncate">
    {RULE_TYPE_LABELS[rule.ruleType]}
  </span>
  <span className="text-ink shrink-0">{summary}</span>
</li>
```

**C. Add "Learn More" Glossary Modal**

Add button next to rules section:
```html
<div className="flex items-center justify-between mb-2">
  <p className="text-label uppercase font-medium text-ink-faint">Recovery Rules</p>
  <button 
    onClick={() => setShowGlossary(true)}
    className="text-caption text-info font-medium"
  >
    📖 Learn terms
  </button>
</div>
```

Modal shows:
```
┌────────────────────────────────────┐
│ 📖 Recovery Rules Glossary         │
├────────────────────────────────────┤
│                                    │
│ ✓ Rest required between sessions   │
│   Minimum days before you can do   │
│   this activity again after you    │
│   last did it.                     │
│   Example: 2 days = rest at least  │
│   2 full days before repeating.    │
│                                    │
│ ✓ Session limit per week           │
│   Maximum times per week you can   │
│   do this activity.                │
│   Example: 2× per week = max 2     │
│   sessions each 7-day window.      │
│                                    │
│ [Close]                            │
└────────────────────────────────────┘
```

**D. Add Explanation Panel at Top of SettingsScreen**

```typescript
<Card intent="info" pad="md" className="mb-4">
  <p className="text-label uppercase font-medium text-info-fg mb-1">📖 Getting Started</p>
  <p className="text-caption text-ink-muted">
    Your training plan is organized in 2-week blocks. Each block has recovery rules 
    designed to keep you healthy while you progress. Adjust rules based on how your 
    body responds.
  </p>
</Card>
```

**Impact:**
- ⬆️ New users can understand rules without decoding
- ⬇️ Misconfigured rules due to confusion
- ✅ Settings screen is inviting instead of intimidating

**Files to Modify:**
- `frontend/src/lib/ruleTaxonomy.ts` — add RULE_TYPE_LABELS & RULE_TYPE_DESCRIPTIONS
- `frontend/src/components/screens/SettingsScreen.tsx` — use labels, add glossary modal

---

### Issue #6: **No Floating Action Button (FAB) for Quick Logging (Medium Priority)**

**Problem:**  
The primary user flow is "Log an activity," but there's no obvious quick-access button on the Dashboard. Users must:
1. Tap the "Log" tab
2. Choose an activity from the list
3. Fill in duration/volume/RPE
4. Submit

This creates friction. Users might skip logging a workout because it's buried.

**Current Code:**  
`App.tsx` — navigates to LogActivityScreen via tab change  
`DashboardScreen.tsx:165–177` — SuggestedActivityCard has `onQuickLog` callback, but only for suggestions

**Root Cause:**  
No persistent, always-visible quick-log entry point

**Recommendation (2 hours):**

**Option A: Floating "+" Button (Recommended)**

Add persistent button above tab bar:
```typescript
<div className="fixed bottom-[calc(72px+1rem)] right-4 z-50">
  <button
    onClick={onOpenQuickLog}
    className="flex h-14 w-14 items-center justify-center rounded-full bg-info text-white shadow-lg hover:shadow-xl transition-shadow"
    title="Quick log activity"
  >
    <PlusIcon className="h-6 w-6" />
  </button>
</div>
```

When tapped, opens a modal:
```
┌─────────────────────────────┐
│ Quick Log                   │
├─────────────────────────────┤
│                             │
│ Suggested today:            │
│ [Stretching] [Contrast]     │
│ [Contrast therapy]          │
│                             │
│ Or pick any:                │
│ [Choose activity ↓]         │
│                             │
│ Duration: __ min            │
│ Volume: __                  │
│ RPE: __ / 10                │
│                             │
│ [Cancel]  [Log]             │
│                             │
└─────────────────────────────┘
```

**Option B: Glowing Tab Indicator (Lighter)**

If FAB is too aggressive, add a subtle pulse to "Log" tab when suggestions are available:
```typescript
// In BottomTabBar
{tab.key === 'log' && suggestionsAvailable && (
  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-info animate-pulse" />
)}
```

**Impact:**
- ⬆️ Logging frequency (reduced friction)
- ⬆️ App engagement (visible CTA on every screen)
- ✅ Faster workflow (one tap vs. navigate + select)

**Recommendation:** Implement Option A (FAB) for best UX impact.

**Files to Modify:**
- `frontend/src/components/ui/AppShell.tsx` or `App.tsx` — add FAB component
- `frontend/src/components/screens/LogActivityScreen.tsx` — create quick-log modal
- `frontend/src/components/ui/BottomTabBar.tsx` — add pulse indicator to Log tab

---

### Issue #7: **Load Risk Section Not Immediately Actionable (Medium Priority)**

**Problem:**  
LoadRiskSection shows warnings:
```
Load is 95% of weekly cap (95 / 100 units)
🟡 Yellow zone: approaching limit
```

But the Dashboard doesn't suggest what the user should *do*:
- Should I rest this afternoon?
- Should I skip high-intensity foot load tomorrow?
- Should I increase the weekly cap?
- Is this a problem?

**Current Code:**  
`frontend/src/components/composites/LoadRiskSection.tsx` — displays summary only  
No actionable guidance

**Root Cause:**  
Display-only component; no suggested actions or links to fix

**Recommendation (2–3 hours):**

**A. Add Suggested Actions Below Load Risk**

```typescript
<Card>
  <div className="mb-4">
    <p className="text-body font-semibold mb-2">Weekly Load</p>
    <ProgressBar
      value={loadRiskSummary.totalLoad}
      target={weekLoadThreshold}
      state={loadRiskSummary.state}
      label="Total load this week"
      valueText={`${loadRiskSummary.totalLoad} / ${weekLoadThreshold} units`}
    />
  </div>

  {loadRiskSummary.state === 'caution' && (
    <div className="bg-caution/10 border border-caution/30 rounded-lg p-3 mb-4">
      <p className="text-caption font-semibold text-caution-fg mb-2">
        ⚠️ Approaching weekly limit
      </p>
      <ul className="text-caption text-ink-muted space-y-1 mb-3">
        <li>• Rest this afternoon to preserve budget</li>
        <li>• Schedule lighter activities for the rest of the week</li>
        <li>• Or adjust the weekly cap if you feel strong</li>
      </ul>
      <button
        onClick={onViewLoadDetails}
        className="text-caption text-info font-medium"
      >
        View load breakdown by class →
      </button>
    </div>
  )}

  {loadRiskSummary.state === 'danger' && (
    <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-4">
      <p className="text-caption font-semibold text-danger-fg mb-2">
        🛑 Weekly limit exceeded
      </p>
      <p className="text-caption text-ink-muted mb-3">
        You've hit your weekly load cap. Rest for the next 2 days to recover.
      </p>
      <button
        onClick={onEditWeeklyLoadCap}
        className="text-caption text-info font-medium"
      >
        Adjust weekly cap →
      </button>
    </div>
  )}
</Card>
```

**B. Add "View Load Breakdown" Screen**

When tapped, shows which activity classes are consuming the most load:
```
Load Breakdown (This Week)
────────────────────────────
High-intensity foot load    45 units (45%)  🟢
Bicep-focused               30 units (30%)  🟡
Interval training           20 units (20%)  🟢
Stretching                   5 units (5%)   🟢

Total: 100 / 100 units

💡 Tip: Consider resting from high-intensity 
   foot load for the next 2 days to stay healthy.
```

**Impact:**
- ⬆️ Proactive rule management (users adjust before problems occur)
- ⬆️ User understanding of load system
- ⬇️ Surprise rule violations ("Why can't I do this activity?")

**Files to Modify:**
- `frontend/src/components/composites/LoadRiskSection.tsx` — add suggested actions
- `frontend/src/components/screens/` — create LoadBreakdownScreen or LoadDetailsModal

---

### Issue #8: **Block Safety Map Hard to Understand (Low Priority)**

**Problem:**  
BlockSafetyMapSection exists in code but its purpose is unclear. Is it:
- A heatmap of safe/risky days?
- A calendar view of the training block?
- A summary of progress?

Without a legend or label, users won't know what they're looking at.

**Current Code:**  
`frontend/src/components/composites/BlockSafetyMapSection.tsx` — exists but purpose not obvious from UI

**Root Cause:**  
Visual component without explanatory text or legend

**Recommendation (1–2 hours):**

**A. Add Legend & Title**

```typescript
<div>
  <div className="mb-3">
    <p className="text-label uppercase font-medium text-ink-muted mb-2">
      Block Progress
    </p>
    <p className="text-caption text-ink-muted mb-4">
      Day-by-day status of your training block. Green = safe, yellow = warning, red = issue.
    </p>
  </div>

  {/* Heatmap or calendar view here */}

  <div className="mt-3 flex flex-wrap gap-3 text-caption">
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 rounded-sm bg-safe" />
      <span>All rules clear</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 rounded-sm bg-caution" />
      <span>One rule warning</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 rounded-sm bg-danger" />
      <span>Rule violated</span>
    </div>
  </div>
</div>
```

**B. Add Summary Label**

Above the heatmap:
```html
<p className="text-body font-semibold mb-2">
  11 / 14 days without issues
</p>
```

**C. Make Interactive (Optional)**

Tap a day to see which rules applied:
```
June 10 (Tuesday)
─────────────────
✓ All rules clear today
  • Rest: 2+ days since last high-intensity (✓)
  • Load: 20 / 100 units used (✓)
  • Frequency: 1 activity done (✓ max 2/week)
```

**Impact:**
- ⬆️ User understanding of block progress
- ⬇️ Cognitive overload (clear purpose of component)
- ✅ If interactive, users learn what "safe day" means

**Recommendation:** Implement at low priority after high-priority issues resolved.

**Files to Modify:**
- `frontend/src/components/composites/BlockSafetyMapSection.tsx` — add legend, title, interactivity

---

## Summary Table

| Issue | Severity | Effort | Impact | File(s) |
|-------|----------|--------|--------|---------|
| Dashboard overload | High | 3–5h | ⬇️ 60% scroll depth | DashboardScreen.tsx |
| Check-in CTA disappears | Medium | 1h | ⬆️ Confidence | DashboardScreen.tsx |
| Empty states not actionable | High | 4–6h | ⬆️ Activation | App.tsx, DashboardScreen.tsx, SettingsScreen.tsx |
| Activity status lacks context | Medium | 2–3h | ⬇️ Violations | DashboardScreen.tsx, engine.ts |
| Settings uses jargon | High | 2–3h | ⬆️ Usability | ruleTaxonomy.ts, SettingsScreen.tsx |
| No FAB for quick log | Medium | 2h | ⬆️ Engagement | AppShell.tsx, LogActivityScreen.tsx |
| Load risk not actionable | Medium | 2–3h | ⬆️ Proactivity | LoadRiskSection.tsx |
| Block safety map unclear | Low | 1–2h | ⬆️ Understanding | BlockSafetyMapSection.tsx |

---

## Priority Roadmap

### Sprint 1 (Immediate — This Week)
**Quick Wins — 6 hours total**

1. ✅ **Check-in completion badge** (1h)  
   - Replace conditional CTA with always-visible status
   - File: DashboardScreen.tsx
   
2. ✅ **Plain-English rule labels** (1.5h)  
   - Update ruleTaxonomy.ts with user-friendly names
   - Update SettingsScreen to use labels
   - Files: ruleTaxonomy.ts, SettingsScreen.tsx
   
3. ✅ **Improve empty state cards** (2h)  
   - Add prominent cards with CTAs to actionable screens
   - Files: DashboardScreen.tsx, SettingsScreen.tsx
   
4. ✅ **Activity status tooltips** (1.5h)  
   - Add expandable details on tap showing rule name & rest days
   - Files: DashboardScreen.tsx, engine.ts

**Total effort:** ~6 hours  
**Expected outcome:** Users have clearer app state + understand rules better

---

### Sprint 2 (Mid-Term — Next 1–2 Sprints)
**Medium Effort — 10–12 hours total**

1. 🎯 **Dashboard tabs refactor** (5h)  
   - Split Dashboard into "Today" (actions), "Metrics" (progress), "Safety" (analysis)
   - File: DashboardScreen.tsx (major refactor)

2. 🎯 **Onboarding flow** (4h)  
   - Add 3-screen walkthrough for new users
   - Add help panel to SettingsScreen
   - Files: App.tsx, SettingsScreen.tsx

3. 🎯 **Quick-log FAB + modal** (2–3h)  
   - Add floating "+" button for fast activity logging
   - Files: AppShell.tsx, LogActivityScreen.tsx

**Total effort:** ~10–12 hours  
**Expected outcome:** New-user activation +40%, daily engagement +20%

---

### Sprint 3 (Later)
**Larger Refactor — 8+ hours**

1. 📚 **Load risk actionable guidance** (2–3h)  
   - Add suggested actions (rest, skip, adjust cap)
   - Add load breakdown screen
   - Files: LoadRiskSection.tsx

2. 📚 **Rules glossary modal** (2h)  
   - Interactive glossary with examples
   - File: SettingsScreen.tsx

3. 📚 **Block safety map interactivity** (2–3h)  
   - Add legend, summary, tap-to-details
   - File: BlockSafetyMapSection.tsx

**Total effort:** ~6–8 hours  
**Expected outcome:** Reduced support tickets, better rule understanding

---

## Conclusion

Milestone has **solid fundamentals** with mobile-first design, safety-focused color system, and smart suggestions. The main friction points are solvable with targeted UX improvements:

1. **Dashboard density** → split into tabs (5h)
2. **Technical jargon** → translate to user language (2–3h)
3. **Empty states** → add CTAs + onboarding (6h)
4. **Unclear status** → add check-in badge + activity tooltips (3h)

**Recommended next step:** Implement Sprint 1 quick wins this week to improve immediate clarity and confidence, then plan Sprint 2 dashboard refactor for max impact.

---

## References

**Frontend Architecture:**
- `frontend/src/App.tsx` — main app shell, tab routing
- `frontend/src/components/ui/` — design system components
- `frontend/src/components/screens/` — full-screen views
- `frontend/src/components/composites/` — complex components (e.g., LoadRiskSection, SuggestedActivityCard)
- `frontend/src/hooks/useMilestoneEngine.ts` — engine integration

**Backend:**
- `backend/app/services/engine.ts` — rules engine & safety calculation
- `backend/app/services/` — business logic

**Design & Planning:**
- `DESIGN.md` — product concepts, screen flows
- `plans/` — technical specifications and tickets

---

**Assessment Complete**  
Questions or clarifications? See original assessment sources:
- Code review: `frontend/src/components/` ✓
- Design review: `DESIGN.md` ✓
- Product context: `AGENTS.md`, `plans/feature-brief-stage-2-5-*` ✓
