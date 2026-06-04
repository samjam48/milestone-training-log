# Phase 10 — MVP Polish Tickets

*Source: `AGENTS.md`, `agents/planner.md`, owner Phase 10 scoping review (2026-06-04),
`plans/BACKLOG.md`, `plans/PRD.md`, `plans/TRD.md` §Phase 8 F3.x,
`plans/feature-brief-v02-screen-completion-2026-06-02.md` §Phase 10,
`plans/tickets-phase-9-settings-flow-2026-06-03.md` §Out of scope (Phase 10),
`MOCKUPS.md` §Screen 1 (Compliance streaks), `DESIGN.md` §Delayed tax / Training Block Milestones,
`frontend/src/components/screens/DashboardScreen.tsx`,
`frontend/src/hooks/useMilestoneEngine.ts`, `frontend/src/App.tsx`,
`backend/app/services/{dashboard,load_engine,activity_logs}.py`,
`docs/api-map.md`, `docs/patterns.md` | Date: 2026-06-04*

---

## Owner decisions locked (2026-06-04)

| # | Topic | Decision |
| --- | --- | --- |
| D1 | Dashboard compliance layout | **Two sections:** keep **clean streak** as its own labelled section; add a **separate recovery streaks** section from `recoveryStreaks`. Do not conflate the two metrics. |
| D2 | Delayed-tax UI placement | **Dashboard panel + incident/check-in attribution.** Dashboard shows proactive load-risk flags; `LogIncidentScreen` (and flare path on `MorningCheckInScreen`) shows richer symptom-linked attribution from the same delayed-tax data. |
| D3 | Load graph title fix | **Planner choice:** add `graph_class_id` (+ derived name via existing `activity_classes`) to `GET /api/dashboard`; frontend displays that name. Avoids client/server drift vs mirroring `resolve_graph_class_id`. |
| D4 | Review milestone definition | **DESIGN strict:** weekly volume target met for at least one class **and** 2 consecutive calendar days with **no flare-ups AND no rule violations** on those days. |
| D5 | Phase 10 scope | **In:** core six product gaps, hook consolidation, remove inline form duplicates, `/scores` → `/review` merge, `check_violations` refactor. **Out of Phase 10:** dedicated test DB in CI (defer to production project). |
| D6 | Loading/error depth | **Comprehensive:** app-level error + retry, dashboard skeleton on first load, illustrated empty states (Log History, Goals), loading/error treatment on stack screens (`BlockReviewScreen`, etc.). |

### Hard constraints (from `AGENTS.md`)

- Tests before code — failing tests exist before production code, per ticket.
- No business logic in routers — review milestone, MCP context, graph class resolution live in `services/`.
- No schema changes without Alembic — Phase 10 needs **no new tables/columns** (milestone flag and graph class already exist; graph class is derived, not stored).
- No `any` in TS; `mypy --strict`, `ruff`, `make test` / `make lint` green before handoff.
- Branch: `feat/phase-10-polish`. Do not push or merge.

---

## State of the world (verified 2026-06-04)

| Item | Status | Phase 10 action |
| --- | --- | --- |
| `recoveryStreaks` in dashboard + hook | ✅ data wired | **F10.1** — new Dashboard section |
| `cleanStreak` on Dashboard | ✅ rendered under label "Compliance" | **F10.2** — relabel to "Clean streak" (or similar); separate from recovery streaks |
| `GET /api/load/delayed-tax` + client wrapper | ✅ backend + `getDelayedTax` | **H10.1, F10.3, F10.4** — hook query + UI |
| Load graph title | ⚠️ wrong — first performance class by ID, not rule-driven class | **B10.2, F10.5** |
| `is_review_milestone_hit` column | ✅ exists; never auto-set | **B10.1, F10.6** |
| `GET /api/mcp/context` | ❌ not implemented | **B10.3** |
| App error boundary / dashboard loading shell | ❌ not implemented | **H10.2, F10.7** |
| Empty-state illustrations | ❌ text-only on Log History / Goals | **F10.8** |
| Stack screen loading/error | ⚠️ partial (`BlockReviewScreen` has error/empty) | **F10.9** — standardise |
| Hook: separate `['goals']` + `['training-blocks']` queries | ⚠️ redundant vs dashboard fields | **H10.3** |
| Inline form fallbacks (`NewGoalForm`, `EditRulesForm`, `NewTrainingBlockSheet`) | ⚠️ still present alongside stack | **F10.10** — remove; extend stack screens |
| `GET /training-blocks/{id}/scores` | ⚠️ overlaps `/review`; used by `BlockSafetyMapSection` | **B10.4** — merge callers onto `/review` |
| `check_violations` radon F-rank | ⚠️ open BACKLOG item | **B10.5** |
| `elevated_load` without active block API test | ⚠️ BACKLOG item | **B10.6** |
| Phase 9 screen ports | ✅ complete | no action |

