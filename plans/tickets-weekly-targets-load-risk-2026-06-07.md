# Weekly Targets, Load Risk, and Weekly Focus Tickets

*Source: `AGENTS.md`, `agents/planner.md`, `docs/database-schema.md`, `docs/api-map.md`, `docs/patterns.md`, `docs/architecture.md`, `plans/BACKLOG.md`, owner feedback 2026-06-07 | Date: 2026-06-07*

---

## Owner decisions locked

| # | Topic | Decision |
| --- | --- | --- |
| D1 | Dashboard weekly progress cadence | Rename/reframe current `Last 7 days` target card as **This week** using Monday-Sunday completion. |
| D2 | Load risk cadence | Keep **Load risk** as a rolling last-7-days view: today plus the previous six days. |
| D3 | Weekly targets surface | Goals screen gets two actions: **Weekly target** and **Big goal**. Existing goal flow remains the Big goal flow. |
| D4 | Weekly targets scope | Weekly targets can be for recovery activities or any other activity. |
| D5 | Weekly target semantics | Weekly targets are minimums and complete over Monday-Sunday weeks. |
| D6 | Suggestions | Completed weekly targets disappear from Do until the next week; overdue/incomplete targets appear in Do. |
| D7 | Activity source | Activity logs are the source of weekly target progress for now. |
| D8 | Load risk meaning | Load risk should show proximity to rules the user set, not a hidden formula or one arbitrary selected class cap. |
| D9 | Exercise rules | Exercise-scoped rules must not be promoted into class-wide load-risk bars. |
| D10 | Block direction | The current month-style training block concept should move toward weekly focus periods that auto-roll weekly and preserve history. |

## Planning assumption

The ticket set assumes **`weekly_targets` becomes the single user-facing weekly target source**:

- Existing `weekly_targets` already stores weekly target value/unit and feeds dashboard progress, but it is class-scoped.
- Existing `recovery_targets` is activity-scoped but recovery-only, frequency-only, create/list-only, and streak-oriented.
- The cleanest implementation is to extend `weekly_targets` to support activity-scoped targets for any activity, migrate compatible weekly `recovery_targets` into `weekly_targets` as `sessions`, then stop using `recovery_targets` in dashboard/suggestions UI.

This is a schema/API decision. It needs owner approval before implementation because it changes persisted data and contracts.

## Scope summary

| Area | Tickets |
| --- | --- |
| Weekly target schema/API | WTL.B1, WTL.B2 |
| This-week dashboard progress | WTL.B3, WTL.F1 |
| Goals weekly target UX | WTL.F2 |
| Weekly target suggestions | WTL.B4, WTL.F3 |
| Load tax formula + dashboard graph | WTL.B5, WTL.F4 |
| Load risk contract + engine | WTL.B6 |
| Load risk UI | WTL.F5 |
| Recovery streaks cleanup | WTL.F6 |
| Weekly focus replaces block UX | WTL.D1, WTL.B7, WTL.F7 |
| Docs and owner smoke | WTL.D2, OWTL.1 |

## Ticket ordering rationale

1. **WTL.B1** resolves the target data source before backend/UI work depends on it.
2. **WTL.B2** adds the API contract and service behavior for weekly targets.
3. **WTL.B3 → WTL.F1** fixes the dashboard weekly-progress mismatch with the chosen weekly target source.
4. **WTL.F2** adds the Goals weekly target flow after the API exists.
5. **WTL.B4 → WTL.F3** wires weekly targets into suggestions after target progress is reliable.
6. **WTL.B5 → WTL.F4** defines the load-tax calculation and fixes the graph before load-risk UI consumes the same seven-day context.
7. **WTL.B6 → WTL.F5** replaces the confusing load-risk contract and UI in one coherent backend/frontend pass.
8. **WTL.F6** removes old recovery-streak UI after weekly targets become the target surface.
9. **WTL.D1** pauses before replacing training blocks because that is a larger lifecycle/schema change.
10. **WTL.B7 → WTL.F7** implement weekly focus only after the owner signs off the lifecycle decision.
11. **WTL.D2** updates living docs after contracts are stable.
12. **OWTL.1** is owner smoke on local and production-like data.

