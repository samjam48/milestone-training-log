# Combined performance load + class load weight

*Technical design | Architect | Date: 2026-08-18*
*Companion brief: `plans/feature-brief-combined-load-class-weight-2026-08-18.md`*
*ADR: `plans/decision-combined-load-class-weight-2026-08-18.md`*
*Branch: `feat/combined-load-class-weight`*
*Status: **SIGNED OFF***

---

## 1. Architecture decisions (skills applied)

### Schema (`schema-decision`)

- **Shape:** new column on `activity_classes` — scalar attribute of the class, filtered only with the class row, no independent lifecycle.
- **Not** a new table, JSON blob, or activity-level column.
- **Migration:** Alembic autogenerate/revision; server default `1.0`; backfill existing rows.
- **Constraints (service validation, not DB CHECK required):** finite; `0 <= load_weight <= 10`.

### API (`api-contract-decision`)

- **Extend** existing class create/patch/read — do not add a new endpoint.
- **Change meaning** of dashboard (and block-review) `load_series` in place — same point shape `{ date, load, daily_load }`; document in `docs/api-map.md`.
- `graph_class_id`: return `null` on dashboard when series is combined (retain field).
- No new dashboard query params for MVP.

### Backend boundary (`backend-boundary-decision`)

- Validation of weight on create/patch in `services/activity_classes.py`.
- Combined math only in `services/load_engine.py`.
- `dashboard.py` / `block_review.py` orchestrate; routers stay thin.
- `ActivityClassDict` (and `activity_class_dict` mapper) include `load_weight`.

### Frontend (`component-boundary` / `frontend-data-flow`)

- Extend existing `NewActivityClassForm` / `EditActivityClassForm` in `SettingsScreen.tsx` — no new shared primitive.
- Weight is server state via existing class mutations + dashboard refetch; no new global store.
- Graph: `DashboardSafetyTab` / `WeeklyLoadGraph` title+subtitle only; **no** client-side load-tax recompute (`docs/patterns.md`).

### Cleanliness rules for implementers

1. **One** combined-series helper used by dashboard and block review (block review today uses single-class + legacy path without `activity_classes`/`rules` — fix that drift in the same backend ticket as series change).
2. Do not leave `resolve_graph_class_id` driving Safety series; may remain for any residual caller or be deleted if unused after change (prefer delete dead paths in same PR if tests allow).
3. Strip daily tax must call the **same** combined daily function as `daily_load` on the series (DRY).
4. No duplicate weight math in TypeScript.
5. Keep commits small: migration+model → engine → dashboard/API → frontend forms → graph chrome → docs (planner may split tickets accordingly).

---

## 2. Target math

```
daily_combined(D) = Σ_{C in performance classes}
                      load_weight(C) * daily_load_tax_for_class(C, D)

point.daily_load = daily_combined(D)
point.load       = Σ_{i=0..6} LOAD_TAX_RECENCY_WEIGHTS[i] * daily_combined(D - i)
```

`daily_load_tax_for_class` = existing per-log load tax (RPE tiers, rule proximity, etc.) — **unchanged**.

Recovery: 0 contribution regardless of `load_weight`.

---

## 3. Data model

```text
activity_classes.load_weight  REAL/FLOAT  NOT NULL  DEFAULT 1.0
```

Update `docs/database-schema.md` in the migration ticket.

Seed / fixtures: set explicit weights where tests need them; otherwise default 1.0.

---

## 4. API contract deltas

### `ActivityClassCreate` / `Patch` / `Read`

| Field | Create | Patch | Read |
| --- | --- | --- | --- |
| `load_weight` | optional, default `1.0` | optional | always present |

`422` on out-of-range / non-finite.

### `GET /api/dashboard`

| Field | New behavior |
| --- | --- |
| `load_series` | Combined weighted performance load tax, 30 days |
| `graph_class_id` | `null` |
| `activity_classes[]` | includes `load_weight` |

### `GET /api/training-blocks/{id}/review`

| Field | New behavior |
| --- | --- |
| `load_series` | Combined weighted load tax over block date range (same helper) |

### Unchanged

Rule rows, suggestions, weekly progress, violation check payloads (except they may gain class weight on embedded class objects if those reuse `ActivityClassRead`).

---

## 5. Code touch map (expected)