---

## Ticket ordering rationale

1. **B10.1** (review milestone service) — independent backend; unblocks Settings badge and block-review display.
2. **B10.2** (dashboard `graph_class_id`) — independent backend; unblocks graph title fix.
3. **B10.3** (MCP context stub) — independent backend.
4. **B10.4** (`/scores` → `/review` consolidation) — backend + frontend caller update; do before stack polish that touches `BlockSafetyMapSection`.
5. **B10.5** + **B10.6** — backend hygiene; can run in parallel with early frontend tickets but land before phase handoff.
6. **H10.1** (delayed-tax hook query) — unblocks F10.3/F10.4.
7. **H10.2** (expose query status) — unblocks F10.7 comprehensive loading/error.
8. **H10.3** (hook query consolidation) — reduces duplicate fetches; run before or alongside F10.10 cleanup.
9. **F10.1–F10.2** (recovery streaks + clean streak relabel) — Dashboard product gaps; independent of delayed tax.
10. **F10.3–F10.5** (delayed tax panel, incident attribution, graph title) — depend on H10.1 / B10.2.
11. **F10.6** (milestone badge) — depends on B10.1.
12. **F10.7–F10.9** (app shell loading/error, empty illustrations, stack polish) — can proceed once H10.2 lands.
13. **F10.10** (remove inline duplicates) — **last** among feature tickets; requires `EditBlockRulesScreen` to gain add/delete rule support previously only in inline `EditRulesForm`.

---

## B10.1 — Review milestone auto-detection

**Type:** backend  
**Reuse:** `backend/app/services/activity_logs.py` (post-create hook point),
`backend/app/services/dashboard.py` (`weekly_progress`, `daily_scores` helpers),
`backend/app/services/load_engine.py` (`compute_daily_safety_scores`),
`backend/app/models/block.py` (`is_review_milestone_hit`),
existing `TrainingBlock` update path in `services/training_blocks.py`.

### Acceptance criteria

- New pure function (e.g. `evaluate_review_milestone(...)`) in a service module (prefer `services/training_blocks.py` or a focused `services/review_milestone.py`) implements **owner decision D4**:
  - At least one **weekly volume target** for the active block is met (`value >= target` from current block period progress).
  - The **last 2 consecutive calendar days** ending on `as_of` each satisfy: **no flare-up** (no `has_flare_up` check-in on that date, no `flare_up_incidents` on that date) **and no rule violations** on any activity log that day (`rule_violations_at_log` empty or no danger/caution snapshots — specify in tests: any non-empty violation list counts as a violation day).
- After every **activity log create** (and update/delete if they can change streak context — at minimum **create**), when an active block exists and `is_review_milestone_hit` is currently `false`, run the evaluator; if true, set `training_blocks.is_review_milestone_hit = true` (one-way latch — do not auto-clear).
- `PATCH /api/training-blocks/{id}` does **not** accept client writes to `is_review_milestone_hit` (already server-owned — verify unchanged).
- Integration test: seed fixture where weekly target is met and last 2 days are clean → POST activity log triggers flag → `GET /api/training-blocks/active` returns `is_review_milestone_hit: true`.
- Integration test: same target met but day −1 had a flare-up → flag stays `false`.
- Unit tests for the pure evaluator with fixed dates/logs/check-ins/incidents.