---

## WTL.B1 — Weekly target schema consolidation

**Type:** backend + migration + docs  
**Depends on:** owner approval of the planning assumption  
**Blocks:** WTL.B2, WTL.B3, WTL.F2, WTL.B4  
**Reuse:** `backend/app/models/block.py`, `backend/alembic/versions/`, `backend/app/tests/test_models_schema.py`, `backend/app/tests/test_migrations.py`, `docs/database-schema.md`

### Acceptance criteria

- Alembic revision extends `weekly_targets` to support activity-scoped weekly targets:
  - Add nullable `activity_id` FK to `activities.id`.
  - Keep `activity_class_id` for legacy class targets and denormalized class lookup.
  - Add `target_kind` or equivalent stored/defaulted value representing `minimum`.
  - Replace/update uniqueness so one active weekly target can exist for the same `training_block_id` + `activity_id`.
- Existing class-scoped `weekly_targets` remain readable.
- Existing weekly `recovery_targets` are migrated into `weekly_targets` where possible:
  - `activity_id` copied.
  - `activity_class_id` derived from the activity.
  - `target_value = target_frequency`.
  - `target_unit = "sessions"`.
  - `target_kind = "minimum"`.
- Existing daily `recovery_targets` are not silently converted; migration leaves them in place and the docs call out that daily recovery streaks are deprecated pending owner decision.
- SQLModel models and relationship tests reflect the new target shape.
- `docs/database-schema.md` explains that `weekly_targets` are the user-facing weekly minimum targets for any activity or legacy class target.

### Edge cases

- If a migrated recovery target conflicts with an existing weekly target for the same activity and block, keep the existing weekly target and do not create a duplicate.
- If a recovery target references a missing activity, leave it untouched and document as legacy data.
- SQLite and Postgres migrations both pass.

### Test strategy

- Migration/schema tests assert new columns, FKs, and uniqueness constraints.
- A migration test covers weekly recovery target conversion to `sessions`.
- A migration test covers conflict behavior.

---

## WTL.B2 — Weekly target API and service behavior

**Type:** backend + tests  
**Depends on:** WTL.B1  
**Blocks:** WTL.B3, WTL.F2, WTL.B4  
**Reuse:** `backend/app/routers/weekly_targets.py`, `backend/app/services/weekly_targets.py`, `backend/app/schemas/weekly_targets.py`, `backend/app/tests/test_weekly_targets_api.py`

### Acceptance criteria

- `GET /api/training-blocks/{block_id}/weekly-targets` returns both legacy class targets and activity-scoped weekly targets.
- `POST /api/training-blocks/{block_id}/weekly-targets` accepts an activity-scoped target:
  - `activity_id`
  - `target_value`
  - `target_unit` (`sessions`, `minutes`, or the activity volume unit such as `km`)
  - optional `target_kind`, defaulting to `minimum`
- Create validates that the activity exists, belongs to the local user, and is active unless editing historical data explicitly requires otherwise.
- Create derives `activity_class_id` from `activity_id`.
- `PATCH /api/weekly-targets/{target_id}` supports editing target value/unit and moving to another activity with class derivation.
- `DELETE /api/weekly-targets/{target_id}` removes a weekly target.
- API rejects unsupported units with `422`.
- API rejects duplicate active weekly targets for the same block/activity with `409`.
- Existing class-scoped weekly targets remain patchable by value/unit, but new UI does not create class-scoped targets.

### Edge cases

- Missing block returns `404`.
- Missing target returns `404`.
- Moving a target to an activity that already has a target in the same block returns `409`.
- `target_value <= 0` returns `422`.

### Test strategy

- API tests cover create, patch, delete, duplicate conflict, wrong unit, inactive activity, and legacy class target readability.
- Service tests cover class derivation and no router-owned business logic.

---

