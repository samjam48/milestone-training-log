# Phase 6 Cleanup — Seed violations + live UX fixes
*Chore / UX on `feat/phase-6-frontend` | Date: 2026-05-28*

## Context

Phase 6 integration (`plans/tickets-phase-6-frontend-2026-05-28.md`, F1.1–F1.4) is functionally complete.
Owner manual sign-off surfaced one **backend/data** defect and three **frontend** gaps that block
normal logging workflows. Calendar heatmap on the dashboard remains **Phase 7** per TRD / BACKLOG —
not part of this file.

**Prerequisites:** F1.1–F1.4 merged or equivalent on `feat/phase-6-frontend`; owner re-seed after
C6.1 (` .venv/bin/python3 -m scripts.seed` from `backend/`).

## Goal

Close post-integration defects so dashboard, log forms, and suggestion CTAs behave as designed,
without backend schema or API changes.

## Ticket ordering rationale

**C6.1** unblocks dashboard and picker data (seed must validate before UX polish is meaningful).

**C6.2** bundles two small, independent HTML/layout fixes (no shared state) to keep cleanup lean.

**C6.3** wires overlay prefill through `App` — depends on stable dashboard + log overlay from F1.1.

## Owner decisions (2026-05-28)

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Heatmap on home | **Deferred Phase 7** (Settings / block review) |
| 2 | UX fixes branch | **Same branch** `feat/phase-6-frontend` |
| 3 | Strava import UI | **Not in repo** — no ticket; when added, reuse `step="any"` on volume fields |
| 4 | Suggestion `id` semantics | **Activity id** — `compute_suggestions` sets `id` to `activity["id"]` (no class→activity mapping) |

## Planner assumptions

| # | Topic | Assumption |
| --- | --- | --- |
| A | Sticky bar placement | Pin action bar **above** fixed `BottomTabBar` inside Log History layout (flex `shrink-0` + scroll region), not a global AppShell change unless layout chain requires `min-h-0` / `h-full` on main |
| B | Decimal step | `step="any"` on volume `NumberField`; duration minutes stay integer (`step={1}` or omit) |
| C | Prefill lifetime | Clear `initialActivityId` when overlay closes; opening log from Log tab without a suggestion passes no prefill |
| D | Tests | Extend `App.test.tsx` for prefill; optional focused test for `NumberField` / Log History layout if Test Writer prefers component-level |

---

## C6.1 — Seed violation snapshots use snake_case

**Alias:** (seed fix — no F-UX id)  
**Type:** backend + tests  
**Depends on:** Phase 5 seed on `main`  
**Status:** **DONE** — commit `372c2cd`

### Problem

`GET /api/dashboard` returned **500** when seeded logs included `rule_violations_at_log`.
`_violation()` in `backend/scripts/seed.py` wrote camelCase (`ruleId`, `ruleType`);
API schemas expect snake_case (`rule_id`, `rule_type`).

### Acceptance criteria (verified in `372c2cd`)

- `backend/scripts/seed.py` `_violation()` emits `rule_id`, `rule_type`.
- `backend/app/tests/test_seed_data.py` asserts snake_case in stored JSON.
- `backend/app/tests/test_dashboard_api.py` (or equivalent): after seed/fixture with violations,
  `GET /api/dashboard` returns **200** and violations include `rule_id` when present.
- No frontend changes.

### Edge cases

- Existing owner DB files with camelCase JSON: **re-seed** acceptable (no migration ticket).
- Optional engine normalization of legacy blobs: **BACKLOG** only.

### Files

- `backend/scripts/seed.py`
- `backend/app/tests/test_seed_data.py`
- `backend/app/tests/test_dashboard_api.py`

### Owner follow-up

Re-run seed after deploy: `cd backend && .venv/bin/python3 -m scripts.seed`

---

## C6.2 — Log form decimals + sticky Log History CTAs

**Alias:** F-UX-1 + F-UX-2 (combined)  
**Type:** frontend  
**Depends on:** C6.1 done (dashboard loads); F1.1 app shell  
**Priority:** P1

### Problem

1. **Decimals:** `LogActivityScreen` `NumberField` uses `<input type="number">` without `step`.
   HTML default `step=1` rejects values like `1.5` km before submit (browser validation tooltip).
   Backend already accepts floats (`volume_value: 1.5` in load tests).
2. **Sticky CTAs:** Log History “+ Log Activity” / “+ Log Incident” sit at the bottom of the
   scrollable column. Long history scrolls them off-screen; tab bar stays fixed.

### Acceptance criteria

- `NumberField` in `LogActivityScreen` (volume input at minimum) sets `step="any"` so
  `1.5`, `0.25`, etc. pass native validation and submit to the API.
- Duration minutes input remains whole-minute friendly (integer step acceptable).
- With a long seeded log history (or test fixture with many rows), **+ Log Activity** and
  **+ Log Incident** remain visible without scrolling past all rows — pinned above the tab bar
  while the month/day list scrolls independently.
- Tab bar still fixed; overlay flows (check-in, log activity full-screen) unchanged.
- `make lint` / targeted Vitest for touched files pass (no new backend work).

