# Stage 2.5 — Usage Logic & Block Clarity Tickets

*Source: `AGENTS.md`, `agents/planner.md`, `plans/feature-brief-stage-2-5-usage-logic-2026-06-06.md`,
`plans/technical-design-stage-2-5-usage-logic-2026-06-06.md`, `DESIGN.md`, `docs/patterns.md`,
`docs/api-map.md`, `docs/database-schema.md` | Date: 2026-06-06*

---

## Owner decisions locked (2026-06-06)

| # | Topic | Decision |
| --- | --- | --- |
| P1 | Batch priority order | Goals → Logs → Block rules → Suggestions → Load risk → polish |
| P2 | Migrations | Approved for `goals`, `rules`; cross-class rules disabled in migration |
| P3 | Edit existing logs | In scope (same form + date picker) |
| Q4 | Weekly targets vs caps | **Option A** — separate `weekly_targets` table; unified Edit Rules UI |
| R4 | Cross-class rules | Dropped from UI and engine |
| G2-A | Goal link | `activity_id` primary link (not class-only) |
| G4 | Auto-track | Opt-in `auto_track_progress`, default `false` |
| G6 | Dashboard goals | Compact card with fill bars / status pills; achieved goals visible |
| L2 | Log dates | Past/today only; no future; no rear boundary |
| LR4 | Load risk navigation | Expand dropdown only — no link to Edit Rules |
| S5 | Rest bucket | Class-level title when whole class blocked; exercise-level when individual |
| S6 | Empty Do section | “You're done for today” only when Do list empty |
| C1 | `InlineLogSheet` | **Today-only** — no date picker on dashboard quick-log |
| C2 | Delete activity class | **409** if any activity has logs; cascade-delete unlogged activities with **two-step** confirm UI |
| C3 | Auto-track achieved | When `progress_value >= progress_target`, set `status` to **achieved** |
| C4 | Legacy `suggestions` API | **Remove** on this feature branch in **S25.F6** (with `suggestion_buckets` only) |

### Hard constraints (from `AGENTS.md`)

- Tests before code per implementation ticket.
- No business logic in routers; services own engine, validation, recompute.
- Schema changes **only** via Alembic (`S25.B1`).
- No `any` in TypeScript; `mypy --strict` for backend.
- One ticket at a time: Test Writer → Implementer → Reviewer.
- Branch: `feat/stage-2-5-usage-logic` (or per-ticket `feat/s25-*`).

---

## Scope summary

| Area | Tickets |
| --- | --- |
| Schema + models | S25.B1 |
| Rule validation + cross-class removal | S25.B2 |
| Goal auto-progress + goal API | S25.B3 |
| Rule precedence + class status | S25.B4 |
| Suggestion buckets engine | S25.B5 |
| Load risk summary engine | S25.B6 |
| Dashboard API extension | S25.B7 |
| Activity class DELETE | S25.B8 |
| Log date validation + recompute hook | S25.B9 |
| Goal editor UX + activity link | S25.F1 |
| Goals dashboard card | S25.F2 |
| Log date picker (create) | S25.F3 |
| Edit log flow | S25.F4 |
| Edit Rules UI + weekly targets | S25.F5 |
| SuggestedActivityCard buckets | S25.F6 |
| LoadRiskSection redesign | S25.F7 |
| Activity class edit/delete UI | S25.F8 |
| Incident + check-in body-part chips | S25.F9 |
| Docs + sprint pointer | S25.D1 |
| Owner smoke | O25.1 |

---

## Ticket ordering rationale

1. **S25.B1** — Schema foundation; all later backend/frontend goal and rule work depends on new columns.
2. **S25.B2** — Rule create validation and cross-class deprecation before precedence engine assumes class-scoped rules only.
3. **S25.B3** — Goal auto-progress service + extended goal schemas; needed before dashboard `goal_rows` and F1/F2.
4. **S25.B4** — `effective_rules_for_activity` and extended `compute_class_statuses`; prerequisite for B5, B6, B7.
5. **S25.B5 → S25.B6** — Suggestion buckets and load risk summary (parallel engine work after B4).
6. **S25.B7** — Wire new engine outputs into `GET /api/dashboard`; frontend dashboard tickets depend on this.
7. **S25.B8** — Activity class delete (independent; before F8).
8. **S25.B9** — Log `logged_date` validation + shared recompute after log CRUD; before F3/F4 and integrates B3 goal recompute.
9. **S25.F1 → S25.F2** — Owner priority **1** (Goals): editor then dashboard card.
10. **S25.F3 → S25.F4** — Owner priority **2** (Logs): create date then edit flow.
11. **S25.F5** — Owner priority **3** (Block rules UI); can start after B2 (rule API) but full value after B4.
12. **S25.F6 → S25.F7** — Owner priorities **4–5** (Suggestions + Load risk); require B7 payloads.
13. **S25.F8 → S25.F9** — Polish items (class editor, incident chips).
14. **S25.D1** — Docs after implementation contracts are stable.
15. **O25.1** — Owner acceptance on production after batch (or per milestone).

