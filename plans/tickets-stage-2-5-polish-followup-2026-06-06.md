# Stage 2.5 — Polish follow-up (owner feedback)

*Source: owner smoke on `feat/stage-2-5-usage-logic` | Date: 2026-06-06*  
*Owner decisions locked: 2026-06-06 (Q1–Q5)*  
*Rule taxonomy signed off: 2026-06-06*

**Status: SIGNED OFF** (planner — ready for orchestrator per ticket on `feat/stage-2-5-usage-logic` or follow-on branch).

| Item | Value |
| --- | --- |
| **Ticket file** | `plans/tickets-stage-2-5-polish-followup-2026-06-06.md` |
| **Ticket count** | 6 (P25.2–P25.7) |
| **Unresolved** | None |

---

## Owner decisions locked

| # | Topic | **Decision** |
| --- | --- | --- |
| **Q1** | Load caps | **No abstract load points** for users. **No class-level load/volume caps** for now. **Exercise-only** volume caps with a **unit picker** (`km`, `hours` — hours derived from minutes logged / duration). |
| **Q2** | Exercise rules | Same **sanitized spacing/frequency rules** as class (see P25.6) **plus** daily and weekly **volume caps** with unit. |
| **Q3** | Modals | **Centered on all screen sizes** — no bottom sheets for Settings / activity flows. |
| **Q4** | Edit activity modal | **No Deactivate** in modal — row-level Deactivate on Settings activity list stays. |
| **Q5** | Date picker | **Compact popover** anchored to the date field on all phones; not full viewport width. |

---

## Why rules feel confusing today

| Engine type | What it actually measures | Current UI label |
| --- | --- | --- |
| `rest_between_class` | **Cooldown:** minimum whole days since the *last* session in this class before doing it again today | “Rest between class” / “Min rest between sessions” |
| `frequency_limit` | **Quota:** maximum number of **sessions** (logs) in the rolling window (usually 7 days), including today | “Frequency limit” / “Max sessions per week” |
| `consecutive_day_limit` | **Streak cap:** maximum **consecutive calendar days in a row** with ≥1 session (any exercise in class) | “Consecutive day limit” |
| `weekly_load_cap` | **Abstract load score** (volume × RPE) — **dropping from user-facing UI** per Q1 | “Weekly load cap” + unit `load` |
| `weekly_activity_count` | Deprecated cross-class session cap | Already removed |

These three spacing rules are **distinct in the engine** but read similarly in the UI. P25.6 gives them plain-English names and helper copy; we do **not** merge engine types in this batch unless a later ticket proves redundancy.

---

## Rule taxonomy (owner signed off 2026-06-06)

### Class-level (no volume/load caps)

| User-facing name | Engine `rule_type` | User sets | Helper copy (example) |
| --- | --- | --- | --- |
| **Minimum days between sessions** | `rest_between_class` | N days | “Wait at least N days after your last session in this class before doing it again.” |
| **Maximum sessions per week** | `frequency_limit` | N sessions (window fixed 7d) | “At most N sessions in this class in any 7-day period.” |
| **Maximum consecutive days** | `consecutive_day_limit` | N days | “No more than N days in a row with a session in this class.” |

### Exercise-level (class spacing rules + volume caps)

| User-facing name | Engine `rule_type` | User sets | Notes |
| --- | --- | --- | --- |
| (same three as class) | same | same | Scoped to one `activity_id` |
| **Maximum volume per week** | `weekly_volume_cap` | N + unit (`km`, `minutes`, `hours`) | `limit_unit` on rule; **hours** computed from logged duration/volume per engine convention (document in ticket impl) |
| **Maximum volume per day** | `daily_volume_cap` | N + unit (`km`, `minutes`, `hours`) | **In scope** (owner confirmed); same unit rules as weekly |

**Remove from add-rule UI:** `weekly_load_cap` (class and exercise). Existing DB rows: disable or migrate in P25.7 (owner prefers no new load-point rules).

---

## P25.6 — Rule taxonomy: plain labels & distinct helpers

**Type:** frontend (+ copy in `docs/api-map.md` / Settings rule summary)  
**Depends on:** none  
**Blocks:** P25.7

### Acceptance criteria

- Edit Rules and Settings block summary use **recommended user-facing names** (table above), not internal `rule_type` strings.
- One-line **helper text** under each rule type in add/edit flows explaining the difference (rest vs weekly quota vs consecutive streak).
- Class **add rule** picker shows only the three spacing/frequency types (no load cap).
- Exercise **add rule** picker shows spacing types + **daily and weekly volume caps** (not `weekly_load_cap`).
- Tests: labels render; add pickers exclude `weekly_load_cap`.

### Edge cases

- Legacy `weekly_load_cap` rows still in DB: show read-only/disabled with “legacy — replace with volume cap” or hide from add flows only (P25.7 handles data).