### Edge cases

- Empty history: action bar still visible at bottom of screen (not only after scroll).
- Very small viewports: bar does not overlap tab bar (respect `pb-tabbar` / safe-area spacing).
- Volume `0` / empty field behavior unchanged (placeholder clearing).

### Reuse / extend

- `frontend/src/components/screens/LogActivityScreen.tsx` — `NumberField`
- `frontend/src/components/screens/LogHistoryScreen.tsx` — flex column + action bar
- `frontend/src/components/ui/AppShell.tsx` — only if `h-full` chain needs adjustment
- `frontend/src/components/ui/BottomTabBar.tsx` — spacing reference for bottom inset

### Out of scope

- Strava import screen (not implemented)
- Changing volume validation rules on backend
- Moving CTAs into `AppShell` globally (only if Log History layout fix requires minimal hook)

### Suggested verification

```bash
make lint
npm --prefix frontend run test -- --run App.test.tsx  # regression
# Manual: Log tab → scroll history → CTAs visible; Log Activity → enter 1.5 km → submit
```

---

## C6.3 — Dashboard suggestion → Log Activity prefill

**Alias:** F-UX-3  
**Type:** frontend  
**Depends on:** C6.2 optional (orthogonal); F1.3 dashboard suggestions in hook  
**Priority:** P2

### Problem

`LogActivityScreen` accepts `initialActivityId`, but `App` never passes it.
`DashboardScreen` wires `SuggestedActivityCard` with `onPick={() => onOpenLogActivity()}`,
dropping the picked suggestion. CTA copy (“Log stretching”) implies the picker should open
with that activity selected.

### Acceptance criteria

- Tapping a **safe** or **caution** suggestion CTA on the dashboard opens the Log Activity
  overlay with the matching activity **pre-selected** in the picker (`initialActivityId`).
- `suggestion.id` is treated as **activity id** (matches `compute_suggestions` / `SuggestionRead.id`).
- Opening Log Activity from the Log tab (generic “+ Log Activity”) does **not** force a prior
  suggestion selection (no stale prefill).
- Closing the overlay (back or complete) clears prefill state for the next open.
- **Danger** suggestions remain informational only (no CTA — existing `SuggestedActivityCard` behavior).
- Vitest: extend `App.test.tsx` (or equivalent) — mock engine with one `safe` suggestion and
  matching `activities` entry; click suggestion CTA; assert picker shows that activity selected
  (selected row state, heading, or `aria-selected` — Test Writer picks stable selector).

### Edge cases

- Suggestion `id` not found in `activities` (inactive / stale): open overlay with no selection
  (same as today) rather than error.
- Multiple opens: second suggestion overwrites prefill; close resets.
- Dashboard `onOpenLogActivity` signature may gain optional `activityId?: string`; Log tab
  callback stays zero-arg.

### Reuse / extend

- `frontend/src/App.tsx` — overlay state + `initialActivityId` threading
- `frontend/src/components/screens/DashboardScreen.tsx` — `onPick={(s) => ...}`
- `frontend/src/components/screens/LogActivityScreen.tsx` — existing prop
- `frontend/src/components/composites/SuggestedActivityCard.tsx` — `onPick(suggestion)` already typed
- `frontend/src/hooks/useMilestoneEngine.ts` — `suggestions` + `activities` (no hook change expected)
- `frontend/src/test/mockEngine.ts` — fixture data for test
- `frontend/src/App.test.tsx`

### Out of scope

- Backend suggestion shape changes
- Prefill volume/duration/RPE from history
- Goals / Settings / heatmap (Phase 7)

### Doc fix (optional, same ticket)

- `SuggestedActivityCard.tsx` comment “activity-class id” → “activity id” if touched

### Suggested verification

```bash
npm --prefix frontend run test -- --run App.test.tsx
# Manual: Dashboard → "Log …" on safe suggestion → picker shows that activity
```

---

## Out of scope (this cleanup file)

- `CalendarHeatmap` on dashboard or Settings (Phase 7 — `plans/TRD.md`, `plans/BACKLOG.md`)
- Phase 8 dashboard fetch error UI
- Migrating camelCase violation JSON in old DBs (re-seed)
- Engine normalization of legacy violation key casing
- New API endpoints or Alembic revisions

---

## Verification (cleanup phase complete)

```bash
cd backend && .venv/bin/python3 -m scripts.seed   # after C6.1 if not already
make lint
make test
docker compose up
```

Expected: dashboard 200 with violations; decimal km logs; Log tab CTAs always reachable;
suggestion CTA pre-selects activity in log overlay.

---

## Ticket summary

| ID | Alias | Priority | Status | Effort |
| --- | --- | --- | --- | --- |
| C6.1 | Seed snake_case | P0 | **DONE** (`372c2cd`) | backend + tests |
| C6.2 | F-UX-1 + F-UX-2 | P1 | Ready for Test Writer | ~2 files |
| C6.3 | F-UX-3 | P2 | Ready for Test Writer | App + Dashboard + test |

---

**Status:** `SIGNED OFF` — Cleanup ticket set ready for Test Writer on **C6.2** (C6.1 already landed).
