# Combined performance load + class load weight — Tickets

*Source: `plans/decision-combined-load-class-weight-2026-08-18.md`, `plans/feature-brief-combined-load-class-weight-2026-08-18.md`, `plans/technical-design-combined-load-class-weight-2026-08-18.md`, `AGENTS.md`, `docs/architecture.md`, `docs/patterns.md`, `docs/api-map.md`, `docs/database-schema.md` | Date: 2026-08-18*
*Branch: `feat/combined-load-class-weight`*
*Workflow: Test Writer → Implementer → Reviewer per ticket. Failing tests before production code. No push without owner instruction.*

---

## Owner decisions locked

| # | Topic | Decision |
| --- | --- | --- |
| D1 | Graph scope | All `performance` classes on **one** combined load-tax series (no class switcher). |
| D2 | Class field | `activity_classes.load_weight` float, default `1.0`, range `0..10` (`0` mutes). |
| D3 | Math | `daily_combined(D) = Σ weight(C) * daily_load_tax(C, D)`; rolling 7 uses existing `LOAD_TAX_RECENCY_WEIGHTS`. |
| D4 | Weight applies to | Dashboard `load_series`, block-review `load_series`, load-risk `week_days` strip daily tax. |
| D5 | Weight does **not** apply to | `rule_limit_rows`, suggestions, log-time violations, per-class delayed tax. |
| D6 | Dashboard `graph_class_id` | `null` (field retained). |
| D7 | Graph title | **Performance load**. |
| D8 | Recovery UI | Hide weight field for recovery classes; persist default `1.0`. |
| D9 | Recompute job / snapshots | Out of scope — on-read only. |

---

## Scope summary

| Area | Tickets |
| --- | --- |
| Schema + class API | CLW.B1 |
| Load engine combine + strip | CLW.B2 |
| Dashboard + block review wiring | CLW.B3 |
| Settings class weight UI | CLW.F1 |
| Safety graph chrome + patterns | CLW.F2 |
| Owner smoke | CLW.O1 |

---

## Ticket ordering rationale

1. **CLW.B1** lands the column and class CRUD contract so engine dicts and frontend can depend on `load_weight`.
2. **CLW.B2** defines combined weighted math (+ shared daily helper for the strip) in isolation with engine tests.
3. **CLW.B3** switches dashboard and block review onto that helper, nulls `graph_class_id`, updates api-map.
4. **CLW.F1** can start after B1 (forms/mappers); should not assume B3 series semantics beyond reading `loadWeight` on classes.
5. **CLW.F2** after B3 so title matches combined series (`graphClassId === null` → Performance load).
6. **CLW.O1** after F1+F2+B3 on a build with migrations applied.

---

## CLW.B1 — `load_weight` schema + class API

**Type:** backend + migration + docs  
**Depends on:** none (architect SIGNED OFF)  
**Blocks:** CLW.B2, CLW.F1  
**Reuse:** `backend/app/models/activity.py` (`ActivityClass`), `backend/app/schemas/activity_classes.py`, `backend/app/services/activity_classes.py`, `backend/app/routers/activity_classes.py`, `backend/alembic/versions/`, `backend/app/tests/test_activity_classes_api.py`, `backend/app/tests/test_models_schema.py`, `backend/app/tests/test_migrations.py`, `docs/database-schema.md`

### Acceptance criteria

- Alembic revision adds `activity_classes.load_weight` as non-null float/real with server default `1.0`; existing rows backfill to `1.0`.
- SQLModel `ActivityClass` includes `load_weight: float` defaulting to `1.0`.
- `ActivityClassCreate`: optional `load_weight` (default `1.0` when omitted).
- `ActivityClassPatch`: optional `load_weight`.
- `ActivityClassRead`: always includes `load_weight`.
- Service validation rejects non-finite values and values outside `[0, 10]` with HTTP `422` (or existing validation error shape for class create/patch).
- `GET/POST/PATCH` activity-class API round-trips `load_weight`.
- `docs/database-schema.md` lists `load_weight` under `activity_classes`.
- Seed helpers / test seeds that construct `ActivityClass` rows still work (explicit `1.0` or model default).

### Edge cases

- Omit `load_weight` on create → stored `1.0`.
- Patch other fields only → weight unchanged.
- Patch `load_weight` to `0` (mute) and `10` (max) succeed; `-0.1` and `10.1` fail.
- Recovery-type class may still store `load_weight` (UI hides it later); API does not forbid weight on recovery.

### Test strategy

- Migration/schema tests: column exists; default applied.
- API tests: create default, create with `2.0`, patch weight, reject out-of-range / null if explicit null forbidden (match existing patch null policy for other fields).

---

## CLW.B2 — Combined weighted load series + strip daily helper

**Type:** backend  
**Depends on:** CLW.B1 (`load_weight` on class dicts)  
**Blocks:** CLW.B3  
**Reuse:** `backend/app/services/load_engine.py` (`_daily_load_tax_for_class`, `_recency_weighted_load_tax`, `compute_load_series`, `_strip_load_tax_for_day`, `LOAD_TAX_RECENCY_WEIGHTS`, `compute_load_risk_summary`), `backend/app/schemas/load_engine.py` (`ActivityClassDict`), `backend/app/services/load_queries.py` (`activity_class_dict`), `backend/app/tests/test_load_engine.py`, `backend/app/tests/test_wtl_b6_load_risk_summary.py` (or nearest strip tests)