## WTL.B3 — Compute dashboard weekly progress as This Week

**Type:** backend + tests  
**Depends on:** WTL.B2  
**Blocks:** WTL.F1  
**Reuse:** `backend/app/services/load_engine.py` (`compute_weekly_progress`), `backend/app/services/dashboard.py`, `backend/app/services/load_queries.py`, `backend/app/tests/test_load_engine.py`, `backend/app/tests/test_dashboard_service.py`, `backend/app/tests/test_dashboard_api.py`

### Acceptance criteria

- Dashboard `weekly_progress` uses the Monday-Sunday week containing `as_of`, not block start to today.
- For `as_of = Sunday 2026-06-07`, the week window is `2026-06-01` through `2026-06-07`.
- For `as_of = Monday 2026-06-08`, the week window is `2026-06-08` through `2026-06-14`.
- Activity-scoped weekly targets compute progress from logs for that activity only.
- Legacy class-scoped weekly targets compute progress from logs for active activities in that class.
- `sessions` counts logs; `minutes` sums `duration_minutes`; volume units sum matching `volume_unit`.
- Backend response includes enough period metadata for the UI to label the card honestly, either `period_start`/`period_end` on each row or a documented top-level weekly-progress period.

### Edge cases

- Logs before Monday are excluded even if they are inside the last seven rolling days.
- Future days in the same week do not require logs and do not count.
- Logs with mismatched volume units are ignored for volume targets.
- No weekly targets returns an empty array and neutral dashboard copy.

### Test strategy

- Load-engine tests cover Monday boundary, Sunday boundary, activity-scoped counts, minutes, km, and legacy class target behavior.
- Dashboard API/service tests verify the same period and payload metadata.

---

## WTL.F1 — Rename dashboard weekly progress card to This Week

**Type:** frontend + tests  
**Depends on:** WTL.B3  
**Blocks:** none  
**Reuse:** `DashboardScreen.tsx`, existing weekly progress card/component, `frontend/src/lib/api/mappers.ts`, `frontend/src/components/screens/DashboardScreen.test.tsx`

### Acceptance criteria

- Dashboard weekly target/progress section label changes from `Last 7 days` to `This week`.
- Empty copy says `No weekly targets configured.` or equivalent.
- Progress rows display activity names for activity-scoped targets and class names for legacy class targets.
- Progress rows do not imply rolling seven-day behavior.
- Existing visual style is preserved unless the new metadata requires a small label adjustment.

### Edge cases

- No active block/focus: section handles an empty target array gracefully.
- Target is complete: row displays as complete/safe without suggesting extra work.
- Over-complete minimum target does not render as danger.

### Test strategy

- Dashboard tests assert `This week` label and empty copy.
- Mapper tests cover new period metadata and activity-scoped target fields.

---

## WTL.F2 — Goals screen weekly target flow

**Type:** frontend + tests  
**Depends on:** WTL.B2  
**Blocks:** WTL.F3  
**Reuse:** `GoalsScreen.tsx`, `GoalEditorScreen.tsx` only for Big goal flow reference, `useMilestoneEngine.ts`, `frontend/src/lib/api/weeklyTargets.ts`, shared form controls/buttons/cards

### Acceptance criteria

- Goals bottom action area offers two actions:
  - `Weekly target`
  - `Big goal`
- `Big goal` keeps the current goal editor flow.
- `Weekly target` opens a focused editor with:
  - activity picker
  - weekly target value
  - target unit options relevant to that activity (`sessions`, `minutes`, default volume unit where available)
  - save/cancel
- Goals screen shows weekly targets in a distinct `Weekly targets` section.
- Weekly target cards show activity name, current Monday-Sunday progress, target value/unit, and edit/delete actions.
- Deleting a weekly target asks for confirmation.
- Hook exposes create/update/delete weekly target mutations and invalidates weekly targets plus dashboard data.

### Edge cases

- Activity has no default volume unit: offer `sessions` and `minutes`.
- Recovery and performance activities are both selectable.
- Duplicate target API error is shown inline.
- Save failure does not close the editor.

