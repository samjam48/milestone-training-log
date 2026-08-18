# Combined performance load + class load weight

*Feature brief | Architect | Date: 2026-08-18*
*Branch: `feat/combined-load-class-weight`*
*ADR: `plans/decision-combined-load-class-weight-2026-08-18.md`*
*Status: **SIGNED OFF***

---

## Feature summary

Safety (and block-review) load graphs must include **every performance activity class** on one curve, scaled by an editable per-class **`load_weight`** (e.g. Gentle boundary pushers `1`, Active exercise `2`).

This fixes live “flat history”: boundary-pusher sessions were excluded because the graph plotted only Active exercise. Not a cache/recompute bug.

---

## User outcomes

1. Any performance log (any class) moves the Performance load curve for that day and later rolling points.
2. Higher `load_weight` increases that class’s effect on the curve without changing rule caps (km, sessions).
3. Create/edit class sets weight; refresh redraws history (on-read).
4. Graph title reads **Performance load**, not a single class name.

---

## Scope

### In

- Schema: `activity_classes.load_weight`
- Engine: combined weighted daily tax + existing recency rollup; strip uses same combined daily tax
- Dashboard + block review `load_series` alignment
- Class API + Settings create/edit UI
- Safety graph chrome
- Living docs + tests per technical design

### Out

- Class switcher / single-class default
- Cron or load snapshots
- Recency-weight table changes
- Per-activity multipliers
- Weighting rule-limit rows or suggestions
- UX overhaul sprint tickets unrelated to this feature

---

## Locked decisions

See ADR. Summary: `load_weight` 0–10 default 1; combined performance series; `graph_class_id` null on dashboard; title “Performance load.”

---

## Success conditions

- Owner smoke: GBP history visible on curve; AE weight 2 vs 1 changes height without re-logging.
- Automated: engine + dashboard/block-review tests for combine, weight, mute (`0`), recovery exclusion, backfill prior-day points.
- `make test` / quality gates for touched scope green before commit.

---

## Handoff

Ready for **planner** → `plans/tickets-combined-load-class-weight-2026-08-18.md` (or dated when written).

Do not implement until tickets + failing tests exist (repo TDD rule).