**API cut (C4):** **S25.B7** adds `suggestion_buckets` only; **S25.F6** removes legacy `suggestions` from `DashboardRead`, hook, mappers, and all frontend consumers on this feature branch.

---

## S25.B1 — Alembic: goals + rules schema extensions

**Type:** backend + migration + docs  
**Depends on:** none  
**Blocks:** S25.B2, S25.B3, S25.F1  
**Reuse:** `backend/app/models/goal.py`, `backend/app/models/block.py` (`Rule`), `backend/alembic/versions/`, `backend/app/tests/test_models_schema.py`, `docs/database-schema.md`

### Acceptance criteria

- Alembic revision adds:
  - `goals.activity_id` — nullable `VARCHAR` FK → `activities.id`
  - `goals.auto_track_progress` — `BOOLEAN NOT NULL DEFAULT FALSE`
  - `rules.activity_id` — nullable `VARCHAR` FK → `activities.id`
  - `rules.limit_unit` — nullable `VARCHAR` (optional display/compute hint)
- SQLModel models updated with matching fields and relationships where appropriate.
- Migration runs clean on SQLite (local) and Postgres (CI/prod).
- `test_models_schema.py` updated to assert new columns and FKs exist.
- `docs/database-schema.md` documents new columns and semantics (reference feature brief §2.1–2.2).

### Edge cases

- Existing goal rows: `activity_id` null, `auto_track_progress` false.
- Existing rule rows: `activity_id` null (class-scoped legacy).
- No application logic changes in this ticket — schema + models only.

### Patterns

- `AGENTS.md` constraint 6 — Alembic only; no raw DDL outside migration.

---

## S25.B2 — Rule validation + deprecate cross-class rules

**Type:** backend + tests  
**Depends on:** S25.B1  
**Blocks:** S25.B4, S25.B5, S25.F5  
**Reuse:** `backend/app/services/rules.py`, `backend/app/routers/training_blocks.py` (rules routes), `backend/app/tests/test_rules_api.py`, `backend/app/services/load_engine.py` (`check_violations`, `_violations_weekly_activity_count`)

### Acceptance criteria

- **`POST /api/training-blocks/{block_id}/rules`** rejects:
  - `rule_type == "weekly_activity_count"` with `422` and clear message.
  - New rules with `activity_class_id` null (except no new creates without class).
  - `activity_id` set when activity does not belong to `activity_class_id`.
- **`PATCH /api/rules/{id}`** accepts optional `activity_id` and `limit_unit`; validates activity/class consistency.
- Alembic data migration step (or separate revision in B1): existing `weekly_activity_count` rules set `enabled = false`.
- `check_violations` / load engine: `_violations_weekly_activity_count` branch removed or permanently guarded so cross-class rules never surface violations.
- Tests: create cross-class rule returns 422; create exercise rule with wrong class returns 422; disabled legacy cross-class rule produces no violations.

### Edge cases

- PATCH legacy cross-class rule: allowed for idempotency but cannot re-enable via API (or PATCH rejects `enabled: true` for that type).
- Exercise rule without `activity_class_id`: rejected on create.

### Patterns

- Validation in `services/rules.py`; router catches service errors → HTTP status only.

---

## S25.B3 — Goal auto-progress service + goal API extension

**Type:** backend + tests  
**Depends on:** S25.B1  
**Blocks:** S25.B7, S25.B9, S25.F1, S25.F2  
**Reuse:** `backend/app/services/goals.py`, `backend/app/schemas/goals.py`, `backend/app/routers/goals.py`, `backend/app/models/goal.py`, `backend/app/tests/test_goals_api.py`

### Acceptance criteria

- Implement `recompute_auto_tracked_goals(session, *, activity_ids: set[str])` in `services/goals.py`:
  - For each goal with `auto_track_progress == true` and matching `activity_id`:
  - Sum `volume_value` from `activity_logs` where `volume_unit == goal.progress_unit` and `logged_date` within goal period window (monthly/quarterly ending `target_date`).
  - Update `progress_value` from the sum.
  - When `progress_value >= progress_target`, set `status` to **`achieved`** (owner **C3**). Qualitative / non-auto-track goals unchanged.