### Acceptance criteria

- `ActivityClassDict` / `activity_class_dict` include `load_weight` (default `1.0` if older fixtures omit it during transition — prefer required key once B1 lands).
- New (or extended) pure helper(s) in `load_engine.py`:
  - Combined **daily** load tax for day `D` across all performance classes: `Σ load_weight(C) * daily_load_tax_for_class(C, D)`.
  - Combined **series** over `[start, end]`: each point’s `daily_load` = combined daily; `load` = recency-weighted sum of combined dailies using existing `LOAD_TAX_RECENCY_WEIGHTS`.
- Recovery classes contribute `0` regardless of `load_weight`.
- Weight `0` mutes a performance class’s contribution.
- Per-log load-tax formula (base, RPE tiers, rule proximity) is **unchanged**; weight applies after per-class daily aggregation (or equivalently per log × class weight — same result).
- `_strip_load_tax_for_day` (or replacement) uses the **same** combined daily function as series `daily_load`, still excluding same-day offset `0` for strip coloring (product quirk retained).
- `compute_load_risk_summary` week_days `state` reflects combined weighted strip tax (rule_limit_rows remain unweighted).
- Single-class `compute_load_series(class_id=...)` may remain for tests/legacy **only if** still needed; Safety/block-review must not depend on it after B3. Prefer one combined entry point documented in code comments briefly.
- Engine unit tests cover:
  - Two performance classes, equal raw daily tax, weights `1` and `2` → combined daily/rolling match `1*a + 2*b`.
  - Recovery logs ignored.
  - Weight `0` mutes.
  - Backfill on day `D-2` increases series points for `D-2`, `D-1`, and `D` (as_of).

### Edge cases

- No performance classes → empty series or all-zero points for the window (pick one; test it).
- Missing `load_weight` key on a dict during tests → treat as `1.0` only if needed for fixture migration; production dicts always set.
- Multiple logs same day across classes sum correctly under weights.

### Test strategy

- Prefer `test_load_engine.py` pure unit tests with in-memory dict fixtures (cheapest).
- Extend strip/risk summary tests only as needed to prove week_days use combined tax.

---

## CLW.B3 — Dashboard + block review use combined series

**Type:** backend + docs  
**Depends on:** CLW.B2  
**Blocks:** CLW.F2, CLW.O1  
**Reuse:** `backend/app/services/dashboard.py`, `backend/app/services/block_review.py`, `backend/app/tests/test_dashboard_api.py`, `backend/app/tests/test_dashboard_service.py`, `backend/app/tests/test_dashboard_graph_class_id_api.py`, block-review tests under `backend/app/tests/`, `docs/api-map.md`

### Acceptance criteria

- `get_dashboard` builds `load_series` via the **combined weighted** helper for the last 30 days ending `as_of` (not `resolve_graph_class_id` + single-class series).
- Dashboard response `graph_class_id` is always `null` when a series is returned (and when empty).
- Dashboard embedded `activity_classes` include `load_weight`.
- `get_block_review` uses the **same** combined weighted helper over the block date range, with `activity_classes` + `rules` so load **tax** (not legacy raw `volume×rpe`-only path) is used.
- Adding a backdated performance log in a non-former-graph class (e.g. second performance class) increases dashboard `load_series` points for that day and later days.
- Patching a class `load_weight` changes dashboard `load_series` on refetch without new logs.
- Rule-limit rows / weekly progress / suggestion buckets are unchanged in meaning (unweighted counts/volumes).
- `docs/api-map.md` updated:
  - `load_series` = combined weighted performance load tax (30-day dashboard; block range on review).
  - `graph_class_id` null for combined graph.
  - activity class read shape includes `load_weight`.
- Dead or misleading tests that require a non-null `graph_class_id` for a meaningful dashboard series are updated to the new contract.
- If `resolve_graph_class_id` has no remaining production callers, remove it (and tests) in this ticket; otherwise stop using it for dashboard/block-review series and leave a short comment at any residual call site.

### Edge cases

- No active weekly block → existing empty-series behavior preserved, still `graph_class_id` null.
- Only recovery activities logged → series present with zeros (or empty per B2 choice — match engine).

### Test strategy

- Dashboard API/service tests for null `graph_class_id`, multi-class contribution, weight patch effect.
- Block review service/API test asserting load-tax-shaped series moves when a second class logs (and is not plain volume×rpe single-class).
- Update `test_dashboard_graph_class_id_api.py` expectations to the null/combined contract (rename file only if necessary for clarity — optional).

---

## CLW.F1 — Settings: create/edit class `loadWeight`

**Type:** frontend  
**Depends on:** CLW.B1  
**Blocks:** CLW.O1  
**Reuse:** `frontend/src/types.ts`, `frontend/src/lib/api/mappers.ts`, `frontend/src/lib/api/activityClasses.ts`, `frontend/src/hooks/useMilestoneEngine.ts` (`NewActivityClassDraft`, `submitNewActivityClass`, patch class), `frontend/src/components/screens/SettingsScreen.tsx` (`NewActivityClassForm`, `EditActivityClassForm`), existing Settings form tests

