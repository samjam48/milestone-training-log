# Technical Design — Weekly Focus Lifecycle (WTL.D1)

*Date: 2026-06-07 · Ticket: WTL.D1 · Blocks: WTL.B7, WTL.F7*

---

## Decision: reuse `training_blocks`

**Recommendation:** Repurpose `training_blocks` as Monday–Sunday weekly focus periods. Do **not** introduce a `weekly_focuses` table.

| Criterion | Reuse `training_blocks` | New `weekly_focuses` table |
| --- | --- | --- |
| FK graph | `rules`, `weekly_targets`, `recovery_targets` already FK to `training_blocks` | Requires new FKs on three child tables + data migration |
| Active period lookup | `get_active_training_block` and dashboard already resolve one active row | Duplicate resolver + dual code paths during transition |
| History / review | `GET /api/training-blocks/{id}/review` and `previous_blocks` already exist | Rebuild review scoping and list endpoints |
| Production data | Legacy rows stay readable with a `period_kind` flag | Risk of orphaned rules/targets or dual ownership |
| API churn | Extend existing schemas and routes | New resource tree or breaking renames |

A separate `weekly_focus_series` table is **not** required. A `focus_series_id` column on `training_blocks` groups weeks under one wider focus (title + week counter). Each row is one calendar week’s planning snapshot (rules + targets).

---

## Concepts

| Term | Meaning |
| --- | --- |
| **Weekly focus period** | One `training_blocks` row representing Monday–Sunday with its own rules and weekly targets |
| **Focus series** | Sequence of weekly periods sharing a wider goal; identified by `focus_series_id` |
| **Focus title** | User-facing wider goal label (e.g. “Return to walking”) |
| **Week counter** | 1-based index within the current focus series (`week_number`) |
| **Legacy block** | Pre-cutover month-style block (`period_kind = legacy`); read-only history |

**Owner alignment:** D10 (weekly focus auto-roll, preserve history) and D1/D5 (Monday–Sunday week semantics for targets) are satisfied by calendar-week bounds on each period row while dashboard load risk stays rolling seven-day (D2).

---

## Calendar week boundaries

Use server-local `as_of` (same as dashboard today).

```python
def calendar_week_bounds(as_of: date) -> tuple[date, date]:
    monday = as_of - timedelta(days=as_of.weekday())  # Monday = 0
    sunday = monday + timedelta(days=6)
    return monday, sunday
```

| `as_of` | `start_date` | `end_date` |
| --- | --- | --- |
| Sunday 2026-06-07 | 2026-06-01 (Mon) | 2026-06-07 (Sun) |
| Monday 2026-06-08 | 2026-06-08 (Mon) | 2026-06-14 (Sun) |

For `period_kind = weekly_focus`:

- `start_date` and `end_date` are always the Monday and Sunday of that period.
- On rollover, the completed period gets `end_date = sunday`; the new active period gets the next Monday–Sunday pair.

Weekly target progress (WTL.B3) already uses this window independently of block dates; weekly focus aligns **planning ownership** (which rules/targets apply) with the same week.

---

## Schema changes (Alembic + SQLModel)

Add to `training_blocks`:

| Column | Type | Purpose |
| --- | --- | --- |
| `period_kind` | `string`, not null, default `legacy` | `weekly_focus` \| `legacy` |
| `focus_series_id` | `string`, nullable | Groups weeks in one wider focus; null on legacy rows |
| `focus_title` | `string`, nullable | Wider goal title; snapshotted at week creation |
| `week_number` | `int`, nullable | 1-based counter within `focus_series_id` |

**`name` field:** Keep for backward compatibility. For `weekly_focus` rows, service sets `name` to a generated label (`"{focus_title} · Week {n}"`) so existing UI that reads `block.name` degrades gracefully until F7 ships.

**Indexes:**

- Partial unique: at most one `status = active` AND `period_kind = weekly_focus` per `user_id` (replaces implicit single-active invariant for weekly mode).
- Index on `(user_id, focus_series_id, week_number)` for series queries.

**No changes** to `rules`, `weekly_targets`, or `recovery_targets` FKs.

### Legacy / production migration