- **`POST /api/goals` / `PATCH /api/goals/{id}`** accept `activity_id` and `auto_track_progress` (default false on create).
- Service validation: if `auto_track_progress` is true, require `activity_id`, `progress_target`, and `progress_unit`.
- On goal write: when `activity_id` set, denormalize `activity_class_id` from activity row (backwards compatibility).
- Read shape (`GoalRead`) includes new fields.
- Unit tests: sum across period; unit mismatch ignored; qualitative goal untouched; auto-track goal sets `achieved` when target met; log delete reducing sum below target does not auto-revert status (manual reset only).

### Edge cases

- Goal with `auto_track_progress` true but no matching logs → `progress_value` 0 or null per existing convention.
- PATCH disables auto-track → `progress_value` left as last computed (no wipe).
- Logs with mixed units only count matching `progress_unit`.

### Patterns

- `docs/patterns.md` — business logic in services, not routers.

---

## S25.B4 — Rule precedence + extended class statuses

**Type:** backend + tests  
**Depends on:** S25.B2  
**Blocks:** S25.B5, S25.B6, S25.B7  
**Reuse:** `backend/app/services/load_engine.py` (`compute_class_statuses`, `check_violations`), `backend/app/tests/test_load_engine.py`

### Acceptance criteria

- New helper `effective_rules_for_activity(activity_id, class_id, rules) -> list[RuleDict]`:
  - Per `rule_type` + metric: exercise-level enabled rule **wins** over class-level; else class; else no limit.
- `compute_class_statuses` uses full rule set (frequency, consecutive, rest_between_class, weekly_load_cap, volume caps) aligned with effective rules — not delayed-tax hits alone.
- Class with **no enabled cap rules** and `type == recovery` → status reflects recovery semantics; no false danger from missing caps.
- Unit tests: exercise cap stricter than class; class cap when no exercise rule; no cap → unlimited (no violation).

### Edge cases

- Multiple rules same type at exercise level: use strictest threshold (document choice in test).
- Disabled rules ignored.
- Activity inactive: excluded from status computation (existing behaviour preserved).

---

## S25.B5 — Suggestion buckets engine

**Type:** backend + tests  
**Depends on:** S25.B4  
**Blocks:** S25.B7, S25.F6  
**Reuse:** `backend/app/services/load_engine.py` (`compute_suggestions` → `compute_suggestion_buckets`), `backend/app/schemas/load.py` (`SuggestionRead`), `backend/app/tests/test_load_engine.py`, `backend/app/tests/test_dashboard_service.py`

### Acceptance criteria

- Implement `compute_suggestion_buckets(as_of, classes, activities, logs, rules, recovery_targets, goals, weekly_targets)` returning suggestions with `bucket: "do" | "rest" | "done"`.
- Each row includes: existing fields (`id`, `label`, `state`, `reason`, `next_safe_date`, `last_done_date`) plus `bucket`, `scope: "activity" | "class"`, `activity_class_id`, `description` (rest copy; class listings truncated to 80 chars).
- Algorithm (per technical design §4.2):
  - Logged today → `done`.
  - Goal achieved in live period for linked activity → excluded from `do`.
  - Recovery class with daily target met → excluded from `do`.
  - Class rest / cap / frequency / consecutive violated → `rest`.
  - Else → `do`.
  - Class-level rest: optional single row `scope=class` with activity names in `description` (80-char truncate).
- Sort: `do` by safe state; `rest` by severity; `done` by log time.
- Unit tests: walk logged today not in `do`; class rest blacklists class; achieved goal activity skipped; recovery target unmet still in `do`.

### Edge cases

- No active block: empty buckets or safe defaults (match current dashboard behaviour).
- Multiple logs same activity today → one `done` row.
- Performance class with no caps → activities can appear in `do` unless logged today.

---

## S25.B6 — Load risk summary computation

**Type:** backend + tests  
**Depends on:** S25.B4  
**Blocks:** S25.B7, S25.F7  
**Reuse:** `backend/app/services/load_engine.py`, `backend/app/services/load_queries.py` (`detect_delayed_tax`, `get_delayed_tax`), `backend/app/services/dashboard.py`, `backend/app/tests/test_load_engine.py`, `backend/app/tests/test_dashboard_service.py`

