# Stage 2.5 — Usage Logic & Block Clarity

*Technical design | Architect | Date: 2026-06-06*
*Companion: `plans/feature-brief-stage-2-5-usage-logic-2026-06-06.md`*

---

## 1. Current state (gaps)

| Area | Today | Gap |
| --- | --- | --- |
| Goals | Optional `activity_class_id`; manual `progress_value` | No `activity_id`; no auto-track; Save in header |
| Logs | `logged_date` always `todayDate` in hook | No date picker; no edit UI (PATCH exists) |
| Rules | `activity_class_id` optional; **no `activity_id`** | New rules created with `null` class; suggestions ignore frequency/rest for listing; cross-class rule type exists |
| Weekly targets | Separate table; read-only on Settings | Not editable in Edit Rules; confused with caps |
| Suggestions | All active activities; class-level safe/danger | No done-today filter; no rest bucket semantics |
| Load risk | Delayed-tax proactive hits only | Not tied to block caps; no per-exercise expand |

---

## 2. Schema changes (Alembic — owner approved)

### 2.1 `goals`

```sql
ALTER TABLE goals ADD COLUMN activity_id VARCHAR REFERENCES activities(id);
ALTER TABLE goals ADD COLUMN auto_track_progress BOOLEAN NOT NULL DEFAULT FALSE;
```

| Field | Semantics |
| --- | --- |
| `activity_id` | Primary link for tracking (G2-A). When set, `activity_class_id` may be denormalized from activity on write for backwards compatibility. |
| `auto_track_progress` | Default `false`. When `true`, `progress_value` recomputed from logs (see §4.3). |

**Validation (service):** If `auto_track_progress` is true, `activity_id` and `progress_target` + `progress_unit` required.

### 2.2 `rules`

```sql
ALTER TABLE rules ADD COLUMN activity_id VARCHAR REFERENCES activities(id);
ALTER TABLE rules ADD COLUMN limit_unit VARCHAR NULL;  -- optional display/compute hint
```

| Field | Semantics |
| --- | --- |
| `activity_id` | `NULL` = class-scoped rule; set = exercise-scoped rule. `activity_class_id` required when `activity_id` set (validated via activity FK). |
| `limit_unit` | Optional: `sessions`, `km`, `mi`, `minutes`, `load`. Inferred from `rule_type` when null. |

**Constraints (service-level):**

- Reject `activity_class_id IS NULL` for new rules except legacy rows (no new cross-class creates).
- Reject `weekly_activity_count` on create (deprecated).
- Exercise rule must reference activity belonging to `activity_class_id`.

**Migration data fix:** Existing rules with `activity_class_id IS NULL` and `rule_type != 'weekly_activity_count'`: owner review or map to intended class. Cross-class rules: `enabled = false` or delete in migration note.

### 2.3 No change to `weekly_targets` table (Q4-A)

Keep `weekly_targets` for aspirational per-class weekly goals. UI unified in Edit Rules; API unchanged (`POST/PATCH /api/weekly-targets`).

### 2.4 `activity_classes` delete

Add service + route `DELETE /api/activity-classes/{id}`:

- Return `409` if any activity in the class has `activity_logs`.
- If the class has activities but **none** have logs: **cascade-delete** those activities, then delete the class (single service transaction).
- Frontend (**S25.F8**): two-step confirmation — (1) Delete class → Cancel / Delete; (2) if unlogged activities exist, list activity names and warn they will be deleted → Cancel / Delete.

PATCH already exists for rename/type.

### 2.5 Docs

Update `docs/database-schema.md` and `docs/api-map.md` in the same migration ticket.

---

## 3. API contract changes

### 3.1 Goals

**`POST /api/goals` / `PATCH /api/goals/{id}`** — extend body:

| Field | Type | Notes |
| --- | --- | --- |
| `activity_id` | string \| null | New |
| `auto_track_progress` | boolean | Default false on create |

**Read shape unchanged** plus new fields (camelCase in frontend mappers).

### 3.2 Rules

**`POST /api/training-blocks/{block_id}/rules`** — require `activity_class_id` for all new types except none. Optional `activity_id`. Reject `weekly_activity_count`.

**`PATCH /api/rules/{id}`** — allow `activity_id`, `limit_unit`.

### 3.3 Activity logs

No schema change. Ensure **`PATCH /api/activity-logs/{log_id}`** accepts `logged_date` with validation `logged_date <= as_of(today)`.

After create/update/delete: call shared **`recompute_derived_state(session)`** (goals auto-progress, review milestone, recovery streaks — existing hooks extended).

### 3.4 Dashboard — extended response

Add to `GET /api/dashboard` (breaking additive for frontend; version via feature flag not required — ship FE+BE together):

