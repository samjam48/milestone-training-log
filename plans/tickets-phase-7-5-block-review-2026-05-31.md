# Phase 7.5 — Block Review Tickets
*Source: `AGENTS.md`, `MOCKUPS.md` §Screen 5, `plans/tickets-phase-7-frontend-completion-2026-05-30.md`,
`frontend/src/components/composites/CalendarHeatmap.tsx`,
`frontend/src/hooks/useMilestoneEngine.ts`,
`frontend/src/components/screens/SettingsScreen.tsx`,
`backend/app/services/dashboard.py`,
architect review 2026-05-31 | Date: 2026-05-31*

## Planning assumptions locked for this ticket set

- Phase 7 (tickets F2.0–F2.6) is complete and merged to `main`. `SettingsScreen`
  is live on real data; the "Block summary" button renders with
  `onReview={() => undefined}`. `engine.previousBlocks` is already populated from
  `listTrainingBlocks()` filtered to non-active blocks (Phase 7 F2.0).
- Phase 7.5 is **full-stack**: one new backend endpoint (B3.0) and one frontend
  screen (F3.0). No schema or model changes — backend reads existing tables only.
- All work lands on branch **`feat/phase-7-5-block-review`** (new branch off `main`).
- **`CalendarHeatmap` is already fully implemented** at
  `frontend/src/components/composites/CalendarHeatmap.tsx`. Phase 7.5 wires it up;
  it does not modify it.
- **Active block scores already exist.** `engine.dailyScores` (from
  `GET /api/dashboard`) is pre-loaded. The active block page uses it directly —
  no extra fetch.
- **Previous block scores require a new endpoint.** `GET /api/dashboard` scopes
  `daily_scores` to the active block only. Previous blocks need
  `GET /api/training-blocks/{id}/scores`, added in B3.0.
- **`compute_daily_safety_scores`** in `backend/app/services/load_engine.py`
  takes `block_start`, `as_of` (end date), `log_dicts`, `check_in_dicts`, and
  `incident_dicts`. It does not need rules or weekly targets. The new endpoint
  calls it directly, scoping logs/check-ins/incidents to the block's date range.
- **No hook changes needed.** `engine.block`, `engine.dailyScores`, and
  `engine.previousBlocks` are already in `MilestoneEngineResult`. The
  `BlockReviewScreen` uses `useQuery` directly for per-block score fetches.
- `engine.block.endDate` may be `undefined` for an active block with no planned
  end date. Pass `engine.todayDate` as `endDate` in that case.
- `engine.block.id === ''` signals no active block (the `EMPTY_BLOCK` sentinel).
  The Review button in `BlockSummaryCard` is only rendered when `hasBlock` is
  true, so this state should not occur in normal flow. Handle it gracefully anyway.

## Owner decisions resolved

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Swipeable multi-block UX | Horizontal scroll container, one `CalendarHeatmap` per block page, CSS scroll-snap (`scroll-snap-type: x mandatory`), active block shown first (leftmost), swipe right to see older blocks. |
| 2 | Previous-block score loading | Lazy per-block `useQuery` — each block's scores fetch when its page is within one viewport of the visible page. Active block pre-populated from `engine.dailyScores` (no extra fetch). |
| 3 | Screen title | **"Block Review"** |
| 4 | Block header card content | Block name + date range only — no repeated rules/targets summary. Keep the focus on the heatmap. |
| 5 | Overlay pattern | Full-panel overlay matching `MorningCheckInScreen` / `LogActivityScreen` — hides tab bar, back button at top, `onBack` closes it. Not a bottom sheet (heatmap needs vertical space). |

---

## Ticket ordering rationale

**B3.0** adds the backend endpoint for per-block daily scores. F3.0 cannot be
completed without it; verified independently before frontend work starts.

**F3.0** creates `BlockReviewScreen` with the swipeable multi-block heatmap
and wires `onReview` in `SettingsScreen` and `App.tsx`.

**F3.1** hardens quality gates and documents the manual verification matrix.

---