### Acceptance criteria

- Implement `compute_load_risk_summary(as_of, classes, activities, logs, rules, delayed_tax_hits)` returning:
  - `week_days`: last 7 days ending `as_of`; each `{ date, flagged }` where `flagged = cap_breach_on_day OR delayed_tax_elevated_on_day`.
  - `class_bars`: one entry per performance class with ≥1 enabled cap rule; `{ class_id, class_name, actual, limit, unit, exercises[] }`.
  - `exercises[]`: activities with logs in rolling 7-day window; exercise cap if exists else inherit class cap; `{ activity_id, activity_name, actual, limit, unit }`.
- **Exclude** recovery/no-impact classes with zero enabled cap rules entirely.
- Primary cap metric priority: volume (km/min) if rule exists → session frequency → load cap.
- Reuse `detect_delayed_tax` for day flags — do not duplicate baseline math in dashboard service.
- Unit tests: uncapped recovery class omitted; class bar `actual/limit` correct; exercise override; day flagged on cap breach.

### Edge cases

- `limit` zero or missing → treat as unlimited (omit bar).
- Class with caps but no logs this week → `actual` 0, bar still shown if capped.
- Delayed tax day without cap breach → still `flagged=true`.

---

## S25.B7 — Dashboard API extension

**Type:** backend + tests  
**Depends on:** S25.B3, S25.B5, S25.B6  
**Blocks:** S25.F2, S25.F6, S25.F7  
**Reuse:** `backend/app/services/dashboard.py`, `backend/app/schemas/dashboard.py`, `backend/app/routers/dashboard.py`, `backend/app/tests/test_dashboard_api.py`, `backend/app/tests/test_dashboard_service.py`, `docs/api-map.md`

### Acceptance criteria

- Extend `DashboardRead` with:
  - `suggestion_buckets: list[SuggestionRead]` (with `bucket`, `scope`, `description` fields).
  - `goal_rows: list[GoalDashboardRowRead]` — `{ goal_id, title, status, activity_id, progress_value, progress_target, progress_unit, fill_ratio, is_qualitative }`.
  - `load_risk_summary: LoadRiskSummaryRead | None`.
- `goal_rows`: all goals (active, achieved, paused, missed); `fill_ratio` 0..1 for numeric; null for qualitative; `is_qualitative` when no numeric target.
- `get_dashboard` service wires B5 + B6 + goal row builder.
- Do **not** populate legacy `suggestions` — field removed in **S25.F6** per owner **C4** (B7 may land first on branch; F6 completes removal).
- `weekly_progress` retained unchanged.
- Integration test: backdated log via API changes `suggestion_buckets` and `load_risk_summary` on subsequent dashboard fetch.
- Update `docs/api-map.md` dashboard response section.

### Edge cases

- No active block → `load_risk_summary` null or empty structure (document and test one behaviour).
- No goals → `goal_rows` empty array.

---

## S25.B8 — Activity class DELETE endpoint

**Type:** backend + tests  
**Depends on:** S25.B1 (optional)  
**Blocks:** S25.F8  
**Reuse:** `backend/app/services/activity_classes.py`, `backend/app/services/activities.py`, `backend/app/routers/activity_classes.py`, `backend/app/tests/test_activity_classes_api.py`, `docs/api-map.md`

### Acceptance criteria

- **`DELETE /api/activity-classes/{class_id}`** via `delete_activity_class(session, class_id)`:
  - Returns **`409`** when any activity in the class has `activity_logs` (clear message naming blocking constraint).
  - When class has **no logged activities** (including class with zero activities): returns **`204`** and deletes the class.
  - When class has activities but **none** have logs: **cascade-delete** all activities in the class, then delete the class — single DB transaction (owner **C2**).
- Router thin — no business logic.
- Tests: delete empty class succeeds; delete class with unlogged activities cascades (activities gone, class gone); delete class with one logged activity returns 409 and no rows removed.
- `docs/api-map.md` documents DELETE and cascade behaviour.

### Edge cases

- Class referenced by goals/rules/targets: service rejects with `409` and message, or documents safe cascade — prefer **409** if FK would orphan goals; test and document.
- Inactive activities without logs: included in cascade delete.

---

## S25.B9 — Log date validation + derived-state recompute

**Type:** backend + tests  
**Depends on:** S25.B3  
**Blocks:** S25.F3, S25.F4  
**Reuse:** `backend/app/services/activity_logs.py`, `backend/app/schemas/activity_logs.py`, `backend/app/routers/activity_logs.py`, `backend/app/tests/test_activity_logs_api.py`, existing recovery streak recalc hooks