### Test strategy

- Goals screen tests cover the two buttons, editor fields, recovery/performance activity selection, edit, delete confirm, and API error handling.
- Hook tests cover create/update/delete mutation calls and invalidation.

---

## WTL.B4 — Suggestions use weekly target completion

**Type:** backend + tests  
**Depends on:** WTL.B3  
**Blocks:** WTL.F3  
**Reuse:** `backend/app/services/load_engine.py` (`compute_suggestion_buckets`), `backend/app/services/dashboard.py`, `backend/app/tests/test_load_engine.py`, `backend/app/tests/test_dashboard_service.py`

### Acceptance criteria

- Weekly target completion is evaluated for the Monday-Sunday week containing `as_of`.
- Incomplete weekly activity targets appear in the Do bucket unless a stricter rest/load rule puts that activity in Rest.
- Completed weekly targets do not appear in Do until the next Monday.
- The suggestion reason for an incomplete weekly target names the remaining amount, for example `2 sessions left this week` or `3 km left this week`.
- Rest rules still win over target prompts.
- Existing Big goal completion exclusions continue to work.
- Daily recovery-target suggestion logic is removed from the active path or explicitly marked legacy if `recovery_targets` remains in storage.

### Edge cases

- Target is exactly complete: not in Do.
- Target is over-complete: not in Do.
- Activity inactive: not suggested.
- A target for an activity logged today can appear in Done rather than Do.

### Test strategy

- Load-engine tests cover incomplete, complete, over-complete, rest-overrides-target, logged-today, and inactive-activity cases.
- Dashboard service tests verify suggestion payloads include useful reasons/descriptions.

---

## WTL.F3 — Weekly target suggestions UI copy

**Type:** frontend + tests  
**Depends on:** WTL.B4, WTL.F2  
**Blocks:** none  
**Reuse:** `SuggestedActivityCard`, `DashboardScreen.tsx`, suggestion bucket tests

### Acceptance criteria

- Do suggestions for weekly targets clearly show the activity and remaining weekly target amount.
- Completed weekly targets are absent from Do and do not create noisy Done cards unless the activity was logged today.
- Empty Do copy remains calm and accurate when all weekly targets are complete.
- Rest bucket copy still prioritizes safety rules over target pressure.

### Edge cases

- Multiple weekly targets incomplete: cards sort consistently with existing suggestion ordering.
- Target and rule reason both exist: rule reason appears in Rest; target reason appears only when safe to do.

### Test strategy

- Component/screen tests cover target-driven Do cards, completed target absence, and rest override copy.

---

## WTL.B5 — Load-tax formula and dashboard load series

**Type:** backend + API contract + tests  
**Depends on:** current Stage 2.5 rule-scope fixes  
**Blocks:** WTL.F4, WTL.B6  
**Reuse:** `backend/app/services/load_engine.py`, `backend/app/services/dashboard.py`, `backend/app/schemas/load_engine.py`, `backend/app/schemas/dashboard.py`, `backend/app/tests/test_load_engine.py`, `backend/app/tests/test_dashboard_service.py`, `backend/app/tests/test_dashboard_api.py`

### Acceptance criteria

- Replace dashboard graph load values based on raw `volume_value * rpe` with an explicit **load tax** score for performance activities only.
- Recovery activities do not contribute to load tax.
- Each performance log contributes at least a base tax of `1`.
- Session tax combines:
  - base performance session tax.
  - RPE pressure.
  - proximity to relevant class-scoped rule limits.
  - proximity to relevant exercise-scoped rule limits for that activity.
  - rest/consecutive pressure when the log is too close to a prior relevant session.
- Use a recency-weighted rolling seven-day load-tax curve for each plotted day:
  - today contributes at 100%.
  - older days in the seven-day window contribute progressively less.
  - the exact weights are constants in one backend helper and documented in tests.