## B3.0 — `GET /api/training-blocks/{id}/scores` endpoint

**Type:** backend
**Branch:** `feat/phase-7-5-block-review`
**Depends on:** Phase 7 on `main`

### Acceptance criteria

- Tests in `backend/app/tests/test_block_scores_api.py` are written **before**
  the route and fail first.
- `GET /api/training-blocks/{id}/scores` returns HTTP 200 with body:
  ```json
  {
    "block_id": "...",
    "start_date": "2026-04-07",
    "end_date": "2026-05-25",
    "scores": [
      { "date": "2026-04-08", "state": "safe", "violations": [], "had_flare_up": false },
      ...
    ]
  }
  ```
- `scores` is computed by calling `compute_daily_safety_scores(block_start, block_end_or_today, log_dicts, check_in_dicts, incident_dicts)` with data scoped to within the block's `start_date`–`end_date` range. No rules or weekly targets are needed.
- If the block has no `end_date`, `as_of` (end date passed to the engine) defaults to today.
- Returns HTTP 404 if the block ID does not exist.
- The endpoint is read-only (GET). No mutations.
- No new Alembic migration — reads existing tables only.
- Business logic lives in a new service function
  `backend/app/services/block_scores.py::get_block_scores(session, block_id)`.
  The router translates request/response only.

### Schema

Add `backend/app/schemas/block_scores.py`:
- `BlockScoresRead`: `block_id: str`, `start_date: ISODate`, `end_date: ISODate`,
  `scores: list[DailySafetyScoreRead]`
- Reuse `DailySafetyScoreRead` from `backend/app/schemas/dashboard.py` (or
  create an alias if the dashboard schema is not independently importable).

### Tests to write (failing first)

- `GET /api/training-blocks/{id}/scores` returns 200 with seeded block data;
  scores list matches expected states for known log/check-in fixtures
- Returns 404 for a non-existent block ID
- Block with no `end_date` → `end_date` in response defaults to today; no 500
- Block with no logs/check-ins → `scores` is `[]`

### Reuse / extend

- `backend/app/services/load_engine.py` — `compute_daily_safety_scores`
- `backend/app/services/load_queries.py` — `log_dict`, `check_in_dict`,
  `incident_dict`, `resolve_as_of`, `format_iso_date`
- `backend/app/services/activity_logs.py` — `list_activity_logs`
- `backend/app/services/daily_check_ins.py` — `list_daily_check_ins`
- `backend/app/services/flare_up_incidents.py` — `list_flare_up_incidents`
- `backend/app/services/training_blocks.py` — `get_training_block` (or equivalent
  by-ID lookup; check if one exists, add if not)
- `backend/app/routers/training_blocks.py` — add the new GET route here (or a
  separate `block_scores.py` router included in `main.py`)
- `backend/app/schemas/dashboard.py` — `DailySafetyScoreRead`,
  `daily_safety_score_from_dict`

### Edge cases to handle

- Block `end_date` is `None` → default to today in the service, not the router
- Logs/check-ins outside the block's date range must be excluded from the score
  computation — scope the queries with `start_date` / `end_date` filters
- Incidents without a matching block date range handled the same way

### Files to create / modify

- `backend/app/schemas/block_scores.py` (new)
- `backend/app/services/block_scores.py` (new)
- `backend/app/routers/training_blocks.py` (add new GET route) or
  `backend/app/routers/block_scores.py` (new, registered in `main.py`)
- `backend/app/main.py` (register router if new file)
- `backend/app/tests/test_block_scores_api.py` (new)

### Out of scope

- Scores for deleted blocks
- Paginated or date-range-filtered score requests
- Any mutation endpoints

---

## F3.0 — BlockReviewScreen + swipeable multi-block heatmaps

**Type:** frontend
**Branch:** `feat/phase-7-5-block-review`
**Depends on:** B3.0

### Acceptance criteria

- Tests in `frontend/src/components/screens/BlockReviewScreen.test.tsx` are
  written **before** the component and fail first (mock `useMilestoneEngine`
  via `mockEngine`; mock `useQuery` for per-block score fetches).
