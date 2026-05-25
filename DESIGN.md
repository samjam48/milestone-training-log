# Milestone — System Design & Architecture (Pre-Code)

## Core Concepts

### Training Block
A bounded period (typically 2 weeks) with explicit targets and recovery rules. At the end, you review milestones (weekly volume hit + consecutive safe days) and decide whether to progress (increase targets by ~20%) or hold steady.

**Block lifecycle:**
1. **Create** — copy targets/rules from last block or customize
2. **Active** — log activities, check in daily, system tracks against rules
3. **Milestone trigger** — weekly volume hit + 2 consecutive days no issues → suggest review
4. **Review** — look at safety zones (green/yellow/red), decide to progress or adjust
5. **Archive** — close block, start a new one

### Activity Class
A grouping of activities that share physiological impact. Examples:
- **High-intensity foot load** — running, padel, tennis, skiing
- **Bicep-focused** — bicep curls, pull-ups, rowing
- **Interval training** — HIIT, sprints, fast circuits (different exercise types, same intensity pattern)
- **Stretching/mobility** — static stretches, dynamic mobility work
- **Contrast therapy** — ice baths, cold plunges, alternating hot/cold

Activities belong to one primary class (multi-class deferred; will add if needed).

### Goal
A time-scoped objective tied to one or more activity types. Timeframes: monthly or quarterly. Examples:
- "Walk 20km without flare-up by end of month"
- "Run continuously for 5km by month 3"
- "Reduce recovery window from 3 days to 2 days for running by end of quarter"

Goals are for planning/motivation; they live outside training blocks but inform what goes into a block.

### Activity (Entity)
A specific workout you can log (e.g., "Morning walk", "Padel match", "Contrast therapy session").
- Belongs to one **Activity Class**
- Has a recovery rule type (e.g., "minimum 2 days rest after this class")
- Type: either `performance` (affects load, rules) or `recovery` (affects compliance goals, not load rules)

### Rule (Recovery Constraint)
Applies to an entire **Activity Class**. Types:

1. **Rest Between Same Class** — e.g., "max 1 day between high-intensity foot load activities"
2. **Frequency Limit** — e.g., "interval training max 2× per week"
3. **Weekly Load Cap** — e.g., "total load for foot-load class ≤ 150 units/week"
4. **Consecutive Day Limit** — e.g., "max 3 consecutive days of activity before a rest day"

Rules are scoped to a **Training Block**. When you create a new block, rules copy from the previous one + can be adjusted.

### Recovery Target (Compliance Goal)
For recovery-type activities. E.g., "stretching 2× daily", "contrast therapy 1× weekly".
- Scoped to a training block
- Tracked as completion streaks (consecutive days/weeks completed)
- Does NOT affect load calculations

---

## Data Model

```
Goal
├── id
├── user_id
├── title (e.g., "Walk 20km without flare-up")
├── description (optional)
├── target_date (end date for monthly/quarterly goal)
├── timeframe (monthly, quarterly)
├── activity_type_id (nullable — which activity class does this relate to? can be null for cross-class goals)
├── status (active, achieved, missed, paused)
├── created_at, updated_at

TrainingBlock
├── id
├── user_id
├── name (e.g., "Week 1-2 rehab", "Month 2 progression")
├── start_date
├── end_date (nullable until completed)
├── status (active, completed, archived)
├── related_goal_id (nullable fk to Goal, for tracking which goal this block supports)
├── notes
├── is_review_milestone_hit (bool) — triggered when weekly_volume + 2 safe days both true
├── created_at, updated_at

Rule (Recovery Constraint)
├── id
├── training_block_id (fk)
├── activity_class_id (nullable fk — null means this is a cross-class rule)
├── rule_type (rest_between_class, frequency_limit, weekly_load_cap, consecutive_day_limit, weekly_activity_count)
├── threshold_value (int/float)
├── window_days (int, typically 7 for weekly rules)
├── enabled (bool)
├── created_at

RecoveryTarget (Compliance Goal)
├── id
├── training_block_id (fk)
├── activity_id (fk to the recovery-type activity)
├── target_frequency (e.g., 2 for "2× daily", 1 for "1× weekly")
├── frequency_unit (daily, weekly)
├── current_streak_days (int)
├── created_at

ActivityClass
├── id
├── user_id
├── name (e.g., "High-intensity foot load", "Stretching")
├── description
├── type (performance, recovery)
├── default_recovery_window_days (when you add a new activity to this class)
├── created_at

Activity
├── id
├── user_id
├── activity_class_id (fk)
├── name (e.g., "Morning walk", "Padel match")
├── type (performance, recovery)
├── is_active (bool)
├── created_at

ActivityLog
├── id
├── user_id
├── activity_id (fk)
├── logged_date (the date you did this activity)
├── duration_minutes (required)
├── volume_value (required — reps, km, sets, etc.)
├── volume_unit (nullable — "km", "reps", "sets")
├── rpe (1-10, optional — perceived exertion)
├── post_activity_feel (nullable — enum: fine, mild_discomfort, bad)
├── notes (nullable)
├── created_at

DailyCheckIn
├── id
├── user_id
├── check_in_date (unique per user per date)
├── pain_level (0-10, required)
├── readiness_level (0-10, required)
├── stiffness_level (0-10, required)
├── has_flare_up (bool, required)
├── notes (nullable)
├── created_at

FlareUpIncident
├── id
├── user_id
├── incident_date (the date it started)
├── body_part (e.g., "left knee", "right shoulder")
├── severity (1-10)
├── activity_class_id (nullable — which class likely caused it, if known)
├── notes (nullable)
├── created_at
```

