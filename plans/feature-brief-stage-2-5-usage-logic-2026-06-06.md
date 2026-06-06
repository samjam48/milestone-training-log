# Stage 2.5 — Usage Logic & Block Clarity

*Feature brief | Architect | Date: 2026-06-06*
*Sources: owner intake 2026-06-06, `DESIGN.md`, `plans/PRD.md`, `plans/BACKLOG.md`, live app behaviour review*

---

## Feature summary

Close the gap between **what the app stores** (block rules, weekly goals, activity logs, personal goals) and **what daily use should feel like**: caps and rest windows that drive suggestions and load risk, personal goals that track real logging, retroactive log dates, and block settings that are editable in one coherent place.

This batch follows Stage 2 polish (PWA, empty-prod flows). It does **not** include native apps (Stage 5), integrations (Stage 3), or MCP tools (Stage 4).

---

## User outcomes

After Stage 2.5, as the owner using the app daily:

1. **Goals** — Create/edit goals linked to a **specific activity**; opt in to auto-progress from log volume; save without scrolling; see all goals (including achieved) on a compact dashboard card with fill bars or status pills.
2. **Logging** — Log or edit sessions for **any past date** (not future) via a calendar defaulting to today; retroactive logs immediately affect suggestions, caps, load risk, and auto-tracked goals.
3. **Block settings** — Edit **caps** (rules) and **weekly goals** (weekly targets) per class, with optional per-exercise caps, in one Edit Rules flow. No cross-class rules. No cap = unlimited for recovery/no-impact classes.
4. **Dashboard** — “Do these today” only lists what still makes sense; “Rest these today” explains what to avoid and why; optional “Done today” list; load risk shows class caps clearly with expandable per-exercise detail.
5. **Smaller fixes** — Activity class rename/type/delete (no logged activities); incident body-part chips from prior check-ins and incidents.

---

## Scope — In

| # | Area | Deliverable |
| --- | --- | --- |
| 1 | Goal editor UX | Sticky bottom Save/Create; activity picker (required for auto-track); `auto_track_progress` toggle default off |
| 1b | Goal progress | Server-side recompute from logs when auto-track on; manual override still via PATCH |
| 1c | Goals dashboard card | One card: title + fill bar (numeric) or status pill (qualitative); achieved goals visible |
| 2 | Log date | Calendar modal on create + edit; `logged_date` not future; hook uses chosen date |
| 2b | Edit log | Edit button per Log History row → same form as log + date |
| 3 | Rules model | `rules.activity_id` optional; class rules + exercise rules; drop cross-class `weekly_activity_count` from UI/engine |
| 3b | Edit Rules UI | Per-class sections: caps → weekly goal → exercises → add rule CTAs |
| 3c | Weekly targets | Remain separate table; **editable in Edit Rules** (owner decision Q4-A) |
| 4 | Suggestions engine | Three buckets: `do`, `rest`, `done`; hide done-today from `do`; class rest blacklists class; exercise caps; recovery targets; skip activities for achieved in-period goals |
| 5 | Load risk card | Week strip = cap breach OR delayed-tax flag; class bars = actual vs cap; expand for per-exercise bars; exclude recovery/no-impact classes with no caps |
| 6 | Activity class editor | PATCH rename/type; DELETE only when class has no activities with logs |
| 7 | Incident chips | Suggestion chips from flare `body_part` on check-ins and incidents |

---

## Scope — Out

| Item | Where |
| --- | --- |
| Push notifications | Stage 5 |
| Cross-class `weekly_activity_count` | Dropped (Q1) |
| Merge `weekly_targets` into `rules` table | Deferred; UI unified only (Q4-A) |
| Goal → multiple activities | Single `activity_id` only |
| Load risk → navigate to Edit Rules | Expand dropdown only (LR4) |
| Metric units / notifications backend | Unchanged prototype toggles |

---

## Affected areas