---

## P25.7 — Exercise-only volume caps with units

**Type:** full-stack (frontend + engine verification + optional migration)  
**Depends on:** P25.6  
**Blocks:** none

### Acceptance criteria

- **No new class-level** volume or load caps in UI.
- Exercise rules: create/patch `weekly_volume_cap` and `daily_volume_cap` with **`limit_unit`** (`km`, `minutes`, `hours`).
- **Hours:** sum from logs using `duration_minutes / 60` (or documented mapping when `volume_unit` is minutes) — unit tests for conversion.
- **Km:** sum `volume_value` where `volume_unit` matches `limit_unit`.
- Display threshold with selected unit in Edit Rules and dashboard load-risk exercise bars.
- Deprecate **new** `weekly_load_cap` creates (align with B2 pattern); optional data step: disable existing exercise/class `weekly_load_cap` rules.
- Tests: API create exercise volume cap; engine violation; UI unit picker persists `limit_unit`.

### Edge cases

- Log unit mismatch (e.g. cap in km, log in minutes) → does not count toward cap (existing engine behaviour).
- Class-level legacy `weekly_load_cap` rows: disabled, not shown in add UI.

---

## P25.2 — Centered modal pattern (Settings class flows)

**Type:** frontend  
**Depends on:** Q3 locked  
**Blocks:** P25.3, P25.4

### Acceptance criteria

- Shared **`CenteredModal`** (or equivalent): `fixed` center alignment, `max-w` ~360–400px, `max-h` with internal scroll, scrim, safe-area padding.
- Apply to `EditActivityClassForm`, `NewActivityClassForm`, `DeleteActivityClassDialog`.
- **No** `bottom-0` sheet layout; **no** drag handle.
- Retain: X close, Save at bottom (edit class), two-step delete.
- Tests: `data-testid` / class for centered panel; dialog a11y.

---

## P25.3 — Edit activity as centered modal

**Type:** frontend  
**Depends on:** P25.2  
**Blocks:** none

### Acceptance criteria

- Settings → Edit activity opens **centered modal** (not `ActivityManagerScreen` stack).
- Fields: name, class, type, default volume unit.
- X close + **Save at bottom**; **no Deactivate** (Q4).
- Remove Settings → `pushScreen('activity-manager')` path; stack route removable if unused elsewhere.
- Tests: modal save PATCH; cancel; no deactivate control in modal.

---

## P25.4 — New activity: centered modal

**Type:** frontend  
**Depends on:** P25.2  
**Blocks:** none

### Acceptance criteria

- `NewActivitySheet` uses `CenteredModal`; same fields and callbacks.
- X + Create at bottom.
- Tests updated.

---

## P25.5 — Date picker: compact popover

**Type:** frontend  
**Depends on:** Q5 locked  
**Blocks:** none

### Acceptance criteria

- Replace bottom-sheet `DatePickerModal` with **popover** anchored to date field (`LogActivityScreen` create + edit).
- Width **content-sized** (not `inset-x-0`); fits on small phones without full screen.
- Position: prefer below field; flip above if clipped.
- Light scrim or none; `maxDate = today` unchanged.
- `InlineLogSheet` unchanged (today-only).
- Tests: popover association, compact width, future dates disabled.

---

## Suggested batch order

1. **P25.2** — `CenteredModal` + class flows  
2. **P25.3** + **P25.4** — activity modals  
3. **P25.5** — date popover  
4. **P25.6** — rule labels & pickers  
5. **P25.7** — exercise volume caps + deprecate load points  

*(UI polish first while rule design is stable; P25.6–P25.7 can swap earlier if you prefer rules before modals.)*

---

## BACKLOG mapping

| Owner feedback | Ticket |
| --- | --- |
| Load cap units / exercise-only / no class load caps | P25.7 |
| Confusing rule names (rest vs frequency vs consecutive) | P25.6 |
| Modals bottom-aligned | P25.2, P25.3, P25.4 |
| Date picker too large | P25.5 |

---

## Owner confirmations (2026-06-06)

| # | Question | **Confirmed decision** |
| --- | --- | --- |
| R1 | Class-level caps | Three spacing rules only; **no** class volume/load caps |
| R2 | Exercise caps | Spacing rules + **daily** and **weekly** volume caps with `km` / `minutes` / `hours` |
| R3 | Load points | **Remove** `weekly_load_cap` from user-facing add flows; no abstract load score for users |
| R4 | Rule engine merge | **Rename and clarify only** — keep `rest_between_class`, `frequency_limit`, `consecutive_day_limit` as separate types |
| R5 | Modals | Centered on all screens; edit activity modal **without** deactivate |
| R6 | Date picker | Compact popover anchored to field on all phones |
