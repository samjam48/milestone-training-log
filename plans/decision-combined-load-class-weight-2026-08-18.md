# Decision: Combined performance load + class `load_weight`

*ADR | Architect | Date: 2026-08-18*
*Branch: `feat/combined-load-class-weight`*
*Status: **SIGNED OFF** (owner “yes let’s go” 2026-08-18)*

---

## Context

Safety `load_series` was scoped to a single `graph_class_id`. After `weekly_load_cap` deprecation, resolution fell back to first performance class by id — on live, **Active exercise**. Owner’s bulk history is **Gentle boundary pushers** (also performance). Curve looked “broken” / flat despite 144 logs. Owner rejected class switcher; required **all performance classes on one curve** with an editable per-class multiplier.

## Decision

1. **Combine** all `type == performance` classes into one Safety (and block-review) load-tax series.
2. Add **`activity_classes.load_weight`** (`FLOAT`, NOT NULL, default `1.0`) — editable on class create/edit.
3. **Daily combined tax** = Σ_C `load_weight(C) * daily_load_tax(C)`; rolling 7 uses existing `LOAD_TAX_RECENCY_WEIGHTS` on those daily totals.
4. **Do not** add stored load snapshots or scheduled full-history recompute jobs.

## Locked product parameters

| Item | Value |
| --- | --- |
| Field name | `load_weight` |
| Default | `1.0` |
| Range | `0 <= load_weight <= 10` (`0` mutes class from combined load) |
| Graph title | **Performance load** |
| Dashboard `graph_class_id` | `null` when series is combined (field retained for compatibility) |
| Recovery classes | Still 0 load tax; hide weight in UI (persist default `1.0`) |

## Where weight applies

| Consumer | Weighted? |
| --- | --- |
| Dashboard `load_series` | **Yes** |
| Block review `load_series` | **Yes** (same helper; also move off legacy unscoped `volume×rpe` path) |
| Load-risk `week_days` strip state | **Yes** (same combined daily tax; keep same-day strip exclusion unless a later ticket revisits) |
| `rule_limit_rows`, suggestions, log-time violations | **No** |
| Per-class delayed tax | **No** (within-class ratios; weight would cancel) |

## Alternatives rejected

| Alternative | Why rejected |
| --- | --- |
| Class switcher / smart default | Owner: must see all performance load together |
| Cron / snapshot recompute | Load already on-read; would not fix scoping |
| Per-activity weights | Owner asked class-level only |
| New table for weights | Scalar attribute of class → column |

## Consequences

- Alembic migration required; update `docs/database-schema.md`, `docs/api-map.md`, `docs/patterns.md`.
- API: class create/patch/read gain `load_weight`; dashboard series semantics change.
- Frontend: Settings New/Edit activity class forms; Safety graph chrome.
- Outside current UX-overhaul sprint; owned on `feat/combined-load-class-weight`.