### Edge cases

- No active block → no-op.
- Block already flagged → skip re-evaluation.
- Multiple weekly targets — meeting **any one** is sufficient (DESIGN: "at least one performance activity class").
- Timezone: use server-local `as_of` date consistent with dashboard/log services.
- Logs with `postActivityFeel: 'bad'` alone do **not** block milestone unless they carry rule violations (DESIGN strict lists flare + violations only).

---

## B10.2 — Dashboard `graph_class_id` field

**Type:** backend  
**Reuse:** `resolve_graph_class_id` in `backend/app/services/load_queries.py` (already used by `dashboard.py` and `block_review.py`).

### Acceptance criteria

- `GET /api/dashboard` response adds top-level `graph_class_id: string | null` — the same class ID used to build `load_series` and `week_load_threshold`.
- `DashboardRead` schema updated; `docs/api-map.md` updated in same ticket.
- Integration test: seed with enabled `weekly_load_cap` on foot class → `graph_class_id` matches that class, not merely the first performance class by sort order.
- Integration test: no cap rules → falls back to first performance class ID (existing `resolve_graph_class_id` behaviour).
- No active block → `graph_class_id: null` (consistent with empty `load_series`).

### Edge cases

- All rules disabled → fallback performance class still resolved.
- Only recovery classes exist → `null`.

---

## B10.3 — MCP context stub endpoint

**Type:** backend  
**Reuse:** `backend/app/services/dashboard.py`, `get_dashboard` patterns; TRD B6.1 shape (simpler than legacy `milestone-architecture.md` prose — follow TRD).

### Acceptance criteria

- `GET /api/mcp/context` returns **HTTP 200** JSON with at minimum:
  - `active_block`: summary object or `null` (id, name, start_date, end_date, status, is_review_milestone_hit)
  - `recent_logs`: last 7 calendar days of logs with activity **name** and per-log load score (`volume × rpe`, default RPE 5)
  - `today_check_in`: today's check-in or `null` (pain, readiness, stiffness, has_flare_up)
  - `class_statuses`: active class traffic-light summaries (same shape as dashboard subset or a slim DTO)
- Implementation lives in `services/mcp_context.py` (or `services/mcp.py`); router in `routers/mcp.py` registered in `main.py`.
- No AI calls, no auth, single-user `"local"`.
- Integration test asserts all keys present with seeded DB; test with no active block returns null block + empty/neutral fields without 500.
- `docs/api-map.md` documents the endpoint.

### Edge cases

- No check-in today → `today_check_in: null`.
- Activity deleted but log remains → activity name from join or `"Unknown"`.

---

## B10.4 — Consolidate `/scores` into `/review`

**Type:** full-stack  
**Reuse:** `GET /api/training-blocks/{block_id}/review` (Phase 9 B9.2), `BlockSafetyMapSection`, `getTrainingBlockReview` client helper.

### Acceptance criteria

- `BlockSafetyMapSection` previous-block heatmaps fetch **`/review`** (use `daily_scores` from review payload) instead of `getTrainingBlockScores` → `/scores`.
- Deprecate `GET /api/training-blocks/{id}/scores`:
  - Either remove route + `block_scores` service **or** keep route as thin alias to review's `daily_scores` for one release — **prefer remove** if no other callers (grep repo).
- Update `frontend/src/lib/api/trainingBlocks.ts`: remove or redirect `getTrainingBlockScores`; extend `getTrainingBlockReview` usage.
- Update/delete `backend/app/tests/test_block_scores_api.py` — migrate assertions to review tests or delete if redundant.
- All existing BlockSafetyMapSection tests pass with review mock.
- `docs/api-map.md` marks `/scores` removed or deprecated.

### Edge cases

- Previous block with no scores in range → empty `daily_scores`, heatmap empty state unchanged.
- Active block inline heatmap continues using `engine.dailyScores` (no extra fetch).

