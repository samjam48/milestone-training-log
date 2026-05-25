# Milestone — Mobile UI Mockups (ASCII)

## Navigation Structure
```
Bottom Tab Bar:
┌──────────────────────────────────────┐
│ 🏠 Dashboard │ 📝 Log │ 🎯 Goals │ ⚙️ Settings │
└──────────────────────────────────────┘
```

---

## Screen 1: Dashboard

```
┌──────────────────────────────────────┐
│  Milestone                      📊    │
├──────────────────────────────────────┤
│                                      │
│  WEEKLY TARGETS                      │
│  ┌────────────────────────────────┐  │
│  │ Walking                         │  │
│  │ [████████░░░] 8/10 km          │  │
│  │                                │  │
│  │ Stretching                      │  │
│  │ [██████████░] 11/14 sessions   │  │
│  │                                │  │
│  │ Contrast Therapy                │  │
│  │ [██████████░] 2/3 sessions     │  │
│  └────────────────────────────────┘  │
│                                      │
│  COMPLIANCE STREAKS                  │
│  ┌────────────────────────────────┐  │
│  │ ✓ Stretching: 4 days in a row  │  │
│  │                                │  │
│  │ ✓ Contrast therapy:             │  │
│  │   2 sessions done this week     │  │
│  └────────────────────────────────┘  │
│                                      │
│  SUGGESTED ACTIVITY TODAY            │
│  ┌────────────────────────────────┐  │
│  │ 💡 Stretching                  │  │
│  │    + Contrast therapy          │  │
│  │                                │  │
│  │ ✓ Running is safe from         │  │
│  │   tomorrow (4 days rest done)  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ACTIVITY STATUS                     │
│  ┌────────────────────────────────┐  │
│  │ 🟢 Walking: Safe               │  │
│  │    Last done: 4 days ago       │  │
│  │                                │  │
│  │ 🟡 Running: Risky              │  │
│  │    Last done: 2 days ago       │  │
│  │                                │  │
│  │ 🟢 Stretching: Anytime         │  │
│  │    No restrictions             │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─────────────────────────────┐     │
│  │     + Check-in Now          │     │
│  └─────────────────────────────┘     │
│                                      │
└──────────────────────────────────────┘
```

---

## Screen 2: Log — Activity History

```
┌──────────────────────────────────────┐
│  Log                                 │
├──────────────────────────────────────┤
│                                      │
│  MAY 2025                            │
│  ┌────────────────────────────────┐  │
│  │ Today — Mon 25 May             │  │
│  │ Stretching · 15 min · 1 set    │  │
│  │ Feel: Fine                     │  │
│  │                           [▶]  │  │
│  │                                │  │
│  │ Yesterday — Sun 24 May         │  │
│  │ Walking · 45 min · 3.2 km      │  │
│  │ RPE 5 · Feel: Mild discomfort  │  │
│  │                           [▶]  │  │
│  │                                │  │
│  │ Sat 23 May                     │  │
│  │ Contrast Therapy · 20 min      │  │
│  │ Feel: Fine                     │  │
│  │                           [▶]  │  │
│  │                                │  │
│  │ Fri 22 May                     │  │
│  │ Walking · 30 min · 2.0 km      │  │
│  │ RPE 4 · Feel: Fine             │  │
│  │ ⚠️ Rule: 2-day rest broken      │  │
│  │                           [▶]  │  │
│  └────────────────────────────────┘  │
│                                      │
│  APRIL 2025                          │
│  ┌────────────────────────────────┐  │
│  │ Sun 30 Apr                     │  │
│  │ Padel · 60 min · 1 match       │  │
│  │ RPE 7 · Feel: Fine             │  │
│  │                           [▶]  │  │
│  └────────────────────────────────┘  │
│                                      │
│                                      │
│  ┌──────────────────────────────┐    │
│  │     + Log Activity           │    │
│  │     + Log Incident           │    │
│  └──────────────────────────────┘    │
│                                      │
│  [Manage Activities]                 │
└──────────────────────────────────────┘
```