1. Backfill all existing rows: `period_kind = legacy`; leave new columns null.
2. **Cutover on first `ensure_active_weekly_focus` call** (lazy, no cron):
   - If an active `legacy` block exists and no active `weekly_focus` exists:
     - Create week 1 `weekly_focus` for the calendar week containing `as_of`.
     - Copy enabled rules and all `weekly_targets` from the legacy block.
     - Set `focus_title` from legacy `name` (or `"My focus"` if empty).
     - Mark legacy block `completed` with `end_date = as_of` (or prior Sunday if `as_of` is mid-week — use `min(as_of, sunday_of_legacy_week)` only when converting; prefer `end_date = day before new week Monday` when `as_of` is in a new week).
   - If no blocks exist: no active focus until user sets up (see below).

Legacy completed blocks remain reviewable via existing `/review` with their original `start_date`/`end_date`.

---

## Lifecycle services (`training_blocks.py` extensions)

All logic in `services/`; routers translate HTTP only.

### `ensure_active_weekly_focus(session, as_of) -> TrainingBlock | None`

Called from dashboard, load summary, MCP context, and active-block routes before resolving rules/targets.

1. Compute `(week_start, week_end)` from `as_of`.
2. Look up active row with `period_kind = weekly_focus`, `status = active`, `start_date = week_start`.
3. **Hit:** return it.
4. **Miss — rollover path:**
   - Find the most recent completed `weekly_focus` in the same user with `end_date = week_start - 1 day` (prior Sunday), or the active stale row whose `start_date < week_start` (missed rollover).
   - If source found: `rollover_weekly_focus(session, source, week_start, week_end)` → new row, `week_number = source.week_number + 1`, same `focus_series_id` and `focus_title`.
   - If no source but legacy cutover applies: create week 1 from legacy (migration above).
   - If no source at all: return `None`.
5. Complete any superseded active `weekly_focus` whose `start_date < week_start` (`status = completed`, `end_date` set to its Sunday).

### `rollover_weekly_focus`

- New block id (uuid).
- Copy **enabled rules** and **all weekly_targets** from source (new ids), matching today’s `_copy_rules_to_block` pattern extended to targets.
- Do **not** copy `recovery_targets` (deprecated path; weekly targets are canonical per WTL planning assumption).
- Prior week: `status = completed`, `end_date = sunday`.

### `reset_focus_series(session, focus_title, as_of) -> TrainingBlock`

“Start new wider focus” (F7 reset):

1. `ensure_active_weekly_focus` for current week (may complete rollover first).
2. Complete current active `weekly_focus` (`end_date = min(as_of, current_sunday)`).
3. Create new active period for **current** calendar week (`week_start`, `week_end`):
   - New `focus_series_id`.
   - `week_number = 1`.
   - `focus_title` from payload.
   - Copy rules and weekly targets from the just-completed period (user keeps working constraints unless they edit).
4. Return new block.

Reset on **Sunday** or **Monday** both anchor to the calendar week containing `as_of` (week 1 of the new series within that Mon–Sun window).

### `update_focus_title(session, block_id, focus_title) -> TrainingBlock`

- Allowed only on the **active** `weekly_focus` row.
- Updates `focus_title` and regenerated `name` on the active row only.
- Historical weeks keep the title snapshotted at creation (review shows what the focus was called that week).

---

## Rules and weekly targets behavior

| Event | Current week | Historical weeks |
| --- | --- | --- |
| Monday rollover | New row; rules + targets copied from prior week | Prior week frozen |
| Mid-week rule edit (`PATCH /rules/{id}`) | Mutates rules on active block only | Unchanged |
| Mid-week target edit | Mutates targets on active block only | Unchanged |
| Reset wider focus | New series, week 1, copies rules/targets from completed week | Prior series weeks remain in `previous_blocks` |
| Disable rule mid-week | Active week only | N/A |

**Historical rules/targets viewing:** `GET /api/training-blocks/{block_id}/rules` and `.../weekly-targets` already scope by block id. Block review uses `list_rules(session, block_id)` for that period’s date range. F7 links `previous_blocks` → `BlockReviewScreen` unchanged.

**Mid-week edit + later review:** Review for week N shows logs for that week’s Mon–Sun and rules fetched for block id N (the snapshot for that week). Edits in week N+1 do not retroactively change week N’s rule rows.