---

## B10.5 — Refactor `check_violations` complexity

**Type:** backend (review-heavy)  
**Reuse:** `backend/app/services/load_engine.py`, existing `test_load_engine.py` violation cases.

### Acceptance criteria

- Extract per-rule-type helpers from `check_violations` (rest, weekly cap, frequency, consecutive day, cross-class count).
- **No behaviour change** — all existing unit tests in `test_load_engine.py` and `test_load_api.py` for check-violations pass unchanged.
- `radon cc backend/app/services/load_engine.py -n C` — `check_violations` no longer F-rank (target ≤ C).
- Update `plans/BACKLOG.md` — strike Phase 4 follow-up item when merged.

### Edge cases

- Disabled rules still skipped.
- Missing activity/class still returns stable empty violations.

---

## B10.6 — Delayed-tax API test: `elevated_load` without active block

**Type:** test-only (backend)  
**Reuse:** `backend/app/tests/test_load_api.py`, patterns from `test_get_delayed_tax_elevated_load_from_foot_baseline`.

### Acceptance criteria

- New integration test: DB with **no active training block**, foot-load logs sufficient for proactive scan → `GET /api/load/delayed-tax` returns **HTTP 200** with at least one `elevated_load` hit (proactive layer does not require a block).
- Strike corresponding item in `plans/BACKLOG.md`.

### Edge cases

- Empty log history → `hits: []`, still 200.

---

## H10.1 — Hook: delayed-tax query

**Type:** frontend (hook)  
**Reuse:** `frontend/src/lib/api/load.ts` (`getDelayedTax`), React Query patterns in `useMilestoneEngine.ts`.

### Acceptance criteria

- `useMilestoneEngine` runs `useQuery(['delayed-tax', todayDate], () => getDelayedTax({ asOf: todayDate }))` (or keyed on dashboard `as_of`).
- Result exposed on `MilestoneEngineResult` as `delayedTax: DelayedTaxResponse | undefined` (define/import typed shape from mappers — no `any`).
- Query disabled or returns empty hits when dashboard unavailable (error state handled by F10.7).
- Hook test: mock `getDelayedTax`, assert field populated and query key stable.
- Mutations that affect logs/check-ins/incidents invalidate `['delayed-tax']` alongside dashboard invalidation.

### Edge cases

- `todayDate` empty before dashboard loads → query disabled.
- API error → `delayedTax` undefined; F10.7 shows app-level error if dashboard also failed.

---

## H10.2 — Hook: expose query status for app shell

**Type:** frontend (hook)  
**Reuse:** `dashboardQuery`, optionally aggregate `activityLogsQuery` for Log tab.

### Acceptance criteria

- `MilestoneEngineResult` adds:
  - `isInitialLoading: boolean` — true while primary `['dashboard']` query is pending and has no cached data.
  - `isFatalError: boolean` — true when dashboard query failed and no cached data.
  - `refetchAll: () => void` — refetches dashboard + activity-logs + delayed-tax (+ consolidated queries after H10.3).
- Hook tests cover pending → success and pending → error transitions.
- Does **not** expose raw React Query objects to screens (keep typed surface).

### Edge cases

- Background refetch while cached data exists → `isInitialLoading` stays false (no full-screen skeleton flash).

---

## H10.3 — Hook: consolidate dashboard-derived queries

**Type:** frontend (hook)  
**Reuse:** dashboard payload fields `goals`, `previous_blocks` (already emitted by B9.1 / B8.1).

### Acceptance criteria

- Remove standalone `useQuery(['goals'])` — `engine.goals` reads from `dashboard.goals` (fallback `[]` while loading).
- Remove standalone `useQuery(['training-blocks'])` — `engine.previousBlocks` reads from `dashboard.previous_blocks` (fallback `[]`).
- Goal mutations invalidate `['dashboard']` only (drop `['goals']` key).
- Block create invalidates `['dashboard']` only (drop `['training-blocks']` key).
- Hook tests updated: no `listGoals` / `listTrainingBlocks` calls on mount unless explicitly needed elsewhere.
- `useMilestoneEngine.test.tsx` regression: goals + previousBlocks still populate from dashboard fixture.