---

## UI Flows & Screens

### 1. Dashboard (Home)
**Stacked layout (top to bottom):**

**A. Weekly Target Progress**
- For each performance activity class with a target:
  - "Walk: 6 / 10 km this week"
  - "Contrast therapy: 7 / 7 sessions (complete)"
- Bars with current/target, color-coded

**B. Compliance Streaks**
- "Stretching: 4 days in a row ✓"
- "Contrast therapy: 5 days (weekly target met 2 days ago)"
- Show which ones are due today, which are overdue

**C. Suggested Activity**
- "Today: stretching + contrast therapy are recommended"
- "Tomorrow: high-intensity foot load is safe from then"
- Based on last activity dates + recovery windows

**D. Activity Status Traffic Light (Per Class)**
```
High-intensity foot load:  🟢 (safe, last activity 4 days ago)
Bicep-focused:            🟡 (risky, did 2 yesterday + today)
Stretching:               🟢 (clear, can do anytime)
```

**E. Active Goals** (Monthly/Quarterly)
- "Walk 20km safely by end of month — 12/20 km done (60%)"
- "Run 5km non-stop by month-end — not yet attempted"
- Quick visual of progress toward next milestones

---

### 2. Goals & Planning Screen
**List current goals**
- Grouped by timeframe (month, quarter)
- Status: in progress, achieved, missed, paused
- Progress bar toward target (if applicable)

**Create/Edit Goal**
- Title
- Description
- Target date (end of month, end of quarter)
- Activity type (if activity-specific, optional)
- Status

---

### 4. Log Activity Screen
**Step 1: Choose Activity**
- Dropdown list of active activities
- Grouped by class

**Step 2: Log Details**
- Duration (required) — text input, minutes/hours toggle
- Volume (required) — number + unit (km, reps, sets, etc. — auto-populated from activity type)
- RPE (optional) — slider 1-10, "How hard did it feel?"
- Post-activity feel (optional) — buttons: Fine / Mild discomfort / Bad

**Step 3: Confirm**
- Show rule violations if any (e.g., "⚠️ This breaks your 2-day rest rule for foot load")
- Still allow submit (user can choose to override)
- Toast on success

---

### 5. Morning Check-In Screen
**Step 1: Recovery Metrics**
- Pain level (0-10 slider, labeled "None" to "Severe")
- Readiness (0-10 slider, labeled "Exhausted" to "Energized")
- Stiffness (0-10 slider, labeled "Fluid" to "Stiff")

**Step 2: Flare-Up?**
- "Any new pain or injury?" — Yes / No
- If Yes → expand:
  - Body part (text input or dropdown)
  - Severity (1-10 slider)
  - Optional: "Which class triggered this?" (multi-select activity classes)

**Step 3: Notes & Submit**
- Optional notes field (context: slept poorly, diet, stress, etc.)
- Submit button
- If already checked in today, show "Update today's check-in" instead

---

### 6. Training Block Setup / Review
**Screen A: Start New Block**
- Block name (e.g., "Week 3-4 progression")
- Option: "Copy rules from last block" (yes/no)
- If yes, show the rules and allow inline editing:
  - Rule 1: "High-intensity foot load — min 2 days rest" → [Adjust to 1 day?]
  - Rule 2: "Weekly foot-load total ≤ 150 load units" → [Adjust to 180?]
- Add recovery targets (recovery-type activities):
  - Stretching 2× daily ✓
  - Contrast therapy 1× weekly ✓
- Save block

**Screen B: Block Milestone Review** (shown when weekly_volume + 2_safe_days both true)
- "🎯 Milestone hit! Weekly target met + 2 safe days."
- Show the block data (see next screen)
- Button: "Review & Progress" or "Hold Steady"

**Screen C: Block Review (Retrospective)**
- Block name, start/end dates
- **Calendar heatmap** — each day shows green/yellow/red based on daily safety score
- **Weekly load graph** — line graph of weekly load vs flare-up incidents (marked as red dots)
- **Decisions:**
  - "Increase difficulty by 20% for next block" → auto-populate next block rules at 1.2×
  - "Hold current level"
  - "Step back 10%"
- Save decision, create new block

---