### Acceptance criteria

- `ActivityClass` type includes `loadWeight: number`.
- Create/patch API mappers send/receive `load_weight` ↔ `loadWeight`.
- Dashboard/class list mappers populate `loadWeight` (default `1` if absent only as defensive parse — backend should always send it after B1).
- `NewActivityClassForm`: when type is **performance**, show numeric **Load weight** control defaulting to `1`; helper text explains it scales Safety load graph contribution (product tone, not ticket jargon).
- `NewActivityClassForm`: when type is **recovery**, hide the weight control; submit still sends `loadWeight: 1` (or omits and relies on API default — pick one and test it).
- `EditActivityClassForm`: same show/hide rules; prefill current `loadWeight`; save PATCHes weight for performance classes.
- Changing type performance → recovery in the form hides weight; submitted payload uses `1` for weight (or leaves stored weight untouched on type-only patch — prefer explicit `loadWeight: 1` on create; on edit type flip to recovery, either leave weight or set 1 — **document in test**: recommend leave stored weight unchanged if patch omits field, hide UI only).
- Hook/tests: `submitNewActivityClass` / patch paths include `loadWeight` for performance creates.
- No client-side load-tax math.

### Edge cases

- Invalid UI input (empty, >10): disable submit or block with inline validation before API call (match existing form validation style).
- Dashboard refetch after successful class patch invalidates/refetches as today so curve can update once B3 exists (existing invalidate on class patch is enough).

### Test strategy

- Mapper unit tests for `loadWeight`.
- Settings form tests: field visible for performance, hidden for recovery; submit payload contains expected weight.
- Extend `useMilestoneEngine` create-class test to assert `loadWeight` when provided.

---

## CLW.F2 — Safety graph chrome for combined series

**Type:** frontend + docs  
**Depends on:** CLW.B3  
**Blocks:** CLW.O1  
**Reuse:** `frontend/src/components/screens/DashboardSafetyTab.tsx` (`loadGraphTitle`), `WeeklyLoadGraph` / `LOAD_GRAPH_SUBTITLE`, `DashboardScreen*.test.tsx` (F10.5 title tests), `docs/patterns.md`

### Acceptance criteria

- When `graphClassId` is `null`, graph title is **Performance load** (replace current **Weekly load** fallback).
- Subtitle remains rolling 7-day / last 30 days messaging; may add short note that values are weighted by class load weight (optional one clause — keep readable).
- Tests that expected class name from `graphClassId` remain valid when id is non-null (legacy/fixtures); primary Safety path after B3 uses null → Performance load.
- Update F10.5 / Safety tab tests accordingly.
- `docs/patterns.md` **Load-tax stays in the load engine** section: one sentence that dashboard/block-review series are **combined across performance classes × `load_weight`**, computed only in `load_engine.py`.

### Edge cases

- `graphClassId` still set in old mocks → still show that class name (defensive); production dashboard sends null.

### Test strategy

- Component/screen tests for title string `Performance load` when `graphClassId === null`.
- No SVG geometry assertions.

---

## CLW.O1 — Owner smoke (local / production-like)

**Type:** review-heavy / manual  
**Depends on:** CLW.B3, CLW.F1, CLW.F2  
**Blocks:** merge readiness (owner decision)  
**Reuse:** live-like data on `feat/combined-load-class-weight`; Settings class editor; Safety tab; Log backfill

### Acceptance criteria

- Migrate DB; app boots; Settings shows load weight for performance classes.
- Set **Gentle boundary pushers** (or equivalent) to `1`, **Active exercise** to `2`.
- Safety **Performance load** curve is non-flat across days with boundary-pusher history (not Active-exercise-only spikes).
- Change Active exercise weight `2` → `1`; refresh → curve drops without re-logging.
- Backfill a boundary-pusher session ~2 days ago → prior-day region and 7D headline move.
- Load risk rule rows still show raw km/session counts (e.g. Long walk weekly km unchanged by weight).
- Owner confirms no need for a “recalculate history” action.

### Edge cases

- First load after migrate: existing classes at weight `1.0` until edited.
- Curve magnitude higher than pre-fix Active-exercise-only graph — expected.

---

## Out of scope (do not ticket)

- Class switcher / multi-series overlays
- Per-activity multipliers
- Changing `LOAD_TAX_RECENCY_WEIGHTS` or strip caution/danger thresholds
- Weighting delayed-tax or rule_limit_rows
- Scheduled recompute / load snapshot tables
- UX-overhaul sprint tickets (`plans/tickets-ux-overhaul-*`)

---

## Implementation notes for Test Writer / Implementer

- Work only on `feat/combined-load-class-weight`.
- One ticket at a time; failing acceptance tests before production code.
- Prefer extending existing test modules over new phase-named files (`docs/patterns.md` test naming).
- After each ticket commit (when owner requests commits): keep commits small and trackable.
- Do not `git push` without owner instruction.