- Rule proximity taxes are stacked but capped per category so one log cannot explode from duplicate rules of the same type.
- Suggested initial scoring constants:
  - base performance session: `1`.
  - RPE 1-4: `0`; RPE 5-6: `0.5`; RPE 7-8: `1`; RPE 9-10: `2`.
  - rule usage 50-79%: `1`; 80-99%: `2`; at/over cap: `4`.
  - rest rule broken: `4`.
  - consecutive-day limit reached: `3`.
  - recency weights for days 0-6: `1.0`, `0.85`, `0.7`, `0.55`, `0.4`, `0.25`, `0.15`.
- Dashboard `load_series` contains the last 30 days ending on `as_of`.
- Each `load_series` point includes:
  - date.
  - rolling seven-day `load` tax.
  - raw daily `daily_load` tax for that date.
- Backend no longer sends `week_load_threshold = 0` as a meaningful cap for this graph; either omit threshold semantics from graph contract or send `null` when there is no explicit threshold.

### Edge cases

- Logs outside the seven-day rolling window do not affect that point.
- Logs outside the 30-day graph range can still affect early graph points if they fall inside that early point's seven-day window.
- A performance activity with no rules still contributes base + RPE tax.
- A performance activity with disabled rules ignores those rules.
- Volume-cap proximity uses the activity volume unit/duration unit that matches the rule.
- Frequency/cap proximity is calculated as-of the plotted day, not only today.

### Test strategy

- Load-engine tests cover base tax, RPE tiers, rule proximity tiers, rest break tax, consecutive tax, category caps, recovery exclusion, disabled rules, and recency weights.
- Dashboard service/API tests assert the graph spans exactly 30 days and uses load-tax values.
- Regression test covers no `135 / 0` style display contract when no explicit threshold exists.

---

## WTL.F4 — Dashboard load-tax graph

**Type:** frontend + tests  
**Depends on:** WTL.B5  
**Blocks:** none  
**Reuse:** `frontend/src/components/composites/WeeklyLoadGraph.tsx`, `DashboardScreen.tsx`, `frontend/src/lib/api/mappers.ts`, dashboard screen tests

### Acceptance criteria

- Dashboard graph shows the last 30 days ending today/as-of.
- Subtitle reads `Rolling 7-day effort load · last 30 days` or equivalent.
- Graph title still names the graphed performance class where a class is selected.
- Header metric shows the latest rolling load-tax value without `/ 0`.
- Cap line, cap label, and cap legend are hidden when no meaningful threshold exists.
- Graph copy or tooltip explains the formula briefly, for example `Performance sessions weighted by effort, rule pressure, and recency`.
- Existing flare-up markers remain visible.

### Edge cases

- No graph data renders the existing empty chart state.
- Threshold is null/absent: no cap UI renders.
- Threshold is present for a future explicit load-tax threshold: cap UI can render without code churn.
- Mobile x-axis remains legible with 30 points.

### Test strategy

- WeeklyLoadGraph tests cover threshold absent, threshold present, subtitle, latest metric, and flare-up markers.
- Dashboard tests assert the graph subtitle and no `/ 0` display.
- Mapper tests cover nullable threshold or revised graph contract.

---

## WTL.B6 — Load risk rule-limit summary contract

**Type:** backend + API contract + tests  
**Depends on:** current Stage 2.5 rule-scope fixes  
**Blocks:** WTL.F5  
**Reuse:** `backend/app/services/load_engine.py` (`compute_load_risk_summary`), `backend/app/schemas/load_engine.py`, `backend/app/schemas/dashboard.py`, `backend/app/tests/test_load_engine.py`, `backend/app/tests/test_dashboard_service.py`, `backend/app/tests/test_dashboard_api.py`, `docs/api-map.md`

### Acceptance criteria