### 7. Activity Management
**List Screen**
- Each activity shows:
  - Name + class
  - Type (performance / recovery)
  - Last logged (if ever)
  - Status (active / inactive)
- "Add Activity" button

**Add/Edit Activity**
- Name
- Activity Class (dropdown)
- Type (toggle: performance / recovery)
- If new: lazy setup — you can log it now and set recovery rule later
- If later setting rule: "Set recovery rule for <activity name>"
  - Recovery window (default 3 days, editable)
  - Frequency limit (optional, e.g., "max 2× per week")

---

### 8. Flare-Up / Incident Log
**List Screen**
- Timeline view of all incidents
- Each incident: date, body part, severity, likely cause (if auto-detected), notes

**Add Incident**
- Date (default today, but can be backdated)
- Body part
- Severity (1-10)
- Which activity classes do you think caused it? (optional multi-select)
- Notes
- Submit

**Incident Detail / Correlation View**
- Show the incident + its date
- Timeline of activities 24-72h before
- Auto-highlight the highest-load activity in that window
- Show weekly baseline load before that window
- "This likely correlates with <activity class> on <date> (load spike: 2.5× baseline)"

---

### 9. Retrospective Safety Zones
**Accessed from:** Training block review, or standalone history view

**View 1: Calendar Heatmap**
- Each day is a cell
- Green: no violations, no pain, safe
- Yellow: mild discomfort (pain > 5 OR rule warning), pushing it
- Red: flare-up OR rule violation (danger), went too far
- Click a day to see activities + check-in data

**View 2: Weekly Load Graph**
- X-axis: weeks in block
- Y-axis: total load
- Line: rolling weekly load for each performance class
- Dots: flare-up incidents (red)
- Horizontal line: rule threshold (e.g., "150 load units")
- Tooltip on hover: date, activities, load breakdown

---

## Load Calculation & Rules Engine

### Load Score
`Load = Σ(volume × rpe)` for all activities in an activity class in a time window (e.g., 3 days, 7 days, 1 week).

If RPE is missing, default to 5 (neutral effort).

### Daily Safety Score
Determined by:
1. Any rules violated for that day? → **Red** (danger)
2. Any pain spike (pain_level > 5) OR mild rule warning? → **Yellow** (pushing it)
3. Otherwise → **Green** (safe)

### Rule Checks (run for all enabled rules in the current training block)

**Rest Between Same Class:**
- Last activity in this class was on day X
- Today is day Y
- If `Y - X < recovery_window_days` → violation (amber if warning threshold, red if danger)

**Frequency Limit:**
- Count activities in this class in the last 7 days
- If count ≥ threshold → warning or violation

**Weekly Load Cap:**
- Sum load for this class in the last 7 days
- If sum > threshold → violation

**Consecutive Day Limit:**
- Count consecutive days with ≥1 activity in this class
- If count ≥ threshold → violation

**Weekly Activity Count (Cross-Class):**
- Count all performance activities (all classes) in the last 7 days
- If count ≥ threshold → violation
- Example: "max 5 performance activities per week" (prevents overload across domains)

### Flare-Up Correlation Detection
When a flare-up is logged:
1. Find the incident date
2. Look back 24-72 hours (exclude same day)
3. Calculate daily load for each activity class in that window
4. Compare peak daily load to 14-day baseline (the 14 days before the lookback window)
5. If peak > 2× baseline → **high correlation**
6. If peak > 1.4× baseline → **medium correlation**
7. Highlight the activity class with the highest load in that window

### Training Block Milestones
A block hits review milestone when **both**:
- Weekly volume target for at least one performance activity class has been met
- At least 2 consecutive days with no flare-ups AND no rule violations

---

## Data Imports & Integrations (Future)
- **Strava:** Import activities as logs (duration, distance auto-filled, RPE/feel nullable)
- **Google Fit / Apple Health:** Import as logs with duration + distance

---

## Key Design Decisions

1. **Recovery-type activities separate tracking:** They track compliance (completion streaks), not load. This keeps the load engine clean.

2. **Lazy activity setup:** You log a new activity first, set up recovery rules later. Lowers friction.

3. **2-week default blocks:** Short enough to feel responsive, long enough to see patterns. Milestone-triggered reviews add flexibility.

4. **Primary activity class only (for now):** Keeps rules simple. Multi-class support is a future addition.

5. **Auto-default 3-day recovery:** New activities get a safe 3-day window, user can lower it as they feel comfortable.

6. **Retrospective safety zones (green/yellow/red):** Helps you see patterns and make data-driven progression decisions.

7. **Explicit rule violations shown at log time:** You can still log the activity, but you're aware you're breaking a rule. User choice.

---

## Next Steps

1. **Review & feedback** — does this model match how you think about your recovery?
2. **Data model refinement** — any fields missing, relationships unclear?
3. **UI flow walkthrough** — screen-by-screen, spot any gaps?
4. **Design prototype** — rough wireframes/mockups of the key flows
5. **Then code** — database schema, API routes, frontend components