```python
class SuggestionBucket(str, Enum):
    do = "do"
    rest = "rest"
    done = "done"

class SuggestionRead:  # extended
    # existing: id, label, state, reason, next_safe_date, last_done_date
    bucket: SuggestionBucket
    scope: Literal["activity", "class"]  # for rest rows
    activity_class_id: str | None
    description: str | None  # rest copy, 80-char truncate for class listings

class GoalDashboardRowRead:
    goal_id: str
    title: str
    status: str
    activity_id: str | None
    progress_value: float | None
    progress_target: float | None
    progress_unit: str | None
    fill_ratio: float | None  # 0..1, null for qualitative
    is_qualitative: bool

class LoadRiskDayRead:
    date: str  # ISO
    flagged: bool  # cap breach OR delayed-tax elevated

class LoadRiskExerciseBarRead:
    activity_id: str
    activity_name: str
    actual: float
    limit: float
    unit: str

class LoadRiskClassBarRead:
    activity_class_id: str
    class_name: str
    actual: float
    limit: float
    unit: str
    exercises: list[LoadRiskExerciseBarRead]  # populated for expand; can ship all and FE toggles

class LoadRiskSummaryRead:
    week_days: list[LoadRiskDayRead]
    class_bars: list[LoadRiskClassBarRead]

class DashboardRead:  # additions
    suggestion_buckets: list[SuggestionRead]  # each row has bucket
    goal_rows: list[GoalDashboardRowRead]
    load_risk_summary: LoadRiskSummaryRead | None
```

**Deprecation (owner C4):** Remove legacy `suggestions` from `DashboardRead` on this feature branch when **S25.F6** ships; clients use `suggestion_buckets` only.

**`weekly_progress`:** Retained for “Last 7 days” aspirational bars from `weekly_targets` until UI consolidation decision in implementation.

### 3.5 Activity classes

| Method | Path | Purpose |
| --- | --- | --- |
| `DELETE` | `/api/activity-classes/{class_id}` | Delete when no logged activities |

---

## 4. Backend service design

### 4.1 Rule precedence (`load_engine.py`)

New helper:

```python
def effective_rules_for_activity(
    activity_id: str,
    class_id: str,
    rules: list[RuleDict],
) -> list[RuleDict]:
    """Merge class rules with exercise rules; exercise overrides class per rule_type."""
```

For each `rule_type` + metric (sessions, volume unit, load):

- Collect class-level enabled rules.
- Collect exercise-level enabled rules for `activity_id`.
- **Exercise wins** if present; else class; else no limit.

### 4.2 Suggestion buckets (`compute_suggestion_buckets`)

Replace `compute_suggestions` (or wrap it). Inputs: `as_of`, classes, activities, logs, rules, recovery_targets, goals, weekly_targets (for context only).

**Algorithm sketch:**

```
for each active activity:
  if logged today (as_of): → bucket=done
  elif goal achieved (activity linked, in live period): → skip do
  elif class type recovery and daily recovery target met: → skip do
  elif class on rest (rest_between_class) or cap violated: → bucket=rest
  elif frequency/consecutive violated: → bucket=rest
  else: → bucket=do

for class-level rest (all activities in class blocked):
  optionally emit one rest row scope=class with description listing activity names (truncate 80)

sort: do by safe state; rest by severity; done by log time
```

**“You're done for today”:** Frontend renders when `do` empty and `rest` non-empty or all quiet — copy only in **Do** section header area, not a fourth bucket.

### 4.3 Goal auto-progress (`services/goals.py`)

```python
def recompute_auto_tracked_goals(session: Session, *, activity_ids: set[str]) -> None:
    ...
```

For each goal with `auto_track_progress` and matching `activity_id`:

- Sum `volume_value` for logs where `volume_unit == goal.progress_unit` and `logged_date` within goal period (monthly/quarterly window ending `target_date`).
- Update `progress_value` from the sum.
- When `auto_track_progress` is true and `progress_value >= progress_target`, set `status` to **`achieved`** (owner C3). Qualitative / manual goals unchanged.

### 4.4 Load risk summary (`services/dashboard.py` + `load_engine.py`)

**Week strip:** For each of last 7 days ending `as_of`:

- `flagged = any(cap_breach_on_day) OR delayed_tax_elevated_on_day`

**Class bars:** For each performance class with at least one enabled cap rule:

- Compute `actual` vs `limit` for primary cap metric (priority: volume cap in km/min if rule exists, else session frequency, else load cap).
- Exclude class when no enabled cap rules and class `type == recovery` (or performance with zero caps).

**Exercise bars (nested):** For activities logged in rolling 7-day window:

- Use exercise-level cap if exists else inherit class cap for same metric.

Delayed-tax integration: reuse `detect_delayed_tax` proactive hits for day flags; do not duplicate baseline math in dashboard service.

### 4.5 Drop cross-class rules

- `check_violations`: remove `_violations_weekly_activity_count` branch (or guard with never-enabled).
- Router validation: reject create.
- Existing DB rows: migration sets `enabled=false`.

### 4.6 Class status compute

Extend `compute_class_statuses` to use full rule set (frequency, consecutive, rest, volume/load caps) so `class_statuses` aligns with suggestion buckets.

### 4.7 Incident body parts

Extend client-side chip source:

- Unique `body_part` from `flare_up_incidents` **and** check-ins where `has_flare_up` (embedded flare body part).
- No schema change.

---

## 5. Frontend design