- `load_risk_summary.week_days` remains a rolling seven-day strip ending on `as_of`.
- Each day in `week_days` includes load-tax state from WTL.B5 (`safe`, `caution`, `danger`) so the strip can show aggregate pressure for that day.
- Load-tax state is used for the seven-day strip only; individual load-risk rows still use direct rule-limit proximity.
- Replace `class_bars` with grouped rule-limit rows, or add a new field and deprecate `class_bars` in the same ticket.
- Each load-risk row represents one enabled rule limit, not one selected primary class cap.
- Class-scoped rows:
  - `frequency_limit`: rolling seven-day class sessions vs max sessions.
  - `consecutive_day_limit`: current class consecutive-day streak vs max days.
  - `rest_between_class`: days since last class session vs required minimum, represented as a status row rather than a misleading fill bar if needed.
  - `weekly_load_cap` remains supported for legacy enabled rows if present.
- Exercise-scoped rows:
  - `weekly_volume_cap`: rolling seven-day activity volume vs cap.
  - `daily_volume_cap`: today activity volume vs cap.
  - `frequency_limit`: rolling seven-day activity sessions vs cap if exercise-scoped frequency rules exist.
- Exercise-scoped rules never become class-wide rows.
- Rows include stable IDs, scope (`class` or `activity`), rule id/type, class id/name, optional activity id/name, actual, limit, unit, state, and short display label.
- Risk states use rule proximity:
  - danger at or over the limit.
  - caution near the limit where the rule type has meaningful proximity.
  - safe below caution.
- High-Intensity Foot Load example behaves intuitively:
  - class max sessions row shows `3 / 3 sessions` when three class activities were logged in the rolling window.
  - Morning Walk weekly km row shows Morning Walk km only.
  - Stationary Bike daily minutes row shows Stationary Bike minutes today only.
  - no `0 / 8` class row from the Morning Walk exercise rule.

### Edge cases

- No enabled limits: `load_risk_summary` is present with week days and empty rows, or null per documented contract; choose one behavior and test it.
- Logs outside today plus previous six days are excluded from rolling weekly rows.
- Logs with mismatched units are ignored for volume caps.
- Rest-spacing rows with no prior session show neutral/safe copy.
- Disabled rules are ignored.

### Test strategy

- Load-engine tests cover class frequency, consecutive days, rest spacing, exercise daily volume, exercise weekly volume, legacy load cap, disabled rules, and unit mismatch.
- Dashboard API/service tests verify the new contract and the High-Intensity Foot Load regression.
- Existing tests expecting `class_bars` are updated to the new contract in the same ticket.

---

## WTL.F5 — Load risk UI for rule-limit rows

**Type:** frontend + tests  
**Depends on:** WTL.B6  
**Blocks:** none  
**Reuse:** `frontend/src/components/composites/LoadRiskSection.tsx`, `frontend/src/lib/api/mappers.ts`, `frontend/src/lib/engine.ts`, `frontend/src/types.ts`

### Acceptance criteria

- Section title remains `Load risk`.
- Seven-day strip remains rolling last seven days.
- Seven-day strip color comes from the load-tax day state plus explicit rule breaches where relevant.
- UI groups rows by activity class.
- Class rows and activity rows are visually distinguishable without implying exercise rows are class-wide.
- Fill bars are used for count/volume/load rows.
- Rest-spacing rows use status copy that avoids backwards progress semantics.
- Empty copy says no load rules are configured when there are no enabled rule-limit rows.
- The UI shows more than one relevant limit for a class when multiple rules are enabled.

### Edge cases

- Long class/activity names truncate cleanly on mobile.
- Over-limit rows remain readable.
- A class with only exercise-scoped rules appears with those exercise rows only.
- A class with rest rules only still appears with useful status copy.

### Test strategy

- Mapper tests cover new load-risk row shape.
- LoadRiskSection tests cover grouped class rows, exercise rows, rest-status rows, empty copy, and over-limit styling.
- Dashboard screen smoke test verifies section renders from dashboard payload.

---

## WTL.F6 — Remove Recovery streaks dashboard section

**Type:** frontend + docs/backlog + tests  
**Depends on:** WTL.F1, WTL.F2  
**Blocks:** none  
**Reuse:** `DashboardScreen.tsx`, `plans/BACKLOG.md`, dashboard screen tests