| Area | Files (indicative) |
| --- | --- |
| Migration | `backend/alembic/versions/*` |
| Model | `backend/app/models/activity.py` |
| Schemas | `backend/app/schemas/activity_classes.py`, load_engine dicts |
| Services | `activity_classes.py`, `load_engine.py`, `dashboard.py`, `block_review.py`, `load_queries.py` (`activity_class_dict`) |
| Tests | `test_load_engine.py`, `test_dashboard_*.py`, `test_activity_classes_api.py`, `test_block_review*` / review API, fixtures |
| Frontend types/mappers/API | `types.ts`, `mappers.ts`, `activityClasses.ts` |
| UI | `SettingsScreen.tsx` forms; `DashboardSafetyTab.tsx`; maybe `WeeklyLoadGraph` title props |
| Docs | `docs/database-schema.md`, `docs/api-map.md`, `docs/patterns.md` (one sentence on combined × weight) |

---

## 6. Test strategy (`test-strategy-decision`)

Prefer cheapest layer that catches the regression.

### Must-have (automated)

| Layer | Behaviors |
| --- | --- |
| **Engine unit** | Two performance classes, equal raw daily tax, weights 1 vs 2 → combined daily/rolling `1*a+2*b`; recovery ignored; weight `0` mutes; prior-day backfill moves series points for D and later days |
| **Migration / model** | Column present; default 1.0 on fresh and upgraded rows |
| **Class API** | Create default 1.0; create/patch 2.0; reject `-1`, `11`, NaN; read roundtrip |
| **Dashboard API** | Series moves when GBP-like log added; `graph_class_id` is null; patch weight changes series without new logs |
| **Block review API/service** | Uses weighted combined tax (not raw volume×rpe-only single class) |
| **Frontend unit** | Mapper includes `loadWeight`; New/Edit form shows field for performance, hidden for recovery; submit sends weight |

### Manual (owner smoke)

1. Set Gentle boundary pushers `1`, Active exercise `2`.
2. Confirm historical GBP walks appear on Performance load curve.
3. Change AE weight 2 → 1; curve drops on refresh.
4. Backfill a GBP session 2 days ago; prior-day region + headline move.
5. Confirm Load risk km/session rows still show raw counts.

### Explicitly not required

- E2E browser suite for MVP
- Visual snapshot tests of SVG path

### TDD order (repo rule)

Failing tests per ticket **before** production code for that ticket.

---

## 7. Suggested ticket order (for planner — not formal tickets)

1. **CLW.B1** — Alembic + model + class schemas/service validation + class API tests + schema doc  
2. **CLW.B2** — Engine combined weighted series + strip daily helper + engine tests  
3. **CLW.B3** — Dashboard + block review wiring + API tests; `graph_class_id` null; api-map  
4. **CLW.F1** — Types/mappers + Settings create/edit `load_weight`  
5. **CLW.F2** — Safety graph title **Performance load** + subtitle; patterns doc line  
6. **CLW.O1** — Owner smoke checklist  

Dependency: B1 → B2 → B3; F1 after B1 (can parallel B2); F2 after B3 contract stable; O1 last.

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Live numbers jump when combining classes | Expected; document in smoke / release note |
| Strip thresholds (2.5/5) feel different with more volume | Owner can tune weights; threshold retune is out of scope unless requested |
| Block review graph surprise | Same formula as Safety — intentional |
| Dead `resolve_graph_class_id` / graph title helpers | Remove or repurpose in B3/F2 to avoid drift |

---

## 9. Boundary check vs living docs

| Doc | Result |
| --- | --- |
| `docs/architecture.md` | Schema + API changes owner-approved; smallest coherent change; services own math |
| `docs/patterns.md` | Load-tax remains in `load_engine`; frontend maps only — update pattern text for “combined × load_weight” |
| `docs/api-map.md` | Update `load_series` + class fields in implementation tickets |
| `docs/database-schema.md` | Add `load_weight` in B1 |
| `AGENTS.md` hard constraints | Feature branch; tests before code; no push; Alembic for schema — all respected |

---

## 10. Architect status format

1. **Feature Summary:** Combined performance load-tax curve weighted by class `load_weight`.
2. **User Outcomes:** All performance history visible; tunable class intensity; editable in Settings.
3. **Scope:** Schema, engine, dashboard/block-review, class API/UI, graph chrome, docs/tests. Out: switcher, cron, activity weights, rule-bar weighting.
4. **Architecture Impact:** `activity_classes`, `load_engine`, dashboard, block_review, Settings forms, Safety tab.
5. **API Impact:** Extend class CRUD; redefine `load_series`; `graph_class_id` null on dashboard.
6. **Data Model Impact:** `load_weight` float column + Alembic.
7. **UX Flows:** Edit weights → refresh curve; log any performance class → curve moves; title Performance load.
8. **Boundary Check:** Preserved when tickets follow services-first + doc sync.
9. **Open Questions / Risks:** None blocking; residual product risk is live curve magnitude (acceptable).
10. **Obstacles Encountered:** Initial misread as recompute bug; corrected via Settings/Log screenshots.
11. **Status:** **SIGNED OFF**