### Edge cases

- Dashboard error → goals/previousBlocks empty arrays; app shell error (F10.7) handles UX.
- Active block still from `dashboard.block` (unchanged).

---

## F10.1 — Dashboard recovery streaks section

**Type:** frontend  
**Reuse:** `engine.recoveryStreaks`, `ProgressBar` (comment already mentions recovery streaks), MOCKUPS §Screen 1 compliance streaks copy pattern.

### Acceptance criteria

- New Dashboard section **below weekly targets** (or per MOCKUPS order: after targets, before suggestions — match MOCKUPS §Screen 1 ordering where practical):
  - Section label: **"Recovery streaks"** (or "Compliance streaks" if matching MOCKUPS heading — use "Recovery streaks" to distinguish from clean streak).
  - For each `recoveryStreaks` entry: activity name + streak copy, e.g. `"Stretching: 4 days in a row"` (daily) or `"Contrast therapy: 2 sessions this week"` (weekly — derive copy from `frequencyUnit` + `currentStreakDays` + `targetFrequency`).
- When `recoveryStreaks.length === 0`, show compact empty copy (not hidden) — e.g. "No recovery targets in this block."
- Dashboard tests assert section renders with fixture streaks and empty state.

### Edge cases

- No active block → section hidden or empty state (consistent with weekly targets behaviour).
- Long activity names truncate gracefully.

---

## F10.2 — Dashboard clean streak relabel

**Type:** frontend  
**Reuse:** existing `StreakRow`, `engine.cleanStreak`.

### Acceptance criteria

- Rename section currently labelled **"Compliance"** to **"Clean streak"** (subtitle optional: existing StreakRow copy about rule violations / bad feel).
- Section remains **separate** from F10.1 recovery streaks (owner D1).
- Dashboard test updated for new heading text.

### Edge cases

- `cleanStreak === 0` — still show section with "0 clean sessions…" copy (existing behaviour).

---

## F10.3 — Dashboard delayed-tax / load-risk panel

**Type:** frontend  
**Reuse:** `engine.delayedTax` (H10.1), `DESIGN.md` §Delayed tax, `Card` / caution intent styling.

### Acceptance criteria

- New Dashboard section **"Load risk"** (or "Delayed load") placed **after load graph, before block safety map** (near load context).
- Renders proactive hits from last 7 days: group or list by type (`elevated_load`, `rest_debt`) with human-readable copy referencing class name and date (use mapper fields).
- When symptom-linked hits exist (`symptom_marker`, `acute_attribution`, `symptom_contributor`), show distinct attribution copy per DESIGN examples.
- When no hits, show compact safe state — e.g. "No elevated load or rest-debt flags in the last 7 days."
- Does not block dashboard render while delayed-tax query pending (show skeleton or omit subsection until loaded).
- Tests with mocked `delayedTax` payload for proactive-only and symptom-linked cases.

### Edge cases

- Many hits → scrollable list or cap at 5 with "and N more" (pick one, test it).
- Unknown class ID → fallback label.

---

## F10.4 — Delayed-tax attribution on incident + check-in flare flows

**Type:** frontend  
**Reuse:** `LogIncidentScreen`, `MorningCheckInScreen`, `engine.delayedTax` or on-demand `getDelayedTax({ asOf: incidentDate })`.

### Acceptance criteria

- **LogIncidentScreen:** after successful submit (or on a post-submit summary step before auto-close), show **"What may have contributed"** subsection listing symptom-linked delayed-tax hits for **`todayDate`** (and proactive context for the prior 7 days if no symptom hits).
- **MorningCheckInScreen:** when user submits with **`hasFlareUp: true`**, show the same attribution subsection on the success state (before dismiss).
- Copy follows DESIGN §Incident Detail / Correlation (plain language, date + class references).
- If delayed-tax query still loading, show brief loading text; if empty, show "No stacked load patterns detected this week."
- Tests: mock delayed-tax hits; assert attribution visible on incident submit and check-in flare submit; assert hidden when check-in has no flare.