### Acceptance criteria

- Dashboard no longer renders the `Recovery streaks` section.
- Old empty copy `No recovery targets in this block.` is removed.
- Recovery-type weekly targets render in the `This week` weekly targets section instead.
- Add backlog note for a future true streak feature based on recovery-style weekly target completion history.
- Existing `recovery_streaks` API field can remain temporarily for compatibility, but frontend no longer depends on it.

### Edge cases

- No weekly targets: `This week` section uses the weekly-target empty copy.
- Recovery weekly target complete: shown as complete in `This week`, not as a streak.

### Test strategy

- Dashboard tests assert Recovery streaks is absent.
- Dashboard tests assert recovery weekly targets appear in This week once weekly target payload supports activity names.
- Backlog review confirms future recovery streak feature is recorded.

---

## WTL.D1 — Weekly focus lifecycle design decision

**Type:** review-heavy + docs  
**Depends on:** owner approval to replace month-style training block UX  
**Blocks:** WTL.B7, WTL.F7  
**Reuse:** `training_blocks` model/API, `rules`, `weekly_targets`, `BlockReviewScreen`, `SettingsScreen`, `plans/milestone-architecture.md`, `docs/api-map.md`, `docs/database-schema.md`

### Acceptance criteria

- Produce a short technical design that decides whether to:
  - reuse `training_blocks` as weekly focus periods, or
  - introduce a new `weekly_focuses` table and migrate block-owned rules/targets.
- Design defines:
  - week start/end behavior (Monday-Sunday).
  - how rules and weekly targets roll forward automatically.
  - how focus title and week counter work.
  - how resetting to a new wider goal resets week count.
  - how historical rules/targets are viewed.
  - what happens if the user edits a rule mid-week.
  - what happens when no active weekly focus exists.
- Design identifies required migrations and API changes.
- Owner signs off before implementation tickets WTL.B7 and WTL.F7 begin.

### Edge cases

- User changes focus title on Wednesday.
- User resets focus title on Sunday or Monday.
- A historical week needs review after rules changed later.
- Existing production training block data must remain readable.

### Test strategy

- No production tests in this design ticket.
- The design must list concrete test files and behaviors for WTL.B7 and WTL.F7.

---

## WTL.B7 — Weekly focus backend lifecycle

**Type:** backend + migration + tests  
**Depends on:** WTL.D1 owner sign-off  
**Blocks:** WTL.F7  
**Reuse:** implementation choices from WTL.D1, `backend/app/services/training_blocks.py`, rule/target copy helpers, dashboard active-block lookup, review endpoints

### Acceptance criteria

- Active planning period resolves to the current Monday-Sunday weekly focus.
- If a new week starts, the service can roll forward the previous week by copying enabled rules and weekly targets.
- Wider focus title and week counter are stored and returned by the active focus/block API.
- Starting a new wider focus resets the week counter to 1.
- Historical weekly focus periods remain readable for review.
- Existing block review data still works for previous periods.
- No router contains lifecycle business logic.

### Edge cases

- No prior focus exists: create initial focus safely.
- Prior week has no rules/targets: new week remains empty but valid.
- User edits rules mid-week: current week changes, previous week remains historical.
- Manual date testing with `as_of` around Monday boundary behaves consistently.

### Test strategy

- Service tests for rollover, copy behavior, title reset, week counter, and history.
- API tests for active focus/block payload.
- Dashboard service tests for active focus resolution across Monday boundary.

---

## WTL.F7 — Settings weekly focus UI

**Type:** frontend + tests  
**Depends on:** WTL.B7  
**Blocks:** none  
**Reuse:** `SettingsScreen.tsx`, `EditBlockRulesScreen.tsx`, `BlockReviewScreen`, current Training Block card styling

### Acceptance criteria

- Settings no longer presents a month-style `+ New Training Block` flow.
- Settings shows the current weekly focus title and week number.
- User can edit the wider focus title.
- User can reset/start a new wider focus, which starts week 1.
- Current rules remain editable from the same area.
- Previous weekly focuses are reachable for review/history.
- Copy avoids the old monthly block mental model.