### 5.1 Component map

| Screen / component | Change |
| --- | --- |
| `GoalEditorScreen` | Sticky bottom CTA; activity radio list (required for auto-track); auto-track toggle; remove header Save |
| `LogActivityScreen` | Date field + calendar modal; pass `loggedDate` in draft |
| `EditLogScreen` | New stack screen or reuse `LogActivityScreen` with `logId` prop |
| `LogHistoryScreen` | Edit button per row → push edit screen |
| `EditBlockRulesScreen` | Restructure by class; weekly target edit inline; add class/exercise rule with class picker; fix `createRule` to pass `activityClassId` |
| `SuggestedActivityCard` | Consume `bucket`; three sections + empty Do copy |
| `LoadRiskSection` | Week strip + class bars + expand/collapse exercises |
| `DashboardScreen` | New `GoalsCard` composite; wire new payloads |
| `useMilestoneEngine` | `submitLog`/`updateLog` with date; `updateGoal` new fields; `patchActivityLog` mutation |
| Activity class settings | Edit name/type; delete with confirm |

### 5.2 State ownership (`frontend-state-decision`)

- `loggedDate` — local state on log/edit screens; default `engine.todayDate`.
- Edit Rules weekly targets — use existing `weeklyTargets` query + `createWeeklyTarget` / `patchWeeklyTarget` mutations (add to hook if missing).
- Load risk expand — local `expandedClassId` on `LoadRiskSection` (page-local).

### 5.3 Patterns

- Sticky bottom CTA: reuse Stage 2.1 bottom inset token / tab-bar padding.
- Calendar modal: new shared `DatePickerModal` in `components/ui/` if none exists.

---

## 6. Testing strategy (`test-strategy-decision`)

| Layer | Focus |
| --- | --- |
| **Unit** | `effective_rules_for_activity`, `compute_suggestion_buckets`, goal recompute sum, load risk actual/limit |
| **Integration** | Dashboard API with backdated log changes suggestions; PATCH log changes goal progress; exercise rule overrides class; DELETE class blocked when logs exist |
| **Frontend** | GoalEditor sticky save; LogHistory edit navigates; SuggestedActivityCard buckets; LoadRisk expand |
| **Manual (owner)** | Retroactive log → dashboard updates; Edit Rules add exercise cap → suggestions change |

Target: existing `make test` gates; no coverage regression.

---

## 7. Suggested ticket order (for planner)

Owner priority P1: **1 → 2 → 3 → 4 → 5**

| Phase | Tickets (draft IDs) |
| --- | --- |
| **Backend foundation** | S25.B1 Alembic + models; S25.B2 rule validation + drop cross-class; S25.B3 goal auto-progress service |
| **Engine** | S25.B4 rule precedence + extended class status; S25.B5 suggestion buckets; S25.B6 load risk summary |
| **API** | S25.B7 dashboard schema extension; S25.B8 activity class delete |
| **Frontend 1 — Goals** | S25.F1 GoalEditor UX + activity link; S25.F2 Goals dashboard card |
| **Frontend 2 — Logs** | S25.F3 date picker create; S25.F4 edit log flow |
| **Frontend 3 — Rules UI** | S25.F5 EditBlockRules restructure + weekly targets edit |
| **Frontend 4 — Suggestions** | S25.F6 SuggestedActivityCard buckets |
| **Frontend 5 — Load risk** | S25.F7 LoadRiskSection redesign |
| **Polish** | S25.F8 activity class edit/delete; S25.F9 incident body-part chips; S25.D1 docs + BACKLOG |

Each ticket: tests before code per `AGENTS.md`.

---

## 8. Files likely touched

**Backend:** `backend/app/models/{goal,block}.py`, `backend/alembic/versions/`, `backend/app/services/{load_engine,dashboard,goals,activity_logs,rules,activity_classes}.py`, `backend/app/schemas/{dashboard,goals,load}.py`, `backend/app/routers/`, `backend/app/tests/`

**Frontend:** `frontend/src/components/screens/{GoalEditor,LogActivity,LogHistory,EditBlockRules,Dashboard}*.tsx`, `frontend/src/components/composites/{SuggestedActivityCard,LoadRiskSection,GoalsCard}.tsx`, `frontend/src/hooks/useMilestoneEngine.ts`, `frontend/src/lib/api/*`, `frontend/src/types.ts`

**Docs:** `docs/api-map.md`, `docs/database-schema.md`, `plans/BACKLOG.md`, `AGENTS.md` sprint pointer when implementation starts

---

## 9. Architecture boundary check

| Rule | Status |
| --- | --- |
| No business logic in routers | ✓ services own engine + recompute |
| Alembic for schema | ✓ |
| Config via settings | ✓ no new env |
| `mypy --strict` / `tsc` | Required |
| No `any` | Required |

---

## 10. Decision record

No separate `plans/decision-*.md` — choices captured in feature brief owner table.

---

**Final status:** `SIGNED OFF` — tickets in `plans/tickets-stage-2-5-usage-logic-2026-06-06.md`; owner confirmations C1–C4 locked 2026-06-06.