- **New API wrapper** added to `frontend/src/lib/api/trainingBlocks.ts`:
  `getTrainingBlockScores(blockId: string): Promise<DailySafetyScore[]>`
  — calls `GET /api/training-blocks/{blockId}/scores`, maps snake_case response
  to camelCase `DailySafetyScore[]` using existing mappers.
- `frontend/src/components/screens/BlockReviewScreen.tsx` created in strict
  TypeScript (no `any`):
  - Props: `{ engine: MilestoneEngineResult; onBack: () => void }`
  - Full-panel overlay (no bottom sheet)
  - Header row: back/close button + "Block Review" title
  - **Swipeable block pages:** horizontal scroll container with
    `scroll-snap-type: x mandatory`; each child page has `scroll-snap-align: start`
    and is `100vw` wide. Active block is the first (leftmost) page; previous
    blocks follow in reverse-chronological order (newest first, oldest last).
  - **Each page** renders:
    - Block name + date range as a small header above the heatmap
    - `<CalendarHeatmap startDate endDate scores />` (non-interactive — no `onCellClick`)
  - **Active block page:** `scores={engine.dailyScores}`,
    `endDate={engine.block.endDate ?? engine.todayDate}`. No extra network call.
  - **Previous block pages:** each uses a `useQuery` keyed
    `['block-scores', block.id]` calling `getTrainingBlockScores(block.id)`.
    While loading, show a skeleton placeholder the same size as the heatmap card.
    On error, show a brief "Could not load scores" message with a retry button.
  - **No-block empty state:** when `engine.block.id === ''`, render "No active
    training block" + back button; no scroll container.
  - If `engine.previousBlocks` is `[]`, only the active block page renders (no
    "swipe for more" hint needed; just one page).
- **`SettingsScreen` wiring:**
  - Add `onReview?: () => void` to `SettingsScreenProps`. Pass through to
    `BlockSummaryCard`. Default `() => undefined` so existing tests pass.
- **`App.tsx` wiring:**
  - Add `'block-review'` to the `OverlayKey` union type.
  - Add `else if (overlay === 'block-review')` branch rendering
    `<BlockReviewScreen engine={engine} onBack={closeOverlay} />`.
  - Pass `onReview={() => setOverlay('block-review')}` to `<SettingsScreen>`.
  - Tab bar is hidden when `overlay === 'block-review'` (no change needed —
    `showTabBar` is already `overlay === null`).
- Export `BlockReviewScreen` from `frontend/src/components/screens/index.ts`.

### Tests to write (failing first)

- Renders active block heatmap with `engine.dailyScores` — no extra fetch fired
- Renders a page per entry in `engine.previousBlocks`; each fires a `useQuery`
  call with `['block-scores', block.id]`
- Loading skeleton shown while previous-block query is pending
- Error state shown when previous-block query fails
- Back button calls `onBack`
- No-block empty state when `block.id === ''`; no scroll container rendered
- SettingsScreen passes `onReview` through to `BlockSummaryCard` (spy on click)
- `getTrainingBlockScores` wrapper: maps API response to camelCase
  `DailySafetyScore[]` correctly

### Reuse / extend

- `frontend/src/components/composites/CalendarHeatmap.tsx` — consume as-is
- `frontend/src/components/ui/Card.tsx` — `Card`, `CardHeader`, `CardTitle`,
  `CardMeta` for block header above each heatmap
- `frontend/src/lib/api/trainingBlocks.ts` — add `getTrainingBlockScores`
- `frontend/src/lib/api/mappers.ts` — existing `mapDailySafetyScoreFromApi`
- `frontend/src/components/screens/SettingsScreen.tsx` — add `onReview` prop
- `frontend/src/App.tsx` — add overlay key + branch
- `frontend/src/components/screens/index.ts` — export new screen
- `frontend/src/test/mockEngine.ts` — `mockEngine` / `resetMockEngine` helpers

### Edge cases to handle