### Edge cases

- No active focus: show a clear setup action.
- Editing title fails: UI keeps the form open and shows error.
- Historical week review remains reachable on mobile.

### Test strategy

- Settings screen tests cover focus title/week number display, edit, reset, missing active focus, and review navigation.
- Hook/API tests cover new focus mutations and invalidation.

---

## WTL.D2 — Docs and backlog cleanup

**Type:** docs + review  
**Depends on:** WTL.B6 and either WTL.D1 sign-off or decision to defer weekly focus implementation  
**Blocks:** OWTL.1  
**Reuse:** `docs/api-map.md`, `docs/database-schema.md`, `docs/patterns.md`, `plans/BACKLOG.md`, `AGENTS.md`

### Acceptance criteria

- `docs/api-map.md` documents:
  - weekly target create/patch/delete shape.
  - dashboard `weekly_progress` as This Week.
  - dashboard `load_series` as last-30-days rolling seven-day load tax.
  - load risk row contract.
- `docs/database-schema.md` documents the final weekly target and legacy recovery target state.
- `docs/patterns.md` or nearest suitable living doc records that load-tax calculation lives in backend load-engine helpers, not React components.
- `plans/BACKLOG.md` removes or updates stale P25.9 follow-up notes that are superseded.
- `AGENTS.md` Current Sprint is updated only if the owner declares this the active sprint.
- Any deferred daily recovery streak or weekly focus items are explicitly listed in backlog.

### Edge cases

- If weekly focus is deferred, docs must not claim it is implemented.
- If `recovery_targets` remains as legacy storage, docs must say where it is still used.

### Test strategy

- Documentation review only.

---

## OWTL.1 — Owner smoke

**Type:** owner acceptance  
**Depends on:** WTL.D2  
**Blocks:** merge/deploy decision  
**Reuse:** local app, production-like seeded data, owner screenshots from 2026-06-07

### Acceptance criteria

- Owner confirms dashboard weekly progress reads as This Week and counts Monday-Sunday.
- Owner confirms Goals has Weekly target and Big goal flows.
- Owner confirms weekly targets can be created for recovery and performance activities.
- Owner confirms completed weekly targets stop appearing in Do until next week.
- Owner confirms overdue/incomplete weekly targets appear in Do when safe.
- Owner confirms dashboard graph shows last 30 days and reads as rolling seven-day effort load.
- Owner confirms dashboard graph does not show `/ 0` or a cap line when no explicit threshold exists.
- Owner confirms Load risk uses rolling last seven days.
- Owner confirms Load risk shows the relevant rule limits and no longer shows an exercise rule as a class-level `0 / 8` row.
- Owner confirms weekly focus/block UX direction if WTL.F7 is included in the batch.

### Manual smoke scenarios

- Create a weekly target for a recovery activity, log enough sessions, verify target completion.
- Create a weekly target for Morning Walk in km, log walks on Wednesday and Saturday, verify This Week progress.
- On Monday, verify This Week progress resets but Load risk still sees Sunday activity.
- With High-Intensity Foot Load rules from owner screenshot, verify class frequency, rest, Stationary Bike daily minutes, and Morning Walk weekly km are separate rows.
- Verify a performance session with no rules still contributes load tax and a recovery activity does not.

---

## Unresolved assumptions

- Owner approval is needed for the planning assumption that `weekly_targets` becomes the single user-facing weekly target source and weekly `recovery_targets` migrate into it.
- Daily recovery streaks are not part of the newly agreed weekly target model. They should be explicitly retired, retained as legacy, or replanned.
- Load-tax constants are intentionally proposed defaults; owner can tune them after seeing the first graph behavior.
- Weekly focus replacement for training blocks is intentionally behind WTL.D1 because it changes lifecycle semantics, history, and likely schema/API contracts.

## Planner status

NEEDS OWNER