### Edge cases

- Delayed-tax fetch fails → attribution subsection omitted or shows non-blocking "Could not load attribution" (does not fail the submit).
- Incident backdated flow not in scope (always `todayDate`).

---

## F10.5 — Load graph dynamic title

**Type:** frontend  
**Depends on:** B10.2

### Acceptance criteria

- Remove client-side `resolveLoadGraphTitle` sort-by-ID heuristic.
- Title = activity class name for `dashboard.graphClassId` via `activityClasses` lookup; fallback `"Weekly load"` when null.
- `WeeklyLoadGraph` title matches the class whose series/threshold is displayed.
- Dashboard test: cap rule on foot class → title shows foot class name even when another performance class sorts earlier by ID.

### Edge cases

- Missing class in `activityClasses` → show `"Unknown class"` or raw ID (test one choice).

---

## F10.6 — Review milestone badge in Settings

**Type:** frontend  
**Depends on:** B10.1

### Acceptance criteria

- `BlockSummaryCard` shows a visible **milestone badge** when `block.isReviewMilestoneHit === true` (e.g. pill: "Review milestone reached").
- Previous blocks list rows show the same indicator when `pb.isReviewMilestoneHit` (optional subtle icon — include if trivial).
- `BlockReviewScreen` header shows milestone state for the viewed block.
- Settings / BlockReview tests with `isReviewMilestoneHit: true` fixture.

### Edge cases

- Flag false → no badge (no empty placeholder).

---

## F10.7 — App-level loading and error shell

**Type:** frontend  
**Depends on:** H10.2

### Acceptance criteria

- When `engine.isInitialLoading`, `App` renders a **dashboard skeleton** inside `AppShell` (tab bar visible or hidden — prefer visible with skeleton content area).
- When `engine.isFatalError`, render full-column **"Could not reach server"** message with **Retry** button calling `engine.refetchAll()` (TRD F3.1).
- Kill-backend manual test documented in ticket manual verification steps.
- `App.test.tsx` covers loading and error states.
- Overlays (`MorningCheckInScreen`, etc.) not openable while fatal error (or they inherit same shell — pick one, test it).

### Edge cases

- Retry success → normal app renders.
- Partial query failure (e.g. activity-logs) while dashboard OK → **do not** fatal-error whole app (only dashboard failure is fatal for v1).

---

## F10.8 — Illustrated empty states (Log History, Goals)

**Type:** frontend  
**Reuse:** existing empty copy in `LogHistoryScreen`, `GoalsScreen`; Tailwind token theme (no new asset pipeline required — SVG inline or emoji icon acceptable).

### Acceptance criteria

- Log History empty state: illustration/icon + existing "No sessions logged yet" + retain bottom action bar CTAs.
- Goals empty state: illustration/icon + existing "No goals yet" copy + "+ New Goal" CTA still visible.
- Matches mobile-first spacing in `AppShell`.
- Screen tests assert empty-state test IDs or landmark roles.

### Edge cases

- Achieved-only goals still show achieved section (existing behaviour) — empty illustration only when no active goals **and** no achieved toggle content? Use existing `hasActive` logic.

---

## F10.9 — Stack screen loading and error polish

**Type:** frontend  
**Reuse:** `BlockReviewScreen` patterns (already has loading/error/empty); extend to `EditBlockRulesScreen`, `NewTrainingBlockScreen`, `ActivityManagerScreen`, `GoalEditorScreen`.

### Acceptance criteria

- Each stack screen shows consistent **loading skeleton** when its data depends on a pending query (primarily `BlockReviewScreen` fetch for non-active blocks).
- Each shows **actionable error** with Retry when its query fails (match `BlockSafetyMapSection` Retry pattern).
- No `100vh` regressions; stays within `stack-screen-overlay` / `AppShell`.
- At least one test per screen for loading and error branches (mock query hooks or engine props).