### Acceptance criteria

- **`POST /api/activity-logs` / `PATCH /api/activity-logs/{id}`** validate `logged_date <= today` (user-local date or server `as_of` — match existing dashboard `as_of` convention).
- Reject future `logged_date` with `422`.
- Shared `recompute_derived_state(session, *, activity_ids: set[str], anchor_date: date)` (or equivalent) called after create/update/delete:
  - `recompute_auto_tracked_goals` for affected activities (B3).
  - Existing recovery streak recalculation (preserve current behaviour).
  - Any review-milestone hooks already on log create — preserve.
- PATCH `logged_date` changing week boundaries triggers correct goal sums and dashboard derivations (integration test).
- DELETE log triggers recompute for that activity.

### Edge cases

- PATCH changing `activity_id` → recompute both old and new activity ids.
- Timezone: use date-only fields consistently (UTC storage per existing pattern).

---

## S25.F1 — Goal editor: sticky save + activity link + auto-track

**Type:** frontend + tests  
**Depends on:** S25.B1, S25.B3  
**Blocks:** S25.F2  
**Reuse:** `GoalEditorScreen.tsx`, `GoalsScreen.tsx`, `useMilestoneEngine.ts` (`GoalDraft`, `GoalPatch`, `createGoal`, `updateGoal`), `frontend/src/lib/api/goals.ts`, `frontend/src/lib/api/mappers.ts`, `frontend/src/types.ts`, Stage 2.1 bottom inset (`bottom-action-bar` / safe-bottom pattern)

### Acceptance criteria

- Remove Save/Create from header; add **sticky bottom** primary CTA (`Save` / `Create`) using same bottom inset pattern as S2.1 (`safe-bottom` on stack overlay — no tab bar).
- Replace class-only picker with **activity radio list** grouped by class (reuse activity grouping pattern from `LogActivityScreen`).
- Add **Track automatically** toggle (`auto_track_progress`), default **off** on new goals.
- Validation UX: when auto-track on, require selected activity + numeric target + unit; show inline message if missing.
- Activity required when auto-track on OR numeric progress target set; optional for qualitative-only goals.
- `GoalDraft` / `GoalPatch` / mappers include `activityId`, `autoTrackProgress`.
- On create/update, send `activity_id`; denormalized class sent only if API still accepts `activity_class_id` on client (prefer activity as source of truth).
- Tests: sticky CTA has bottom inset test id/class; auto-track toggle defaults off; cannot save with auto-track without activity.

### Edge cases

- Edit existing goal with only `activityClassId` legacy: show pre-selected activity if mappable, else show class group with no selection until user picks.
- Long activity list scrolls; CTA stays pinned.

---

## S25.F2 — Goals dashboard card

**Type:** frontend + tests  
**Depends on:** S25.B7, S25.F1  
**Reuse:** `DashboardScreen.tsx`, new `components/composites/GoalsCard.tsx`, `LoadRiskSection.tsx` (visual reference for card chrome), `useMilestoneEngine.ts`, dashboard mappers for `goal_rows`

### Acceptance criteria

- New `GoalsCard` on Dashboard (placement: owner priority — below weekly progress or above suggestions; match `LoadRiskSection` card pattern).
- Consumes `dashboard.goalRows` (or mapped field from engine).
- Each row: goal title + horizontal **fill bar** when numeric (`fill_ratio`); **status pill** when qualitative (`is_qualitative`).
- Show **achieved** goals with subdued styling (still visible).
- Empty state: hide card or show “No goals yet” with link to Goals tab — pick compact hide when empty.
- `GoalsCard.test.tsx`: numeric bar width reflects ratio; qualitative shows pill; achieved row rendered.
- Types: extend `DashboardPayload` / mappers for `goal_rows`; no `any`.

### Edge cases

- `fill_ratio > 1` → bar capped at 100% visually (overflow optional subtle indicator).
- Many goals → card scrollable internally or max-height with scroll.

---

## S25.F3 — Log date picker (create flow)

**Type:** frontend + tests  
**Depends on:** S25.B9  
**Blocks:** S25.F4  
**Reuse:** `LogActivityScreen.tsx`, `useMilestoneEngine.ts` (`LogDraft`, `submitLog`), `createActivityLog` mapper, new `components/ui/DatePickerModal.tsx`

### Acceptance criteria

