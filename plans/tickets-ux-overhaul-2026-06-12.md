# UX Overhaul — Ticket Plan

**Date:** 2026-06-12
**Branch:** `feat/ux-overhaul-2026-06`
**Status:** Planner review complete
**Sources:** `plans/ux-assessment-2026-06-12.md` (AI), `plans/user-ux-assessment-12-06-2026.md` (owner)

Tickets below follow the planner ticket shape: each has a **Type**, a **Reuse/Extend** inventory, flat **Acceptance criteria**, and **Edge cases**. Implementation detail is given as contracts and reuse pointers, not finished code — the Implementer writes the code. Code sketches appear only where they remove ambiguity (a type field, a function signature, a label string).

---

## Locked Decisions

| # | Decision |
|---|----------|
| 1 | Dashboard gets 3 sub-tabs: **Today / Metrics / Safety** |
| 2 | No FAB — Log tab remains the primary log entry point |
| 3 | Clean streak UI **removed** from Dashboard; streaks feature tracked in backlog (engine field stays) |
| 4 | Incidents surfaced in **Log History** with distinct visual; post-incident screen cleaned up |
| 5 | "All Classes" rule: root cause confirmed — stale FK orphan (see UX-B3) |
| 6 | Delete pattern: **bin icon** replaces text "Delete" on **row triggers only** (not confirmation buttons) |
| 7 | Single feature branch; tickets commit sequentially — quick wins first, then structural |

---

## ⚠️ Owner Sign-Off Required Before Implementation

Per `docs/architecture.md` ("Migration creation requires explicit approval", "add or materially change database schema"), the following touch schema/data. **Owner decisions resolved 2026-06-12** (see below) — proceed as specified.

| Item | Ticket | Status |
|------|--------|--------|
| Production data deletion (orphan rules) | UX-B3 Part 1 | ✅ **Approved 2026-06-12.** Owner-run or owner-approved execution against live Supabase. |
| FK constraint migration | UX-B3 Part 3 | ✅ **`ON DELETE CASCADE` chosen.** Alembic migration still requires the standard pre-merge owner review. |

**No other ticket changes schema, API contracts, or shared state.** UX-A2 and UX-B4 were re-scoped during this review to be frontend-only (see those tickets).

---

## Group A — Quick Wins

Pure frontend display/copy tweaks. Each is a standalone commit. None touch the engine, API, or schema.

---

### UX-A1: Check-in completion badge

**Type:** Frontend

**Problem:** `{!hasCheckedInToday && <CheckInCTA />}` (`DashboardScreen.tsx:162`) — the CTA disappears after check-in, leaving no evidence it happened, prompting duplicate check-ins.

**Reuse/Extend:**
- Reuse `Card` with `intent="success"` (already used elsewhere in this screen).
- Reuse the existing `CheckInCTA` component unchanged for the not-yet state.
- `hasCheckedInToday` already destructured from `engine`.

**Acceptance criteria:**
- When `hasCheckedInToday` is true, a success-intent card is shown reading "Check-in complete".
- When `hasCheckedInToday` is false, the existing `CheckInCTA` renders exactly as today.
- The two states occupy the same slot in the layout (no shift in surrounding sections).