| Layer | Changes |
| --- | --- |
| **Database** | Alembic: `goals.activity_id`, `goals.auto_track_progress`; `rules.activity_id`; optional `rules.limit_unit`; deprecate cross-class rules |
| **Backend services** | `load_engine.py` suggestion + status + cap progress; `dashboard.py` new load-risk + suggestion buckets; `goals.py` auto-progress; `activity_logs.py` goal recompute hooks; `rules.py` validation |
| **API** | Extend dashboard response; extend goal create/patch; extend rule create; activity class delete; weekly-target CRUD in Edit Rules (existing endpoints) |
| **Frontend** | `GoalEditorScreen`, `LogActivityScreen` / `EditLogScreen`, `EditBlockRulesScreen`, `DashboardScreen`, `LoadRiskSection`, `SuggestedActivityCard`, `LogHistoryScreen`, incident screens, activity class editor |

---

## UX flows (owner-approved)

### Goals

1. Goals tab → New/Edit → pick **activity** → optional numeric target + unit → **Track automatically** off by default → sticky bottom Save.
2. Dashboard → Goals card shows each goal: bar if numeric, pill if qualitative; achieved goals stay visible.
3. Logging updates auto-tracked goals when units match; PB-style goals stay manual.

### Log / edit

1. Log Activity → date defaults today → calendar to pick past date → submit.
2. Log History → Edit on row → same form with date → save triggers full recompute.

### Block rules (Edit Rules)

```
[Class: Foot load]
  Caps
    Rest 3 days · Max 3 sessions/wk · Max 120 load/wk
  Weekly goal
    Target 8 km / week  [editable]
  Exercises
    Morning walk — Max 1 session/day
  [+ Add class cap]  [+ Add weekly goal]
```

- Recovery / no-impact class with **no caps** → unlimited, no load-risk bar, no rest warnings.
- Exercise rule **stricter than** class rule wins; otherwise exercise rule removable.

### Dashboard suggestions

| Bucket | When shown |
| --- | --- |
| **Do these today** | Safe, not logged today (per rules), recovery target unmet, goal not achieved in period |
| **Rest these today** | Class on rest, cap exceeded, frequency/consecutive/rest violated |
| **Done today** | Activities already logged today (informational) |
| **You're done for today** | Replaces empty **Do** section only — never shown alongside a non-empty Do list |

### Load risk

- 7-day coloured strip (cap OR delayed-tax), no labels.
- One progress bar per capped performance class: `actual / limit` with unit.
- Tap class row → expand exercise bars for logs this week.
- Recovery/no-impact without caps: omitted entirely.

---

## Risks and dependencies

| Risk | Mitigation |
| --- | --- |
| Dashboard payload growth | Add structured `load_risk_summary` + `suggestion_buckets`; keep old fields during transition if needed |
| Retroactive log edits shift many derivations | Single recompute path after log CRUD; integration tests with backdated logs |
| Rule precedence bugs | Explicit merge helper: effective cap = min(class, exercise) per metric |
| Existing cross-class rules in prod | Migration or one-time cleanup script; engine ignores `weekly_activity_count` |

---

## Owner decisions locked

| ID | Decision |
| --- | --- |
| R1 | Option A — extend `rules` with optional `activity_id` |
| R4 / Q1 | Drop cross-class rules |
| Q4 | A — weekly targets stay separate; editable alongside caps in UI |
| Q2 | Qualitative goals on dashboard with status pill |
| Q3 | `auto_track_progress` default `false` |
| Q5 | Exercise rule precedence over class |
| Q6 | Edit button per log row in Log History |
| Goals | Link to **activity** (G2-A), auto-update volume (G3), opt-in auto-track (G4) |
| Suggestions | Done-today list OK; “You’re done” only when Do empty |

---

## Architecture boundary check

- Business logic remains in `services/` (`load_engine.py`, `dashboard.py`, `goals.py`).
- Schema changes via Alembic only.
- Routers thin; no new hardcoded config.
- Frontend: engine hook + API mappers; presentation components stay dumb.

**Preserves** `docs/architecture.md`, `docs/patterns.md` boundaries.

---

## Open questions

None blocking — owner signed off 2026-06-06.

---

## Next step

Planner turns `plans/technical-design-stage-2-5-usage-logic-2026-06-06.md` into ordered tickets on branch `feat/stage-2-5-usage-logic`.

**Final status:** `SIGNED OFF`