- `engine.block.endDate` is `undefined` → pass `engine.todayDate`
- `engine.dailyScores` is `[]` → active block page renders all-neutral grid
- `engine.previousBlocks` is `[]` → single page, no swipe affordance needed
- Previous-block query loading → skeleton placeholder, not blank space
- Previous-block query error → inline error + retry, does not crash other pages
- `engine.block.id === ''` → empty state, no scroll container, no crash

### Files to create / modify

- `frontend/src/components/screens/BlockReviewScreen.tsx` (new)
- `frontend/src/components/screens/BlockReviewScreen.test.tsx` (new)
- `frontend/src/lib/api/trainingBlocks.ts` (add `getTrainingBlockScores`)
- `frontend/src/lib/api/trainingBlocks.test.ts` (add wrapper test)
- `frontend/src/components/screens/SettingsScreen.tsx` (add `onReview` prop)
- `frontend/src/components/screens/SettingsScreen.test.tsx` (add passthrough test)
- `frontend/src/App.tsx` (add `'block-review'` overlay)
- `frontend/src/components/screens/index.ts` (export)

### Out of scope

- Interactive cell clicks / drill-down day detail
- Block transition / "Start new block" flow from review screen
- `CalendarHeatmap` component changes
- Prefetching all previous-block scores on mount (lazy on-scroll is sufficient)

---

## F3.1 — Quality gates + verification

**Type:** full-stack + verification
**Branch:** `feat/phase-7-5-block-review`
**Depends on:** B3.0, F3.0

### Acceptance criteria

- `npx tsc --noEmit --project frontend/tsconfig.json` passes clean.
- `npx eslint frontend/src` passes clean (zero errors).
- `npm --prefix frontend run test -- --coverage` passes; ≥ 70% threshold holds.
- `ruff check backend` and `mypy backend/app --strict` pass clean.
- `pytest --cov=backend/app --cov-fail-under=80` passes with new test file included.
- `make lint` and `make test` (root) both pass.
- **Manual verification** (seeded backend + `docker compose up`):
  1. Settings tab → "Block summary" button opens `BlockReviewScreen`; tab bar hidden.
  2. Active block page renders heatmap with correct date range and colored cells.
  3. Legend tallies (safe N / caution N / flare/violation N) match visible grid.
  4. If previous blocks exist: swiping right loads their heatmaps; each fetches
     `GET /api/training-blocks/{id}/scores` exactly once.
  5. Back button returns to Settings; tab bar restored.
  6. All Phase 7 screens still function unchanged (regression check).
  7. `GET /api/training-blocks/{id}/scores` returns 404 for a bogus ID (curl check).

### Edge cases to handle

- New files raising lint issues not caught per-ticket → fix here
- Coverage dip → add focused tests; do not lower thresholds without justification

### Files to create / modify

- `frontend/vitest.config.ts` (only if thresholds need rescoping)
- Test top-ups if needed

### Out of scope

- Phase 8 work

---

## Out of scope (explicit)

- **Block transition flow** — `BlockReviewScreen` is read-only/retrospective.
  No "End block", "Start new block", or "Carry rules forward" affordances.
- **Interactive cell detail** — tapping a cell to see the day's log entries
  is not in scope. `onCellClick` stays omitted.
- **`CalendarHeatmap` modifications** — the component ships unchanged.
- **Prefetching all block scores on mount** — lazy per-page fetch is sufficient.

---

## Verification (phase complete)

```bash
# From repo root after seed + compose
make lint
make test
docker compose up   # backend + frontend
# open http://localhost:5173 → Settings tab → Block summary button
# exercise the F3.1 manual matrix above
```

Expected: "Block summary" button in Settings opens a full-panel block review;
active block heatmap renders immediately from cached dashboard data; swiping
right through previous blocks lazy-loads each block's safety scores; back
returns to Settings with tab bar restored; all Phase 7 screens unchanged.

---

**Status:** `READY FOR IMPLEMENTATION` — three tickets, no open blockers.
Implementer starts with failing tests for B3.0, then F3.0, then F3.1.