### Edge cases

- `GoalEditorScreen` edit mode with goal param → no async fetch needed → no skeleton.

---

## F10.10 — Remove inline form duplicates; extend EditBlockRulesScreen

**Type:** frontend  
**Depends on:** H10.3 (recommended), F9 stack screens stable.

### Acceptance criteria

- **Remove** from `GoalsScreen`: `NewGoalForm` component and `formOpen` state — `+ New Goal` always requires `onNewGoal` prop (App always provides it).
- **Remove** from `SettingsScreen`: inline `EditRulesForm`, `NewTrainingBlockSheet`, and related open state — all rule/block editing routes through stack (`EditBlockRulesScreen`, `NewTrainingBlockScreen`). App always provides stack props.
- **Extend `EditBlockRulesScreen`** with **add rule** and **delete rule** flows previously only in inline `EditRulesForm` (owner remove-inline decision + Phase 9 Q8 debt). Reuse hook `createRule` / `deleteRule`.
- Delete dead code paths and update `SettingsScreen.test.tsx` / `GoalsScreen.test.tsx` — migrate scenarios to stack-screen tests where needed.
- No duplicate buttons opening two different rule editors.

### Edge cases

- Zero rules → add-rule flow still reachable from stack editor.
- Dev reset control in Settings unchanged.

---

## Manual verification checklist (phase handoff)

1. Dashboard shows **Clean streak** and **Recovery streaks** as separate sections.
2. Dashboard **Load risk** panel: 7-day strip + per-event progress bars (proactive hits only); symptom detail stays on incident/check-in flows.
3. Log incident with cause class → post-submit attribution subsection visible.
4. Check-in with flare-up → attribution on success screen.
5. Load graph title matches weekly-cap class name from rules.
6. Log enough to trigger milestone (target met + 2 clean days) → Settings badge appears.
7. Stop backend → app shows error + Retry → restart backend → Retry restores data.
8. `GET /api/mcp/context` returns structured JSON from curl.
9. Settings → Edit rules (stack) supports add/delete; no inline sheet appears.
10. `make test` and `make lint` green.

---

## Out of scope (explicit — production project or later)

- Dedicated test DB + automated seed in CI (`plans/TRD.md` dev-data strategy).
- Auth, multi-user, Strava/Health, Capacitor, cloud sync, notifications.
- `WEEKLY_TARGETS` / `ACTIVITY_CLASSES` editing UI.
- Settings notification/unit toggles (prototype-only).
- AI / MCP server implementation (data stub only in B10.3).
- Doc reconciliation (`milestone-architecture.md` vs living docs) — track in BACKLOG, not Phase 10 tickets.
- Flare-up many-to-many cause attribution join table.

---

## Unresolved assumptions / risks

- **Incident attribution timing:** F10.4 success screen stays open until **Done**; cached `delayedTax` may update after refetch — optional follow-up to await refetch before showing rows.
- **Review milestone on log delete:** B10.1 minimum is log **create**; if delete can invalidate streak, document as follow-up in BACKLOG rather than scope creep unless cheap to add in same service.
- **MCP payload shape:** TRD minimal set chosen over older `milestone-architecture.md` bullet list; extend in production project when MCP server is built.
- **`EditBlockRulesScreen` scope creep:** F10.10 is the largest frontend ticket because remove-inline **requires** porting add/delete — budget extra review time.

---

## AGENTS.md sprint update

After owner signs off this ticket set, update `AGENTS.md` **CURRENT SPRINT** to Phase 10 with branch `feat/phase-10-polish` and ticket source pointing to this file.

---

**Status:** `IMPLEMENTED` (2026-06-04) — all tickets B10.1–F10.10 on `feat/phase-10-polish`. Post-handoff UX: visual Load risk panel (7-day strip + per-event bars); incident/check-in attribution with Done dismiss + friendly dates. Owner verification: `make lint`, `make test`, manual checklist below.