---

## Screen 2b: Add Log — Activity Form
*(Opened from "+ Log Activity" button)*

```
┌──────────────────────────────────────┐
│  ← Log Activity                      │
├──────────────────────────────────────┤
│                                      │
│  CHOOSE ACTIVITY                     │
│  ┌────────────────────────────────┐  │
│  │ Select Activity         ▼       │  │
│  │                                │  │
│  │ High-Intensity Foot Load       │  │
│  │  ├─ Running                   │  │
│  │  ├─ Padel                     │  │
│  │  └─ Tennis                    │  │
│  │                                │  │
│  │ Recovery                       │  │
│  │  └─ Stretching                │  │
│  └────────────────────────────────┘  │
│                                      │
│  DURATION (required)                 │
│  ┌────────────────────────────────┐  │
│  │  30    minutes      ⌫           │  │
│  │  [───────────────────]         │  │
│  │  mins ──────── hours toggle    │  │
│  └────────────────────────────────┘  │
│                                      │
│  DISTANCE / REPS (required)          │
│  ┌────────────────────────────────┐  │
│  │  5.0 km                  ⌫    │  │
│  │  (unit: km)                    │  │
│  └────────────────────────────────┘  │
│                                      │
│  EFFORT / RPE (optional)             │
│  ┌────────────────────────────────┐  │
│  │  6 / 10                         │  │
│  │  Easy ─[●]─ Hard              │  │
│  │  "How hard did it feel?"       │  │
│  └────────────────────────────────┘  │
│                                      │
│  POST-ACTIVITY FEEL (optional)       │
│  ┌────────────────────────────────┐  │
│  │  ⚪ Fine  ⚪ Discomfort  ⚪ Bad │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌─────────────────────────────┐     │
│  │     ⚠️ Rule Violation       │     │
│  │  Breaks 2-day rest rule     │     │
│  │  for foot-load              │     │
│  │  (Last done 2 days ago)     │     │
│  │                             │     │
│  │  [Cancel]  [Log Anyway]     │     │
│  └─────────────────────────────┘     │
│                                      │
└──────────────────────────────────────┘
```

---

## Screen 2b: Log Activity — Inline Activity Manager

```
┌──────────────────────────────────────┐
│  Log Activity                         │
├──────────────────────────────────────┤
│  CHOOSE ACTIVITY                     │
│  ┌────────────────────────────────┐  │
│  │ Select Activity         ▼       │  │
│  │  [+ Manage Activities]         │  │
│  │                                │  │
│  │ ...activity list...            │  │
│  └────────────────────────────────┘  │
│  (Tap "+ Manage Activities" → opens  │
│   Activity Manager modal/overlay)    │
│                                      │
└──────────────────────────────────────┘
```

---

## Screen 3: Morning Check-In