---

## Focus title and week counter (API + UI contract)

Extend `TrainingBlockRead` (and dashboard `block`):

```json
{
  "id": "blk-…",
  "period_kind": "weekly_focus",
  "focus_series_id": "fs-…",
  "focus_title": "Return to walking",
  "week_number": 3,
  "start_date": "2026-06-15",
  "end_date": "2026-06-21",
  "status": "active",
  "name": "Return to walking · Week 3"
}
```

Settings (F7) displays **`focus_title`** and **“Week {week_number}”** prominently; de-emphasizes month-style start/end copy.

---

## No active weekly focus

| State | Backend | UI (F7) |
| --- | --- | --- |
| Brand-new user, no blocks | `ensure_active_weekly_focus` → `None`; dashboard neutral payloads (existing) | “Set up weekly focus” → creates week 1 with title |
| Legacy-only completed history | Same until user creates focus | Setup action |
| Active lookup | `GET /api/training-blocks/active` → **404** (unchanged) or optional **200 with null** — keep **404** for compatibility; dashboard already handles missing block |

`POST /api/training-blocks/active/setup` (new): body `{ "focus_title": "…" }`, creates week 1 for current calendar week if none active.

Deprecate UI for `POST /api/training-blocks` month-style create; endpoint may remain for tests but returns **409** if active `weekly_focus` exists (B7).

---

## Edge cases (from ticket)

| Case | Behavior |
| --- | --- |
| Change focus title on Wednesday | `PATCH` active block `focus_title`; active row only; history unchanged |
| Reset focus on Sunday | New `focus_series_id`, `week_number = 1`, same Mon–Sun week; prior series week completed |
| Reset focus on Monday | Rollover may run first; reset completes that week’s period and opens week 1 of new series for the new Monday–Sunday |
| Historical week review after later rule changes | Review uses that week’s block id rules + logs in that week’s dates only |
| Production legacy block | `period_kind = legacy`; lazy cutover copies rules/targets into first `weekly_focus`; legacy row completed, still reviewable |
| Prior week has no rules/targets | Rollover still creates valid empty week |
| `as_of` testing across Monday 00:00 boundary | `ensure_active_weekly_focus(session, as_of)` drives all tests; no wall-clock dependency |
| User never opens app across a Monday | Next open runs **one rollover per missed week** until the current calendar week is active (`while last_end < week_start - 7` loop; intermediate completed periods + honest `week_number` — see note below) |

**Multi-week skip:** If the user is offline for three Mondays, prefer **one rollover per missed week** on catch-up (three new completed periods + one active) so history and week counter stay honest. B7 implements a `while last_end < week_start - 7` loop with empty intermediate weeks if needed.

---

## API changes summary

| Method | Path | Change |
| --- | --- | --- |
| `GET` | `/api/training-blocks/active` | Response adds `period_kind`, `focus_series_id`, `focus_title`, `week_number`; calls `ensure_active_weekly_focus` first |
| `POST` | `/api/training-blocks/active/setup` | **New** — first focus title, week 1 |
| `POST` | `/api/training-blocks/active/reset-focus` | **New** — new series, week 1, copy rules/targets |
| `PATCH` | `/api/training-blocks/{id}` | Allow `focus_title` on active `weekly_focus`; disallow manual `start_date`/`status` changes that break week invariant |
| `POST` | `/api/training-blocks` | **Deprecated** for product UI; document legacy/test-only |
| `GET` | `/api/dashboard` | `block` includes focus fields; resolver uses `ensure_active_weekly_focus` |
| `GET` | `/api/training-blocks/{id}/review` | Unchanged; works per period dates |
| `GET` | `/api/training-blocks` | `previous_blocks` / list orders by `start_date desc`; weekly rows show `focus_title` + `week_number` |

Update `docs/api-map.md` and `docs/database-schema.md` in WTL.D2 after B7/F7.

---

## Required migrations

1. **Alembic revision** `extend_training_blocks_for_weekly_focus`:
   - Add columns with defaults.
   - Backfill `period_kind = 'legacy'`.
   - Add partial unique index for single active weekly focus per user.
2. **No child-table migrations.**