- Add shared `DatePickerModal`: calendar UI, `maxDate = today`, no future selection.
- `LogActivityScreen`: date field showing default `engine.todayDate`; tap opens modal; selected date stored in local state.
- Extend `LogDraft` with `loggedDate: ISODate`; `submitLog` passes to `createActivityLog`.
- Mapper sends `logged_date` snake_case to API.
- Display formatted date label (e.g. “Today” when equals `todayDate`, else long date).
- Tests: default today; selecting past date submits that date in API body; future date not selectable.
- `LogActivityScreen.test.tsx` updated.

### Edge cases

- **`InlineLogSheet`** (dashboard quick-log): **today-only** per owner **C1** — continues to log `engine.todayDate`; no date picker.
- Invalid date from API error surfaced on submit.

### Patterns

- Local `loggedDate` state on screen; default `engine.todayDate` (`frontend-state-decision`).

---

## S25.F4 — Edit log flow

**Type:** frontend + full-stack wiring + tests  
**Depends on:** S25.F3, S25.B9  
**Reuse:** `LogHistoryScreen.tsx`, `LogActivityScreen.tsx` (reuse with `logId` prop), `patchActivityLog` in `frontend/src/lib/api/activityLogs.ts`, `App.tsx` stack routing, `useMilestoneEngine.ts`

### Acceptance criteria

- `LogHistoryScreen`: **Edit** button per row → pushes stack screen (reuse `LogActivityScreen` with `logId` + `initialLog` or fetch by id from `engine.logs`).
- Edit form pre-fills activity, volume, RPE, feel, notes, **logged date** (F3 picker).
- Hook exposes `updateLog(logId, patch)` wrapping `patchActivityLog`; invalidates dashboard + logs queries on success.
- Save calls PATCH; success pops stack and refreshes history.
- Tests: Edit navigates with correct log id; save calls patch with changed `loggedDate`; history list updates after mutation.
- `App.tsx`: register stack route `edit-log` or reuse `log-activity` with edit mode + Back behaviour.

### Edge cases

- Edit activity to different class: allowed (same as create).
- Concurrent delete: show API error.
- Changing date on old log updates dashboard on return (depends on B9 recompute — manual assertion in test with mocked refetch).

---

## S25.F5 — Edit Block Rules: class sections + weekly targets + exercise rules

**Type:** frontend + hook + tests  
**Depends on:** S25.B2, S25.B4 (for meaningful cap labels)  
**Reuse:** `EditBlockRulesScreen.tsx`, `useMilestoneEngine.ts`, `frontend/src/lib/api/weeklyTargets.ts` (`createWeeklyTarget`, `patchWeeklyTarget`), `createRule` / rules API, `SettingsScreen.tsx` weekly target read-only section (reference)

### Acceptance criteria

- Restructure UI per class (performance classes first, then recovery):
  ```
  [Class: Foot load]
    Caps — list class-level rules
    Weekly goal — editable target_value + unit (not read-only)
    Exercises — per-activity rules indented
    [+ Add class cap]  [+ Add exercise rule]
  ```
- Fix `createRule` calls to always pass `activityClassId` (no more null class rules).
- Add exercise rule flow: pick activity within class → rule type + threshold.
- Hook mutations: `createWeeklyTarget`, `patchWeeklyTarget` (add if missing); invalidate rules + weeklyTargets + dashboard.
- Empty cap section copy: “No limits — unlimited for this class.”
- No cross-class rule types in UI.
- Tests: render class section; add exercise rule POST body includes `activity_class_id` + `activity_id`; weekly target edit calls PATCH.

### Edge cases

- Class with no rules and no weekly target: show add CTAs only.
- Recovery class: weekly goal section optional/hidden if not applicable (weekly targets are performance-class oriented — hide for recovery classes unless row exists).
- API error on duplicate rule: surface message.

---

## S25.F6 — SuggestedActivityCard: do / rest / done buckets

**Type:** frontend + tests  
**Depends on:** S25.B7  
**Reuse:** `SuggestedActivityCard.tsx`, `DashboardScreen.tsx`, `useMilestoneEngine.ts`, `frontend/src/types.ts` (`Suggestion` type), mappers for `suggestion_buckets`

### Acceptance criteria

- Consume `suggestion_buckets` only; **remove** legacy `suggestions` from `DashboardRead`, `useMilestoneEngine`, mappers, and types (owner **C4**).
- Three sections:
  - **Do these today** — `bucket === "do"`; existing safe/caution/danger grouping preserved within section.
  - **Rest these today** — `bucket === "rest"`; class-scope rows show class name as title + description; activity-scope rows show activity name + reason.
  - **Done today** — `bucket === "done"`; informational tone.