```
┌──────────────────────────────────────┐
│  Morning Check-In                    │
├──────────────────────────────────────┤
│                                      │
│  How are you feeling today?          │
│                                      │
│  PAIN LEVEL                          │
│  ┌────────────────────────────────┐  │
│  │            3                   │  │
│  │  None ──[●]────── Severe  /10 │  │
│  └────────────────────────────────┘  │
│                                      │
│  READINESS                           │
│  ┌────────────────────────────────┐  │
│  │            7                   │  │
│  │  Low ───[●]────── High    /10 │  │
│  └────────────────────────────────┘  │
│                                      │
│  STIFFNESS                           │
│  ┌────────────────────────────────┐  │
│  │            2                   │  │
│  │  Fluid ──[●]────── Stiff   /10│  │
│  └────────────────────────────────┘  │
│                                      │
│  ANY PAIN OR INJURY?                 │
│  ┌────────────────────────────────┐  │
│  │  ⚪ No   ⚪ Yes                │  │
│  └────────────────────────────────┘  │
│                                      │
│  [If Yes → expand to:]               │
│  BODY PART                           │
│  ┌────────────────────────────────┐  │
│  │  [Left knee         ▼]         │  │
│  └────────────────────────────────┘  │
│                                      │
│  SEVERITY                            │
│  ┌────────────────────────────────┐  │
│  │            4                   │  │
│  │  Mild ───[●]────── Severe /10 │  │
│  └────────────────────────────────┘  │
│                                      │
│  LIKELY CAUSED BY                    │
│  ┌────────────────────────────────┐  │
│  │ □ High-intensity foot load     │  │
│  │ □ Running                      │  │
│  │ □ Other...                     │  │
│  └────────────────────────────────┘  │
│                                      │
│  NOTES (optional)                    │
│  ┌────────────────────────────────┐  │
│  │  Slept poorly last night       │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │                          │  │  │
│  │  └──────────────────────────┘  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Cancel]  [Update Check-In] │    │
│  │                              │    │
│  │  (or [Save] if first time)   │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

---

## Screen 4: Goals

```
┌──────────────────────────────────────┐
│  Goals                               │
├──────────────────────────────────────┤
│                                      │
│  THIS MONTH                          │
│  ┌────────────────────────────────┐  │
│  │ Walk 20km safely without       │  │
│  │ flare-up                       │  │
│  │ [████████░░░] 12/20 km        │  │
│  │ Due: May 31                    │  │
│  │                                │  │
│  │ [Edit]  [Archive]              │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Run 5km continuous             │  │
│  │ [░░░░░░░░░░░] Not started     │  │
│  │ Due: May 31                    │  │
│  │                                │  │
│  │ [Edit]  [Archive]              │  │
│  └────────────────────────────────┘  │
│                                      │
│  THIS QUARTER                        │
│  ┌────────────────────────────────┐  │
│  │ Reduce recovery window from    │  │
│  │ 3→2 days for running           │  │
│  │ [████████████░] On track      │  │
│  │ Due: June 30                   │  │
│  │                                │  │
│  │ [Edit]  [Archive]              │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │       + New Goal             │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

---

## Screen 5: Training Block Settings

```
┌──────────────────────────────────────┐
│  Training Block                      │
├──────────────────────────────────────┤
│                                      │
│  ACTIVE BLOCK                        │
│  ┌────────────────────────────────┐  │
│  │ Week 3-4 Rehab Progression     │  │
│  │ Started: May 11                │  │
│  │ Status: Active                 │  │
│  │                                │  │
│  │ ┌──────────────────────────┐   │  │
│  │ │ WEEKLY TARGETS           │   │  │
│  │ │ • Walking: 10 km         │   │  │
│  │ │ • Running: 5 km          │   │  │
│  │ │ • Stretching: 14x        │   │  │
│  │ │ • Contrast: 2x           │   │  │
│  │ └──────────────────────────┘   │  │
│  │                                │  │
│  │ ┌──────────────────────────┐   │  │
│  │ │ RECOVERY RULES           │   │  │
│  │ │ • Walk: 2d rest min      │   │  │
│  │ │ • Run: 3d rest min       │   │  │
│  │ │ • Max 5 activities/week  │   │  │
│  │ └──────────────────────────┘   │  │
│  │                                │  │
│  │ [Edit Rules]  [Review Block]   │  │
│  └────────────────────────────────┘  │
│                                      │
│  PREVIOUS BLOCKS                     │
│  ┌────────────────────────────────┐  │
│  │ Week 1-2 Rehab Start           │  │
│  │ May 1 - May 14                 │  │
│  │ Status: ✓ Completed            │  │
│  │ [View Review]                  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │   + New Training Block       │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

---

## Screen 5b: Edit Training Block Rules

```
┌──────────────────────────────────────┐
│  Edit Training Block Rules           │
├──────────────────────────────────────┤
│                                      │
│  CLASS-SPECIFIC RULES                │
│                                      │
│  High-Intensity Foot Load            │
│  ┌────────────────────────────────┐  │
│  │ Min rest between activities    │  │
│  │ [2] days                  ⌫   │  │
│  │                                │  │
│  │ Max weekly frequency           │  │
│  │ [4] activities/week       ⌫   │  │
│  └────────────────────────────────┘  │
│                                      │
│  Stretching                          │
│  ┌────────────────────────────────┐  │
│  │ Target frequency               │  │
│  │ [2] times per [day]       ▼   │  │
│  └────────────────────────────────┘  │
│                                      │
│  CROSS-CLASS RULES                   │
│  ┌────────────────────────────────┐  │
│  │ Max performance activities     │  │
│  │ [5] per week               ⌫  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Cancel]  [Save Changes]    │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