---

## WTL.B7 — concrete tests (backend)

**New file:** `backend/app/tests/test_weekly_focus_service.py`

| Test | Behavior |
| --- | --- |
| `test_calendar_week_bounds_sunday_and_monday` | Sunday/Monday boundary dates |
| `test_ensure_active_creates_week_one_when_none` | No prior focus → `None`; setup creates week 1 |
| `test_rollover_copies_rules_and_weekly_targets` | Enabled rules + targets copied with new ids |
| `test_rollover_increments_week_number_same_series` | Week 2 keeps `focus_series_id`, `week_number == 2` |
| `test_rollover_completes_prior_week_sunday_end_date` | Prior `status=completed`, `end_date=Sunday` |
| `test_reset_focus_new_series_week_one` | New `focus_series_id`, `week_number=1` |
| `test_reset_focus_on_sunday_uses_current_calendar_week` | Week bounds contain Sunday `as_of` |
| `test_mid_week_rule_edit_does_not_change_prior_week_rules` | Two block ids; patch only affects active |
| `test_lazy_legacy_cutover_copies_from_active_legacy` | Legacy active → first `ensure` creates `weekly_focus` |
| `test_catch_up_multiple_missed_mondays` | Three-week gap creates intermediate completed periods |

**Extend:** `backend/app/tests/test_training_blocks_service.py`

- Rollover and reset delegate to service; patch title on active row.

**Extend:** `backend/app/tests/test_training_blocks_api.py`

- `GET /active` returns focus fields after ensure.
- `POST /active/setup`, `POST /active/reset-focus` success and 409 when already active/setup.
- `PATCH` focus_title on active; 422 on legacy row.

**Extend:** `backend/app/tests/test_dashboard_service.py`

- `test_dashboard_ensure_active_weekly_focus_monday_boundary` — `as_of` Monday triggers rollover before rules/targets resolve.
- `test_dashboard_no_active_focus_neutral_payload` — unchanged contract when `ensure` returns `None`.

**Extend:** `backend/app/tests/test_migrations.py` / `test_models_schema.py`

- New columns, defaults, partial unique index.

---

## WTL.F7 — concrete tests (frontend)

**Extend:** `frontend/src/components/screens/SettingsScreen.test.tsx`

| Test | Behavior |
| --- | --- |
| Shows `focus_title` and week number for active weekly focus | Not month-style “Ends …” primary copy |
| Edit focus title saves via PATCH and shows updated title | Form stays open on error |
| Reset wider focus calls reset endpoint and shows Week 1 | Confirmation dialog |
| No active focus shows setup CTA | Creates focus with title |
| Previous weekly focuses list navigates to block review | Uses `onViewBlock` / review route |
| `+ New Training Block` absent | Replaced by reset/setup flows |

**Extend:** hook tests (e.g. `useMilestoneEngine` or dedicated `trainingBlocks` API module tests)

- `setupWeeklyFocus`, `resetWeeklyFocus`, `patchFocusTitle` mutations invalidate `dashboard` and `training-blocks` queries.

**Reuse:** `BlockReviewScreen` tests — historical week still loads `/review` by block id.

---

## Out of scope (B7/F7)

- Renaming API path prefix `/training-blocks` → `/weekly-focus` (cosmetic; defer).
- Big Goal (`goals` table) linkage on focus series (`related_goal_id` optional future).
- Automatic week counter display on dashboard header (Settings only per F7).
- Changing load-risk rolling window (stays D2).

---

## Implementation order (B7 → F7)

1. Migration + model fields.
2. Week bounds helper + `ensure_active_weekly_focus` + rollover/reset/copy targets.
3. Wire dashboard and load queries to `ensure`.
4. New API routes + schema extensions.
5. F7 Settings UI + remove New Training Block flow.
6. Docs (WTL.D2).

---

## Status

**NEEDS OWNER** — design recommends reusing `training_blocks` (not a fork requiring A/B). Owner sign-off requested on:

1. Lazy legacy cutover on first access (vs one-shot migration converting the active legacy row in Alembic).
2. Snapshotted `focus_title` on historical weeks (vs rewriting all series rows on title edit).

If both defaults are accepted, B7 may proceed without further design work.