- When `do` empty and (`rest` non-empty OR all quiet): show **“You're done for today”** copy in Do section area only (not when `do` non-empty).
- Remove client-side filtering that duplicates engine logic (if any).
- Tests: three sections render; done activity not in do; empty do shows done copy; class rest row shows truncated description.
- Remove `suggestions` from `backend/app/schemas/dashboard.py` and dashboard service assembly in this ticket.
- Update `App.test.tsx`, dashboard API tests, and hook tests for `suggestion_buckets` only.

### Edge cases

- All buckets empty: sensible empty state.
- `InlineLogSheet` CTA still opens from `do` suggestion rows.

---

## S25.F7 — LoadRiskSection redesign

**Type:** frontend + tests  
**Depends on:** S25.B7  
**Reuse:** `LoadRiskSection.tsx`, `DashboardScreen.tsx`, `DelayedTaxAttributionSection.tsx` (keep or integrate), mappers for `load_risk_summary`

### Acceptance criteria

- Replace/adjust current load-risk UI to use `load_risk_summary`:
  - **7-day strip**: coloured day blocks, `flagged` from API; no text labels on strip (per LR1).
  - **Class rows**: one progress bar per capped class; label shows `actual / limit` + unit (LR3).
  - **Expand**: tap class row toggles `expandedClassId` local state; shows nested exercise bars (description-sized titles, visible bar per exercise).
  - Description under class title lists exercises close to/over target (from API or derived).
- Omit recovery/no-impact uncapped classes entirely.
- **No** navigation to Edit Rules on tap (LR4).
- Tests: strip renders 7 cells; expand shows exercise bars; uncapped class not rendered.
- `weekly_progress` section on Dashboard unchanged (aspirational targets separate).

### Edge cases

- `load_risk_summary` null: hide section or show “No load caps configured”.
- Long exercise list scrolls within expanded panel.

---

## S25.F8 — Activity class edit + delete (Settings)

**Type:** frontend + tests  
**Depends on:** S25.B8  
**Reuse:** `SettingsScreen.tsx`, `NewActivityClassForm`, `patchActivityClass` API, new delete mutation, `useMilestoneEngine.ts`

### Acceptance criteria

- Per class row in Settings → Activities: **Edit** (inline sheet or stack) for **rename** + **type** (`performance` | `recovery`) via PATCH.
- **Delete** — two-step confirmation (owner **C2**):
  1. **Step 1:** “Delete class?” → **Cancel** / **Delete**.
  2. **Step 2** (only if class has activities with no logs): list each activity name; copy states they **will be deleted** if user continues → **Cancel** / **Delete**.
  - Step 2 skipped when class has no activities (go straight to DELETE after step 1).
  - On success: invalidate dashboard + activity class queries.
  - On **409** (activities have logs): show API message; no cascade.
- Tests: edit PATCH body; two-step flow lists activity names; step-2 Delete calls DELETE; 409 when logs exist.

### Edge cases

- User cancels at step 1 or 2 — no API call.
- Only class in block: still deletable when no logs (cascade per B8).

---

## S25.F9 — Body-part chips: incidents + check-ins

**Type:** frontend + hook + tests  
**Depends on:** none (can run late in batch)  
**Reuse:** `LogIncidentScreen.tsx` (`buildIncidentBodyPartSuggestions`), `MorningCheckInScreen.tsx`, `listDailyCheckIns` from `frontend/src/lib/api/dailyCheckIns.ts`, `useMilestoneEngine.ts`

### Acceptance criteria

- Shared helper e.g. `buildBodyPartSuggestions(incidents, checkIns)`:
  - Distinct non-empty `bodyPart` from incidents.
  - Plus `flareUp.bodyPart` from check-ins where `hasFlareUp` (or equivalent mapped field).
  - Trim, case-insensitive dedupe, recent-first ordering.
- Hook: add `checkIns` query via `listDailyCheckIns` (reasonable window e.g. last 365 days or all local) **or** document alternative if dashboard extended — prefer hook query, no backend change.
- `LogIncidentScreen` and `MorningCheckInScreen` use shared helper for suggestion chips.
- Tests: chip from incident; chip from check-in flare; dedupe across sources; empty when no history.

### Edge cases

- Whitespace-only parts excluded.
- Check-in without flare: not included.

### Note