---

## Screen 6: Activity Manager (From Log Screen)

```
┌──────────────────────────────────────┐
│  Activity Manager                    │
├──────────────────────────────────────┤
│                                      │
│  ACTIVE ACTIVITIES                   │
│                                      │
│  High-Intensity Foot Load            │
│  ┌────────────────────────────────┐  │
│  │ Walking                        │  │
│  │ Last: 4d ago                   │  │
│  │ [∗∗∗∗]                         │  │
│  │ [Edit] [Deactivate]            │  │
│  │                                │  │
│  │ Running                        │  │
│  │ Last: 2d ago                   │  │
│  │ [∗∗∗∗]                         │  │
│  │ [Edit] [Deactivate]            │  │
│  └────────────────────────────────┘  │
│                                      │
│  Recovery                            │
│  ┌────────────────────────────────┐  │
│  │ Stretching                     │  │
│  │ Last: today                    │  │
│  │ [Edit] [Deactivate]            │  │
│  │                                │  │
│  │ Contrast Therapy               │  │
│  │ Last: 2d ago                   │  │
│  │ [Edit] [Deactivate]            │  │
│  └────────────────────────────────┘  │
│                                      │
│  INACTIVE ACTIVITIES                 │
│  ┌────────────────────────────────┐  │
│  │ Skiing                         │  │
│  │ [Reactivate]  [Delete]         │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │      + New Activity          │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

---

## Screen 6b: Add New Activity

```
┌──────────────────────────────────────┐
│  New Activity                        │
├──────────────────────────────────────┤
│                                      │
│  ACTIVITY NAME                       │
│  ┌────────────────────────────────┐  │
│  │  Hiking                   ⌫   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ACTIVITY CLASS                      │
│  ┌────────────────────────────────┐  │
│  │  High-Intensity Foot Load  ▼   │  │
│  └────────────────────────────────┘  │
│                                      │
│  TYPE                                │
│  ┌────────────────────────────────┐  │
│  │  ⚪ Performance  ⚪ Recovery     │  │
│  └────────────────────────────────┘  │
│                                      │
│  Note: You can set recovery rules    │
│  for this activity after logging     │
│  your first session.                 │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Cancel]  [Create Activity] │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

---

## Notes on Flow

- **Dashboard** is the home screen — shows targets, compliance, suggestions, and status
- **Log Activity** has inline access to Activity Manager ("+") for ad-hoc new activities
- **Morning Check-In** is triggered from Dashboard button
- **Goals** shows monthly/quarterly objectives
- **Settings** (Training Block Settings) is where you manage active blocks and rules
- **Activity Manager** is accessible from Log screen (soft dependency, not critical path)

---

## Interactions to Test

1. Create new activity → lazy setup → log first session → set recovery rule retrospectively
2. Dashboard → log activity → rule violation warning but still submit → see traffic light update
3. Morning check-in → flag pain/injury → day later → retrospective view shows correlation
4. Block review → set new targets → new block inherits + user adjusts
5. Goals → monthly goal hit → shows on dashboard as progress