**Edge cases:**
- Engine still loading / `hasCheckedInToday` undefined → treat as not-checked-in (show CTA), never a flash of the success badge.
- No exact check-in timestamp is available in the engine result today — do **not** invent a "Logged at 7:15 AM" string; use "Logged today" or omit the time. (The AI assessment's mocked timestamp is not backed by data.)

---

### UX-A2: Load risk — daily/weekly/consecutive prefix on rule rows + right-aligned value text

**Type:** Frontend (no backend — corrected during review)

**Problem:** Load-risk rule rows render `"0 / 3 km"` with no indication of the period. Two gaps remain after initial implementation:
1. `consecutive_day_limit` rows show no period prefix, losing the "consecutive days" context.
2. When a row has no left label (class-scoped rows), the `valueText` renders flush-left instead of flush-right, making the layout inconsistent with activity-scoped rows.

**Reuse/Extend:**
- `LoadRiskRuleLimitRow` (`types.ts:292`) has **no `period` field** but does have `ruleType: string`. Derive the period from `ruleType` — do **not** add a field or change the API.
- Period mapping by rule type: `daily_volume_cap` → "Daily:"; `weekly_volume_cap`, `weekly_load_cap`, `frequency_limit` → "Weekly:"; `consecutive_day_limit` → "Consecutive:"; `rest_between_class` → no prefix (rest gap is not a windowed cap). Confirm the exact set against `lib/ruleTaxonomy.ts` during implementation.
- Apply the prefix inside `LoadRiskSection.tsx` (`rulePeriodPrefix`), not in the engine. Update the return type of `rulePeriodPrefix` to include `'Consecutive:'`.
- The right-alignment fix belongs in `ProgressBar.tsx`: add `ml-auto` to the `valueText` span so it is always flush-right regardless of whether a `label` is present. With `ml-auto` on the last flex child, both the two-child case (label left, value right) and the one-child case (no label, value right) are correct.

**Acceptance criteria:**
- AC-1: `daily_volume_cap` rows display a "Daily:" prefix before the value (e.g. "Daily: 0 / 3 km").
- AC-2–4: `weekly_volume_cap`, `weekly_load_cap`, `frequency_limit` rows display a "Weekly:" prefix.
- AC-6 (updated): `consecutive_day_limit` rows display a "Consecutive:" prefix (e.g. "Consecutive: 1 / 2 days").
- AC-5: `rest_between_class` rows show no prefix.
- AC-7: Unknown/future `ruleType` → no prefix, no crash.
- AC-9 (new): For class-scoped bar rows (where `label` is `null`), the `valueText` is flush-right, not flush-left. For activity-scoped rows (where `label` is present), the label is flush-left and `valueText` is flush-right — no change to existing behaviour.
- Progress bar geometry and `data-testid` hooks are unchanged.

**Test file to update:** `LoadRiskSection.uxA2.test.tsx`
- AC-6 test currently asserts NO prefix for `consecutive_day_limit` — must be inverted to assert "Consecutive:" prefix.
- Add AC-9 tests: render a class-scoped row (scope: 'class', no activityName) and assert the valueText element has `ml-auto` in its className (or assert it is the only/rightmost element in the header row).

**Edge cases:**
- Unknown/future `ruleType` not in the mapping → render with no prefix rather than crashing or showing "undefined".
- `displayMode: 'status'` rows render `null` (UX-A10) — no prefix logic runs for them; no change needed.
- The `ml-auto` addition to `ProgressBar.tsx` is additive and must not break any existing ProgressBar tests.

---

### UX-A3: Activity status — this-week sessions + units (owner spec 2026-06-12)

**Type:** Frontend (adds a small derived computation in the engine/orchestration layer — still no API change)

**Problem:** Items done today show redundant recency text ("Last done 0 days ago"). The owner wants each row to read simply, with at-a-glance this-week numbers instead.

**Owner spec (locked 2026-06-12):**
- Keep each row to **one** description-style line under the title — no stacked metadata.
- Drop the redundant "last done today / N days ago" phrase entirely.
- That single line shows **"{n} session{s} this week"**.
- **Next to the title**, show the **units of exercise completed this week** for that class, e.g. "5 km".

**Reuse/Extend:**
- `classStatuses` (`ActivityClassStatus[]`) gives state/label/reason but **not** session count or units. Compute per-class this-week totals from `engine.logs` (already client-side) + activity→class mapping + the current weekly period (Monday–Sunday, the app's existing week).
- Put the derived per-class summary (sessions count + summed volume by unit) in `lib/engine.ts` or `useMilestoneEngine` — **not** inline in `DashboardScreen`, per `docs/patterns.md` "Dashboard data composition" (don't duplicate summary math in leaf cards).
- Reuse the current-week period already used by `weeklyProgress` so both features agree on week boundaries.

**Acceptance criteria:**
- No Activity Status row shows a "0 days ago" / "Last done today" style string.
- Each row shows the units completed this week beside the class title (e.g. "Gentle walk · 5 km").
- Each row shows exactly one secondary line: "{n} session{s} this week".
- The this-week session count and units are derived from the current Monday–Sunday period and match the logs.
- The `StatusDot` traffic-light state and `nextSafeDate` summary are unchanged.

**Edge cases:**
- **Mixed units in one class** (e.g. a class with both km- and minute-based exercises logged this week): default to showing the unit total only when the class's logged activities this week share a single volume unit; if mixed, show the session count only and omit the title units (do not concatenate "5 km + 30 min"). Flag this to the owner if mixed-unit classes are common.
- **Zero sessions this week** → show "0 sessions this week" and no title units (don't render "0 km").
- A class in **caution/danger**: the violation reason is more important than the session count — show the violation reason as the single line instead, so the row still has exactly one line. (Safe/clear rows use the session-count line.)
- Singular/plural: "1 session this week" vs "3 sessions this week".
- Units formatting consistent with existing log display (e.g. no trailing ".0").

---

### UX-A4: Remove Clean Streak section from Dashboard

**Type:** Frontend + docs

**Problem:** Clean-streak logic does not reliably flag rule violations and adds little value in its current form (owner decision: remove, revisit later).

**Reuse/Extend:**
- Remove the Clean Streak section markup and the `StreakRow` sub-component from `DashboardScreen.tsx` (lines ~118–130, ~246–252).
- Remove `cleanStreak` from the destructured engine fields in `DashboardScreen.tsx` only.
- **Do not** remove `cleanStreak` from `useMilestoneEngine.ts` (line 220 / 782) or the backend — the field stays; it is simply not rendered.

**Acceptance criteria:**
- Dashboard renders with no Clean Streak card.
- `cleanStreak` is still returned by the engine (unused import/field warnings resolved cleanly).
- A backlog entry exists for a future, properly-designed streak feature.

**Edge cases:**
- Any existing Dashboard test asserting on the streak section must be updated/removed in the same ticket (search `DashboardScreen*.test.tsx` for "streak" / "clean").
- Ensure no other screen imports `StreakRow` before deleting it.

---

### UX-A5: Shared `DeleteButton` (bin icon) for row triggers

**Type:** Frontend (new shared UI primitive — justified: recurring across ≥3 screens)

**Problem:** Row-level delete actions use inconsistent text "Delete" buttons that take space and read heavily.

**Reuse/Extend:**
- **New** `frontend/src/components/ui/DeleteButton.tsx` — a faded-red icon button (`text-danger-fg/50`, full colour on hover), `aria-label` required. This is a shared primitive per `docs/patterns.md` "Shared UI primitive vs feature component" (recurs across screens).
- Replace the **row-trigger** text "Delete" at:
  - `LogHistoryScreen.tsx:78` (log row)
  - `SettingsScreen.tsx:1299` (activity class row — keep its existing `aria-label`)
  - `EditBlockRulesScreen.tsx:205` (rule row — note: also restyled in UX-B6)
  - `GoalsScreen.tsx` row-level delete **trigger** (the control that sets `confirmingDelete`, not the confirm button)

**Acceptance criteria:**
- A single `DeleteButton` primitive exists and is used by every row-level delete trigger listed above.
- Each instance has a descriptive `aria-label` (e.g. "Delete activity log", "Delete Gentle walk").
- Existing confirmation flows (window.confirm, inline confirm, modal) still fire unchanged.
- The icon is right-aligned in its row.

**Edge cases:**
- **Do not** convert confirmation-dialog buttons to icons: `SettingsScreen.tsx:773` ("Delete class"), `:807` ("Delete anyway"), and `GoalsScreen.tsx:444` (the inline "Delete" **confirm** button) stay as text. Only the row trigger becomes an icon.
- `GoalsScreen` uses an inline confirm pattern — verify which control is the trigger vs the confirm before swapping.
- Icon button must remain ≥44px touch target (pad the hit area even if the glyph is 16px).

---

### UX-A6: Log Activity — hide volume field when unit is minutes

**Type:** Frontend

**Problem:** Activities whose `defaultVolumeUnit` is minutes show a Volume field that duplicates Duration.

**Reuse/Extend:**
- Guard the existing volume block in `LogActivityScreen.tsx:322`. Confirm the exact stored unit token for minutes against `VOLUME_CAP_UNITS` / activity seed data (`'min'` vs `'minutes'`) before hardcoding the comparison.

**Acceptance criteria:**
- Activities with a minute-based volume unit show no Volume input in create and edit modes.
- A log submitted for such an activity has `volumeValue` of 0 / omitted (not a stale copy of duration).
- Activities with non-minute units (km, sessions, hours, reps) are unaffected.
- Live rule-violation checking still works for the affected activities (duration-based rules still evaluate).

**Edge cases:**
- **Edit mode:** opening an existing minute-unit log that already has a non-zero `volumeValue` must not resurface the field; ensure the persisted value is normalised to 0 / omitted on save, or left untouched if that risks a rule recompute — decide and state which in the ticket commit.
- The `checkViolations` call passes `volume`; ensure hiding the field doesn't pass `undefined` where a number is expected.

---

### UX-A7: Actionable empty-state cards

**Type:** Frontend (may add navigation callback props)

**Problem:** Empty states are dead-ends ("No weekly targets configured.").

**Reuse/Extend:**
- Reuse `Card` with `intent="info"`.
- Dashboard may need new optional callback props (`onViewGoals?`, `onViewSettings?`) threaded from `App.tsx`. Check existing nav callbacks first; reuse `onOpenLogActivity`-style wiring rather than inventing a router concept.
- Log History empty state already has illustration + copy — only add a CTA button.

**Acceptance criteria:**
- Empty weekly-targets section (`DashboardScreen.tsx:189`) shows an info card with a CTA that navigates to Goals.
- Log History empty state gains a "Log your first session" button calling `onOpenLogActivity`.
- If `classStatuses` is empty, Activity Status shows a card pointing the user to Settings.
- Every CTA navigates to the correct screen.

**Edge cases:**
- If a nav callback is not provided (prop optional), the CTA must hide gracefully rather than render a dead button.
- Copy must be product-voiced per `docs/patterns.md` "UI copy" — no mention of "configured", "blocks" jargon where avoidable.

---

### UX-A8: Post-incident confirmation cleanup

**Type:** Frontend

**Problem:** The submitted-incident screen (`LogIncidentScreen.tsx:80–99`) shows the long `DelayedTaxAttributionSection` list and a cramped red Done button.

**Reuse/Extend:**
- Edit the `submitted` branch only. Keep the headline ("Incident recorded.") and body copy.
- Remove `<DelayedTaxAttributionSection>` from this branch (leave the import if still used pre-submit; remove if now unused to satisfy lint).

**Acceptance criteria:**
- Post-submit screen shows: icon, "Incident recorded." headline, one line of body copy, and a Done button — nothing else.
- The contributing-activities list is not rendered post-submit.
- Done button is full width, `h-12`, neutral background (`bg-ink`/white style), not `bg-danger`.

**Edge cases:**
- `DelayedTaxAttributionSection` import becomes unused → remove it to keep `tsc`/eslint clean, but confirm it isn't referenced elsewhere in the file first.
- Done still calls `onComplete` and returns the user to the prior screen.

---

### UX-A9: Block safety map — legend and summary

**Type:** Frontend

**Problem:** `BlockSafetyMapSection` shows a heatmap with no title context, legend, or summary.

**Reuse/Extend:**
- Edit `BlockSafetyMapSection.tsx`. Reuse the existing safe/caution/danger colour tokens already used by the heatmap cells for the legend swatches (single source of truth).

**Acceptance criteria:**
- A summary line (e.g. "N / 14 days without issues") renders above the heatmap, derived from the existing day-state data — not a hardcoded number.
- A 3-item legend (safe / caution / danger with labels) renders below the heatmap.
- Section heading reads "Block Progress" (or agreed product copy).

**Edge cases:**
- Block shorter/longer than 14 days, or partially elapsed → summary denominator must reflect the actual number of days in the period, not a fixed 14.
- No active block → keep whatever empty/placeholder behaviour exists today; don't show a "0 / 0" summary.

---

### UX-A10: Load Risk — fix redundant bar-mode label and remove status rows

**Type:** Frontend

**Problem:** Two visual problems spotted in `LoadRiskSection.tsx` after UX-A2 shipped.

*Problem 1 — Redundant row label:* Bar-mode class-scoped rows show the count in the left label AND again as the right-side value. The `label` field returned by the backend includes the count string (e.g. "1 / 3 sessions · High-Intensity Foot Load"). `ruleRowLabel()` passes `row.label` straight to `ProgressBar` as the label, so the left side reads "1 / 3 sessions · High-Intensity Foot Load" while the right side already reads "Weekly: 1 / 3 sessions". The left label should be the class or exercise name only — the count belongs on the right.

*Problem 2 — Status rows clutter the layout:* `displayMode: 'status'` rows render `row.label` as a plain `<p>` (e.g. "6 days since last session (3-day minimum)"). These add no actionable information and clutter the layout.

**Reuse/Extend:**
- Edit `ruleRowLabel()` in `LoadRiskSection.tsx` (line 59). For class-scoped (`row.scope !== 'activity'`) bar-mode rows, return `row.className` instead of `row.label`. For activity-scoped bar-mode rows, `row.activityName` is already the right display name — leave that branch unchanged. `className: string` is always present on `LoadRiskRuleLimitRow` (`types.ts:298`); no nullability guard needed.
- The `displayMode === 'status'` branch of `LoadRiskRuleRow` (lines 115–126) renders only a `<p>` with `row.label`. Remove this branch entirely — return `null` for status-mode rows so they produce no DOM output.
- No type changes, no API changes, no engine changes.
- Existing test file: `LoadRiskSection.uxA2.test.tsx` — tests that assert the label text for bar-mode rows will need updating to expect the class/exercise name, not the count-bearing `label` string. Tests that cover the `displayMode === 'status'` render path must be removed or updated to assert that status rows render nothing.

**Acceptance criteria:**
- For a class-scoped bar-mode row, the `ProgressBar` `label` prop receives the value of `row.className` (e.g. "High-Intensity Foot Load"), not `row.label`.
- For an activity-scoped bar-mode row, the `ProgressBar` `label` prop still receives `row.activityName` — unchanged from today.
- The right-side `valueText` (e.g. "Weekly: 1 / 3 sessions") is not changed by this ticket.
- `displayMode === 'status'` rows render nothing — `LoadRiskRuleRow` returns `null` for that branch.
- Status rows produce no DOM node under `[data-testid="load-risk-rule-rows"]`.
- Progress bar geometry, `data-testid` hooks, `data-display-mode`, `data-scope`, and `data-activity-id` attributes on bar-mode rows are unchanged.
- `LoadRiskSection.uxA2.test.tsx` is updated: label assertions use the class/exercise name; any test covering the `status` display mode is removed or updated to assert no render.
- `tsc --noEmit` and ESLint pass clean.

**Edge cases:**
- `row.className` is typed as `string` (non-nullable) — no fallback needed; do not re-introduce a fallback to `row.label`.
- A rule group that contains only status rows: after filtering, the `rows` array for that group renders no `LoadRiskRuleRow` children. The class group header (`<p>{group.className}</p>`) would then be an orphaned heading. Filter out groups where all rows are status-mode before rendering class groups, or guard the group rendering so an empty visible-rows list suppresses the header. Either approach is acceptable — state the chosen one in the commit message.
- Mixed group (some bar rows, some status rows): the bar rows render normally; only the status rows are suppressed. The class header remains.
- `row.activityName` null/undefined on an activity-scoped row: the existing `row.activityName &&` guard in `ruleRowLabel()` covers this — no change needed for that case; leave fallback behaviour as-is.

---

## Group B — Structural Changes

Larger changes. Work one area at a time; commit each before the next. Still frontend-only except UX-B3 (the only ticket with backend/DB work, gated on owner sign-off).

---

### UX-B1: Incidents in Log History

**Type:** Frontend

**Problem:** Flare-up incidents are never visible after logging.

**Reuse/Extend:**
- `engine.incidents` (`FlareUpIncident[]`) is already exposed (`useMilestoneEngine.ts:208`). `FlareUpIncident` has `incidentDate`, `bodyPart`, `severity`, `notes`.
- Extend the existing `groupLogs` in `LogHistoryScreen.tsx` into a timeline grouping that merges logs and incidents by date. Introduce a local discriminated union (`{ kind: 'log' } | { kind: 'incident' }`) — page-local type, not a shared abstraction.
- Add a page-local `IncidentRow` alongside the existing `LogRow`.

**Acceptance criteria:**
- Incidents appear inline in the Log History timeline on their `incidentDate`, interleaved correctly with logs of the same day.
- Incident rows are visually distinct (caution/orange tint + warning icon) from activity logs.
- Incident rows show body part and severity; notes if present.
- Existing log rows, month grouping, and counts are unchanged.
- Incident rows have no edit/delete actions (read-only for now).

**Edge cases:**
- A day with only incidents (no logs) still renders that day group.
- The header "N sessions logged" counts logs only — do not inflate it with incidents (or relabel clearly if combining).
- Sort stability when a log and incident share a date — define order (e.g. incidents first or by created timestamp) and keep it deterministic.
- Empty logs but present incidents → the empty-state must not show; the timeline renders the incidents.

---

### UX-B2: Log History — day and week visual breaks

**Type:** Frontend

**Problem:** Logs within a month read as one flat list; days and weeks are not visually separated.

**Reuse/Extend:**
- Build on the same render path as UX-B1 (do UX-B1 first). Reuse existing month grouping; add per-day visual grouping and a week separator.
- Week boundary = Monday-based (consistent with the app's existing Monday–Sunday weekly periods).

**Acceptance criteria:**
- Each day's items are visually grouped as a distinct padded/rounded block, not separated only by a hairline divider.
- A "Week of [date]" separator appears between day groups that fall in different calendar weeks.
- Month headers are unchanged.
- The change is subtle (owner: "doesn't need to be a lot").

**Edge cases:**
- Single-day or single-week month → no spurious week separators.
- A week spanning a month boundary → month grouping wins at the top level; week separators operate within the existing month sections (accept that a week split across months reads as two segments).
- Verify the Monday calculation handles Sunday correctly (JS `getDay()` returns 0 for Sunday).

---

### UX-B3: "All Classes" rule — stale FK orphan fix

**Type:** Full-stack (frontend + backend + production data) — owner decisions resolved 2026-06-12 (CASCADE; Part 1 approved)

**Root cause (confirmed 2026-06-12):** `SettingsScreen.tsx:135` renders `activity ? activity.name : cls ? cls.name : 'All classes'`. `cls` comes from `classMap.get(rule.activityClassId)`. When a rule references an `activity_class_id` whose class was deleted, the lookup returns `undefined` and the label falls back to "All classes". This is a stale foreign key — an orphan rule row in production Supabase. It does not reproduce locally because the deletion only happened in the live DB. Screenshot confirms a `rest_between_class` ("Minimum days between sessions · 2") orphan that also appears legitimately for "Gentle walk".

**Reuse/Extend:**
- Frontend: tighten the `visibleRecoveryRules` filter (`SettingsScreen.tsx:91`) to drop rules whose class/activity cannot be resolved; remove the "All classes" fallback string.
- Backend: inspect the `Rule` model FK definition; add cascade/restrict via Alembic.

**Acceptance criteria:**

*Part 1 — production cleanup (✅ approved 2026-06-12; owner-run/owner-approved execution):*
- Orphan rule rows (non-null `activity_class_id` with no matching `activity_classes` row) are identified and deleted from production.
- The same query also catches rules with a stale `activity_id` (deleted exercise) — delete those too.

*Part 2 — frontend guard (no sign-off needed; ships first):*
- Rules with an unresolvable class **and** unresolvable activity are filtered out before render; the "All classes" fallback label is removed.
- No legitimately-scoped rule disappears.

*Part 3 — backend constraint (✅ CASCADE chosen; migration still gets standard pre-merge review):*
- A new Alembic migration sets `ON DELETE CASCADE` on `rules.activity_class_id → activity_classes.id` (and on `rules.activity_id → activities.id` if not already cascading).
- The existing class-delete confirmation is preserved; after it is confirmed, the class's class-level and exercise-level rules are removed automatically — no orphan rows remain and no separate "delete rules?" prompt is added.
- `docs/database-schema.md` updated for the constraint change.

**UX of the chosen behaviour (CASCADE):** The class delete itself still requires the existing confirmation step (the "Delete class?" / "Delete activities too?" modal) — that gate is **preserved, not removed**. Once the user confirms the class delete, its rules are removed immediately and silently, with **no separate rules confirmation**. Rules are never surfaced as their own decision. This matches the owner intent ("class delete requires confirmation; rules can go straight away once done") and prevents the orphan bug recurring.

**Edge cases:**
- A rule with a valid class but a stale **activity** FK (exercise deleted) → same orphan cleanup (Part 1) and same CASCADE (Part 3) applies.
- The frontend filter (Part 2) must ship even if the migration is deferred, so production stops showing "All classes" immediately.
- After CASCADE lands, confirm the existing class-delete flow (`performDeleteClass`, `SettingsScreen.tsx:1161`) no longer needs to manually pre-delete rules — remove any now-redundant manual rule cleanup if present.

**Note:** Part 2 (frontend) lands independently and first. Parts 1 and 3 proceed per the approved decisions above.

---

### UX-B4: Activity status — expandable rule detail

**Type:** Frontend (no backend — corrected during review)

**Problem:** `classStatuses[].reason` is terse; users want to know why a class is blocked and when it clears.

**Reuse/Extend:**
- `ActivityClassStatus` already provides `reason`, `label` ("Resting"/"Pushing it"), `lastDoneDate`, `nextSafeDate`. The `reason` text **already** contains "X more rest day(s) needed. Safe from <date>." Derive any "rest days remaining" value in the frontend from `nextSafeDate − todayDate`. **Do not** add `violatedRuleLabel` or `estimatedRestDays` to the engine/API — the existing data is sufficient.
- Local `useState<string | null>` for the expanded row id — page-local state per `docs/architecture.md`.

**Acceptance criteria:**
- Tapping an Activity Status row expands an inline detail panel; tapping again collapses it.
- The panel surfaces the existing `reason` and, where `nextSafeDate` exists, a derived days-until-safe value.
- Only one row expanded at a time (or document if multi-expand is chosen).
- Non-expanded rows and the existing `StatusDot` + `nextSafeDate` summary are unchanged.

**Edge cases:**
- `nextSafeDate` absent (safe class) → panel shows the reason only, no rest-day math.
- `nextSafeDate` in the past relative to `todayDate` → clamp days-remaining at 0, don't show negatives.
- Keyboard/ARIA: the row becomes a button with `aria-expanded`; preserve existing `StatusDot` semantics.

---

### UX-B5: Rules preview — group by class and exercise

**Type:** Frontend

**Problem:** The rules preview list renders in rule-creation order, not grouped by class/exercise — a wall of text.

**Reuse/Extend:**
- The preview list lives in `SettingsScreen.tsx` (`visibleRecoveryRules`, lines 122–143). Group there. Reuse `classMap` / `activityMap` already built in the component.
- Grouping: by class; within a class, class-level rules first then exercise-level rules grouped by exercise. Preserve original order within each group.
- Do this **after** UX-B3's filter so orphan rules are already excluded.

**Acceptance criteria:**
- Rules for the same class appear together under that class name as a sub-header.
- Exercise-level rules appear under their class, grouped by exercise.
- Original relative order is preserved within each group.
- The "several rules for the same property" wall is visibly reduced (grouped headers instead of repeated class names per line).

**Edge cases:**
- A class with rules but no exercise-level rules → renders cleanly with just class rules.
- An exercise-level rule whose class also has class-level rules → exercise rules nest under the same class header, not a duplicate header.
- Stable, deterministic class ordering (e.g. by class creation/order field, not Map iteration chance).

---

### UX-B6: Edit Rules — compact one-line rows

**Type:** Frontend (touches an 850-line file — keep the change scoped to the rule-row sub-component; see `large-component-refactor` skill if extraction is needed)

**Problem:** Each rule row in `EditBlockRulesScreen.tsx` is tall: always-on description text, a full-width control line, and a text "Delete".

**Reuse/Extend:**
- The on/off **switch already exists** as inline `role="switch"` markup (`EditBlockRulesScreen.tsx:207–225`) — **relocate** it to the row's left; do not build a new Toggle.
- The `[−] [input] [unit] [+]` controls already exist on one line (lines 229–289) — keep, compress onto the same row as the label.
- Replace the text "Delete" (line 205) with the UX-A5 `DeleteButton` (do UX-A5 first).
- Replace the always-visible helper text (from `getRuleHelper`) with an "ⓘ" info affordance (tooltip via `title` or a lightweight popover). Reuse `getRuleHelper` for the tooltip content.

**Acceptance criteria:**
- Each rule row reads as a single line: switch (left) · rule label · ⓘ · value controls · bin icon (right).
- The per-rule description no longer occupies its own permanent line; it is reachable via the ⓘ affordance.
- Toggle, threshold edit, unit selection, increment/decrement, and delete all retain current behaviour (`onToggleEnabled`, `onCommitThreshold`, `onLimitUnitChange`, etc.).
- Disabled rules still visually read as off.

**Edge cases:**
- Volume-cap rules show a unit `<select>`; non-volume rules show a static unit span — both must fit the compact row without wrapping on a 375px screen.
- Long rule/exercise labels must truncate, not push controls off-screen.
- ⓘ tooltip must be reachable on touch (tap), not hover-only.
- Keep `aria-label`s on switch and delete.

---

### UX-B7: Log Activity — collapse picker after selection

**Type:** Frontend

**Problem:** After selecting an exercise, the full class/exercise picker stays expanded, pushing session details below the fold.

**Reuse/Extend:**
- Add local `useState` for collapsed state in `LogActivityScreen.tsx`. Reuse the existing grouped picker for the expanded view and the existing selected activity/class lookup for the collapsed summary.

**Acceptance criteria:**
- Selecting an exercise collapses the picker to a one-line summary (class name + exercise name) with a "Change" affordance.
- Activating "Change" re-expands the full picker.
- Once an exercise is selected, session details (Date, Duration, RPE, feel) are visible without scrolling past the full picker.
- Pre-selected activity (from a suggestion tap, `initialActivityId`) and edit mode (`logId`) start collapsed.

**Edge cases:**
- Invalid/inactive `initialActivityId` → start expanded (nothing validly selected to collapse to).
- Changing the exercise after entering details → keep entered duration/RPE/feel; only the activity changes (don't reset the form unless the unit change requires it).
- No active activities at all → existing empty-state path is unaffected.

---

### UX-B8: Load risk — actionable guidance strip

**Type:** Frontend

**Problem:** `LoadRiskSection` shows state but no guidance on what to do.

**Reuse/Extend:**
- Derive overall state from existing `ruleLimitRows` / `weekDays` in `LoadRiskSection.tsx`. Reuse existing caution/danger colour tokens. Read-only — no new screens, no navigation.

**Acceptance criteria:**
- Caution overall state shows a yellow advisory strip with brief guidance.
- Danger overall state shows a red advisory strip with brief guidance.
- Safe state shows no extra strip.
- Existing progress bars and the 7-day strip are unchanged.

**Edge cases:**
- Mixed rows (one danger, others safe) → overall state is the worst row's state.
- No rules configured → no strip (don't show guidance for a system with no caps).
- Copy stays advisory, not alarmist; product-voiced.

---

### UX-B9: Dashboard sub-tabs (Today / Metrics / Safety)

**Type:** Frontend (largest ticket — do last)

**Problem:** The Dashboard stacks 10+ sections vertically; daily actions are buried under metrics.

**Reuse/Extend:**
- Reuse the existing `SegmentedControl` (`components/ui/SegmentedControl.tsx`) for the tab switcher — do not build a new tab control.
- Extract three **page-local** components in `components/screens/` (per `docs/patterns.md` screen-orchestration; these are feature-specific, not shared): `DashboardTodayTab`, `DashboardMetricsTab`, `DashboardSafetyTab`.
- All three receive the same `engine` prop already passed to `DashboardScreen` — no new data fetching, no state lifting, no duplicated summary math (`docs/patterns.md` "Dashboard data composition").
- Persist the active tab in `localStorage` (page-local view preference; there is no settings backend — see BACKLOG "Settings preference toggles").

**Tab contents:**
- **Today:** greeting + date, check-in status (UX-A1), `SuggestedActivityCard`, and one at-a-glance load-risk indicator.
- **Metrics:** This week weekly targets, `GoalsCard`.
- **Safety:** `WeeklyLoadGraph`, `LoadRiskSection` (with UX-B8), `BlockSafetyMapSection` (with UX-A9), Activity Status (with UX-B4).

**Acceptance criteria:**
- Three tabs render their assigned section groups with no bleed between tabs.
- Active tab persists across reloads via `localStorage`.
- `DashboardScreen` stays a thin orchestrator delegating to the three tab components (`docs/patterns.md` "Screen orchestration").
- All existing callbacks (`onOpenCheckIn`, `onOpenLogActivity`, `onQuickLog`) reach the Today tab unchanged.
- Existing Dashboard behaviour within each section is preserved; only their grouping changes.

**Edge cases:**
- Unknown/corrupt `localStorage` value → default to "Today".
- Greeting + date placement: decide whether it lives on the Today tab or as a persistent header above the tabs; keep it from disappearing on Metrics/Safety if that reads oddly.
- Existing `DashboardScreen` tests will move with their sections — update them to target the new tab components rather than asserting everything renders at once.
- Owner CLAUDE.md note: "4 preview tiles … overview at a glance without having to hover and click." **Confirmed acceptable by owner 2026-06-12** — the 3-tab split is approved provided the Today tab carries an at-a-glance overview (greeting, check-in status, suggestions, and the load-risk indicator) so essential status is visible without switching tabs.

---

## Group C — UX Follow-Up Polish

Owner review after completing Group A/B surfaced three small usability corrections. These are part of the same UX overhaul PR and are frontend-only. No API, backend, schema, or shared state changes.

---

### UX-C1: Quick Log — hide minute-unit volume control

**Type:** Frontend

**Problem:** Quick Log still shows a separate Volume control for activities whose volume unit is `minutes`. This duplicates Duration in the same way UX-A6 already fixed on the full Log Activity screen.

**Reuse/Extend:**
- Reuse the minute-unit behavior from `LogActivityScreen.tsx`: minute-unit activities do not show a separate Volume input, but their submitted `volumeValue` remains derived from `duration`.
- Edit `InlineLogSheet.tsx`. Do not introduce a new shared form abstraction; this is a local parity fix between the quick-log sheet and the full log form.
- Stored minute unit token is `minutes`.
- Keep `checkViolations` fed with the effective volume so minute-based daily/weekly volume rules still evaluate during quick log.

**Acceptance criteria:**
- When the quick-log activity has `defaultVolumeUnit === 'minutes'`, the sheet shows Duration but no separate Volume stepper.
- Submitting a minute-unit quick log sends `durationMinutes` equal to the chosen duration.
- Submitting a minute-unit quick log sends `volumeValue` equal to the chosen duration and `volumeUnit` equal to `minutes`.
- Live rule-violation checking for minute-unit activities uses the chosen duration as the effective volume.
- Non-minute units (`km`, `sets`, `reps`, etc.) still show the Volume stepper and keep their current defaults and increments.

**Edge cases:**
- Opening quick log for a minute-unit activity resets the duration to the existing quick-log default and does not keep a stale hidden volume from a previous activity.
- Switching from a minute-unit quick log to a non-minute quick log restores the Volume stepper with the existing unit-specific default.
- Danger override behavior and save-error handling are unchanged.

---

### UX-C2: Log History — two-line row meta and no duplicate minute volume

**Type:** Frontend

**Problem:** Each Log History row currently spreads key details over several lines: activity title on the left, Edit/RPE/status/delete slightly lower on the right, and duration/volume below the title. Minute-unit logs also duplicate the same value as both duration and volume (for example, `20 min · 20 minutes`).

**Reuse/Extend:**
- Edit the page-local `LogRow` in `LogHistoryScreen.tsx`.
- Reuse the existing `DeleteButton`, `Pill`, `feelLabel`, violation message rendering, and activity-name lookup.
- This is a display-only change. Do not change the log data model, API mappers, or stored minute-unit values.

**Acceptance criteria (revised 2026-06-16 — owner correction after initial single-line shipment didn't read as intended):**
- A log row's first line contains the activity title on the left and the status pill (`Fine`, `Discomfort`, `Bad`) right-aligned on the same line — nothing else on that line.
- A log row's second line contains, left-aligned: duration, optional non-minute volume, and the RPE pill when available, in that order.
- The same second line contains, right-aligned: the Edit action when available, then the delete icon — delete is the furthest-right item in the row overall.
- Minute-unit logs show duration only (for example, `20 min`) and do not also show `20 minutes`.
- Non-minute logs still show duration plus volume (for example, `30 min · 3 km`).
- Existing violation message rendering stays beneath both lines.
- Incident rows from UX-B1 are unchanged.

**Edge cases:**
- Long activity titles truncate rather than pushing the status pill out of line 1.
- On narrow screens, the second line's left-aligned meta group and right-aligned actions group may wrap as groups if needed, but the title, status pill, and delete action must remain visually coherent and the delete icon remains last.
- Logs with no RPE omit the RPE pill without leaving an awkward gap.
- Logs with `volumeValue <= 0` or no `volumeUnit` show duration only.

---

### UX-C3: Edit Rules — two-line mobile row layout

**Type:** Frontend

**Problem:** UX-B6 made rule rows compact, but the one-line layout is too dense on mobile. The number input, unit, plus/minus buttons, toggle, title, info, and delete control compete for one row.

**Reuse/Extend:**
- Edit the existing `RuleRow` in `EditBlockRulesScreen.tsx`; keep the work scoped to the row component.
- Reuse the existing inline switch markup, `DeleteButton`, helper/info affordance, threshold draft state, unit select, and increment/decrement handlers.
- Do not introduce a new shared stepper component unless the Implementer finds the same pattern is already shared elsewhere and can be extended cleanly.

**Acceptance criteria:**
- Each rule row uses two visual lines:
  - Line 1: rule title and info affordance on the left; enabled/disabled toggle on the far right.
  - Line 2: threshold controls centered as a group; delete icon on the far right.
- The threshold control order is `minus button`, `number input`, `plus button`, then unit.
- For volume-cap rules, the unit select appears to the right of the plus button.
- For non-volume rules, the static unit label appears to the right of the plus button.
- The number input is sized for mobile use without reserving unnecessary native spinner/hover space; explicit plus/minus buttons remain the primary adjustment controls.
- Toggle, threshold edit, unit selection, increment/decrement, helper info, and delete behavior are unchanged.
- Disabled rules still show the first line and delete control; the threshold controls are hidden or visually inactive consistently with the current disabled behavior.

**Edge cases:**
- Long class/rule/exercise labels truncate on the first line and do not push the toggle off-screen.
- The centered threshold group remains centered even when the unit label/select has different widths (`days`, `x/wk`, `minutes`).
- The delete button remains reachable as a 44px touch target and does not shift the centered threshold group.
- The helper info affordance remains usable on touch, not hover-only.

---

## Backlog Additions

To append to `plans/BACKLOG.md` (already drafted in the same commit as this plan):

- True streak counter (replace retired clean-streak UI; derive from weekly-target history)
- Load breakdown screen (tap-through from `LoadRiskSection`)
- Block safety map interactivity (tap a day → rules that applied)
- Activity status → link to Edit Rules from the UX-B4 expanded panel

---

## Ticket Order (commit sequence) & Rationale

Quick wins first (low risk, immediate user-visible clarity, no cross-ticket coupling), then structural. Group C follows the completed/near-complete Group A/B work because it depends on the resulting screens and shared primitives.

```
Group A (independent quick wins):
UX-A1  check-in badge
UX-A2  load risk daily/weekly prefix
UX-A3  activity status done-today meta
UX-A4  remove clean streak
UX-A5  DeleteButton primitive          ← must precede UX-B6
UX-A6  log activity minute-unit guard
UX-A7  actionable empty states
UX-A8  post-incident cleanup
UX-A9  block safety map legend          ← consumed by UX-B9 Safety tab
UX-A10 load risk label + status-row fix ← no cross-ticket dependencies

Group B (structural, dependency-ordered):
UX-B1  incidents in log history         ← must precede UX-B2 (shared render path)
UX-B2  log history day/week breaks
UX-B3  all-classes orphan fix           ← Part 2 frontend precedes UX-B5 grouping
UX-B4  activity status expandable        ← consumed by UX-B9 Safety tab
UX-B5  rules preview grouping
UX-B6  edit rules compact row            ← depends on UX-A5
UX-B7  log activity collapse picker
UX-B8  load risk guidance strip          ← consumed by UX-B9 Safety tab
UX-B9  dashboard sub-tabs                ← last; composes A1, A9, B4, B8

Group C (follow-up polish, after A/B):
UX-C1  quick-log minute-unit parity      ← mirrors UX-A6 for InlineLogSheet
UX-C2  log-history row meta layout       ← builds on B1/B2 + A5 DeleteButton
UX-C3  edit-rules two-line row layout    ← refines B6, depends on A5
```

**Dependencies:** A5→B6; A9/B4/B8→B9; B1→B2; B3(Part 2)→B5; A6→C1 conceptually; A5/B1/B2→C2; A5/B6→C3.

---

## Owner Decisions — Resolved 2026-06-12

1. **UX-B3 cascade vs restrict** → ✅ **`ON DELETE CASCADE`.** Deleting a class auto-removes its rules; no separate prompt. Prevents orphans recurring.
2. **UX-B3 Part 1 (production deletion)** → ✅ **Approved.** Owner-run or owner-approved; not executed autonomously.
3. **UX-B9 vs 4-tile preference** → ✅ **3-tab split approved**, provided the Today tab carries the at-a-glance overview (check-in, suggestions, load-risk indicator).
4. **UX-A3 secondary line** → ✅ **One line only: "{n} sessions this week"**, plus **units completed this week beside the title** (e.g. "5 km"). Drop the recency phrase. See UX-A3 for the mixed-unit edge case (the one remaining sub-decision: omit title units when a class logged mixed units this week — flag if mixed-unit classes turn out common).
5. **Group C follow-up polish** → ✅ **Approved 2026-06-15.** Quick Log hides minute-unit volume while submitting duration as effective volume; Log History status pill stays on the title line and right aligned; Edit Rules uses a two-line mobile row with unit after the plus button.

**No open blockers remain.** The plan is ready for Test Writer handoff.

---

## Notes for Implementer

- All new UI state is ephemeral `useState`; nothing goes to Context or a store. `localStorage` only for the dashboard tab preference (UX-B9).
- **Only UX-B3 touches backend/schema/data** (Parts 1 & 3 — both owner-approved: orphan cleanup + `ON DELETE CASCADE` migration). Every other ticket is frontend-only — no `api-map.md` / `database-schema.md` changes. Note UX-A3 adds a derived this-week computation in the engine layer, but no API/schema change.
- Reuse `SegmentedControl` (tabs) and the existing inline rule switch markup — do not build new toggle/tab primitives.
- `DeleteButton` (UX-A5) is the one new shared primitive; it is reused by UX-B6.
- Group C is frontend-only follow-up polish. Keep C1 local to `InlineLogSheet`, C2 local to `LogHistoryScreen`, and C3 local to `EditBlockRulesScreen`.
- TDD gate applies per `AGENTS.md`: failing test before code; targeted tests green before each ticket commit; `make test` green before handoff.
- Test names describe behaviour, not ticket IDs (`docs/patterns.md` "Test naming").
- Out-of-scope findings go to `plans/BACKLOG.md`, not into these tickets.
```