Extends S2.5 incident-only chips to include check-in history per owner **B4**.

---

## S25.D1 — Docs + BACKLOG + sprint pointer

**Type:** docs only  
**Depends on:** S25.B7, S25.F6, S25.F7 (minimum)  
**Reuse:** `docs/api-map.md`, `docs/database-schema.md`, `plans/BACKLOG.md`, `AGENTS.md`

### Acceptance criteria

- `docs/api-map.md` and `docs/database-schema.md` reflect shipped Stage 2.5 contracts (if not fully done in B1/B7/B8).
- `plans/BACKLOG.md` Stage 2.5 section updated: link to ticket file; mark items done as implemented.
- Verify `AGENTS.md` sprint pointer still matches shipped scope (updated at planning sign-off).
- Optional one-line cross-link in `plans/PRD.md` if Stage 2.5 section exists.

### Edge cases

- None.

---

## O25.1 — Owner acceptance smoke (Android Chrome, production)

**Type:** owner-only  
**Depends on:** S25.F1–S25.F9 (minimum); S25.D1  
**Blocks:** Stage 2.5 sign-off

### On production URL (after deploy)

**Goals**
- [ ] New goal: pick activity, enable auto-track, sticky Save at bottom works without scrolling up.
- [ ] Log matching volume → goal progress updates; auto-track goal becomes **achieved** when target met.
- [ ] Qualitative goal shows status pill on dashboard.

**Logging**
- [ ] Log Activity: default today; change to yesterday via calendar; dashboard updates.
- [ ] Log History → Edit → fix date/activity → save; history and dashboard reflect change.

**Block rules**
- [ ] Edit Rules: class caps + weekly goal + exercise rule visible and saveable.
- [ ] Add exercise daily cap → logging over cap moves activity to “Rest these today”.

**Suggestions**
- [ ] Log walk today → walk not in “Do these today”; appears under “Done today”.
- [ ] Class rest rule → class or activities in “Rest these today” with readable reason.

**Load risk**
- [ ] Uncapped recovery class absent from load risk card.
- [ ] Capped class shows actual/limit; expand shows exercise breakdown.

**Polish**
- [ ] Rename activity class in Settings; delete class with unlogged activities uses two-step confirm and removes activities; delete blocked when logs exist.
- [ ] Incident/check-in: body-part chip from prior flare/check-in appears.

### Done when

- [ ] Smoke passed or bugs filed in `plans/BACKLOG.md`.

---

## Owner confirmations (2026-06-06)

| # | Question | **Confirmed decision** |
| --- | --- | --- |
| C1 | `InlineLogSheet` date picker? | **Today-only** — no date picker (S25.F3). |
| C2 | Delete class with unlogged activities? | **Cascade-delete** activities in service; **two-step** confirm UI lists activity names (S25.B8, S25.F8). **409** when any activity has logs. |
| C3 | Auto-track at 100%? | Set `status` to **`achieved`** when `progress_value >= progress_target` (S25.B3). |
| C4 | Legacy `suggestions` field? | **Remove** on this feature branch in **S25.F6** alongside `suggestion_buckets`. |

---

## BACKLOG items addressed by this file

| BACKLOG item | Ticket |
| --- | --- |
| Goal editor Save at top | S25.F1 |
| Goals not linked to activity / auto-progress | S25.B3, S25.F1 |
| Goals dashboard summary | S25.F2 |
| Log date selection | S25.F3 |
| Edit log | S25.F4 |
| Block rules not tied to class/exercise | S25.B2, S25.F5 |
| Weekly volume target editor read-only | S25.F5 |
| Suggestions show already-done activities | S25.B5, S25.F6 |
| Load risk unclear vs caps | S25.B6, S25.F7 |
| Activity class edit/rename/delete | S25.B8, S25.F8 |
| Incident chips from check-in history | S25.F9 |
| Cross-class rules | S25.B2 (removed) |

---

## Planner output

| Item | Value |
| --- | --- |
| **Ticket file** | `plans/tickets-stage-2-5-usage-logic-2026-06-06.md` |
| **Branch** | `feat/stage-2-5-usage-logic` |
| **Ticket count** | 19 implementation + 1 owner smoke |
| **Unresolved** | None — C1–C4 confirmed 2026-06-06 |
| **AGENTS.md** | Updated to Stage 2.5 sprint pointer (2026-06-06) |

**Status: SIGNED OFF** (planner — ready for owner review, then orchestrator per ticket on `feat/stage-2-5-usage-logic`).
