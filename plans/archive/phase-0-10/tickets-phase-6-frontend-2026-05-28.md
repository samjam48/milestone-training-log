# Phase 6 — Frontend Scaffold + API Integration Tickets
*Source: `plans/TRD.md` §7 Phase 6, `plans/PRD.md` §4 F1–F4 + §7,
`DESIGN.md`, `docs/api-map.md`, `docs/patterns.md`,
`export/src/hooks/useMilestoneEngine.ts`, architect review 2026-05-28 |
Date: 2026-05-28*

## Planning assumptions locked for this ticket set

- Phase 0–5 are complete and merged to `main`. Backend API, seed script, and
  `GET /api/dashboard` are live and tested.
- Phase 6 is frontend-only except Makefile / docker-compose wiring. No backend
  schema, router, or service changes unless a test exposes a pre-existing bug
  (fix in a separate `fix/` ticket, not in Phase 6 scope).
- All work lands on branch `feat/phase-6-frontend`.
- **`export/` stays frozen.** Copy `export/src/` → `frontend/src/` on F1.1;
  do not edit `export/` during implementation except to fix copy-paste errors
  discovered after the fact (prefer fixing `frontend/` only).
- **API JSON casing:** backend responses and request bodies use **snake_case**
  (unchanged). Frontend domain types in `types.ts` stay **camelCase**. All
  mapping happens in `frontend/src/lib/api/` — no Pydantic alias churn.
- **Runtime authority:** once F1.3 lands, derived dashboard state comes from
  `GET /api/dashboard` and load routes. Do **not** call `engine.ts` /
  `load.ts` compute functions from the live hook path. Keep those files for
  optional unit tests and reference parity.
- **Client-generated IDs:** all Phase 2 POST bodies require an `id` field.
  Frontend generates opaque string IDs via `crypto.randomUUID()` before POST.
- **Log History vs dashboard logs:** `MilestoneEngineResult.logs` must come from
  `GET /api/activity-logs` (full history). Dashboard `logs` (30-day window) is
  not used for Log History screen.
- **Live rule check:** `checkViolations` in the hook calls
  `POST /api/load/check-violations` (all five rule types). Remove the
  prototype's inline two-rule implementation.
- **Goals / Settings tabs:** keep four-tab nav; render **"Coming soon"**
  placeholder content for Goals and Settings until Phase 7.
- **Recovery streaks:** extend `MilestoneEngineResult` with `recoveryStreaks`
  mapped from dashboard `recovery_streaks`. UI consumption deferred to Phase 7.
- **Delayed tax:** implement API client wrapper in F1.2; dashboard UI deferred
  to Phase 7+ (PRD F4).
- **Quality gates:** F1.4 must make `npx tsc --noEmit`, `eslint`, and Vitest
  pass; expand root `Makefile` `lint` / `test` to include frontend once
  `frontend/` exists. Target ≥ 70% Vitest coverage on `frontend/src/lib/api/`
  and `frontend/src/hooks/` (scoped coverage config acceptable for Phase 6).

## Owner decisions resolved (2026-05-28)

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Goals/Settings before Phase 7 | **"Coming soon"** placeholder screens |
| 2 | JSON casing | **snake_case backend + client-side camelCase mappers** |
| 3 | Log History source | **`GET /api/activity-logs`** (not dashboard `logs`) |
| 4 | Rule check at log time | **`POST /api/load/check-violations`** |
| 5 | Write IDs | **`crypto.randomUUID()`** on frontend |
| 6 | `engine.ts` at runtime | **Not used in hook** after F1.3 |
| 7 | `recovery_streaks` UI | **Hook maps field; UI in Phase 7** |
| 8 | Delayed tax UI | **Client wrapper F1.2; UI Phase 7+** |
| 9 | Phase 5 status | **Merged to `main`** before Phase 6 starts |

## Planner assumptions (no owner block — change if wrong)

| # | Topic | Assumption |
| --- | --- | --- |
| A | ID format | `crypto.randomUUID()` strings (no ULID dependency) |
| B | Check-violations debounce | 300 ms debounce in hook before POST (reduce chatter while typing volume/RPE) |
| C | Activity logs list | Single unfiltered `GET /api/activity-logs` fetch; pagination deferred |
| D | API module layout | `frontend/src/lib/api/` folder (`client.ts`, `mappers.ts`, resource modules) with barrel `index.ts` — not one 800-line file |
| E | Vitest scope | F1.4 adds mapper unit tests + hook smoke test with MSW or mocked fetch; full screen tests optional |
| F | `@/` path alias | Add `@/` → `src/` in `tsconfig` + Vite; update copied imports incrementally in F1.4 only where needed for new files (relative imports in copied screens may stay) |
| G | Dev workflow | `docker compose up` runs backend + Vite dev server; Vite proxies `/api` → backend |

---

## Ticket ordering rationale

F1.1 creates the runnable app shell (Vite, Tailwind, React Query, tab routing,
docker-compose) so subsequent tickets have a browser target.

F1.2 builds the typed API client and snake↔camel mappers independent of React.
Tests can validate mappers without mounting components.

F1.3 rewires `useMilestoneEngine` to consume F1.2 clients. This is the
integration seam — screens should need zero or minimal changes.

F1.4 hardens quality gates (tsc, eslint, vitest), fixes hardcoded prototype
labels, and extends Makefile.

---

## F1.1 — Vite scaffold + app shell

**Type:** frontend + devops  
**Branch:** `feat/phase-6-frontend`  
**Depends on:** Phase 5 on `main`

### Acceptance criteria

- `frontend/` directory created with Vite 5 + React 18 + TypeScript 5
  (`strict: true`, `noUncheckedIndexedAccess` recommended if Vite template
  allows without excessive churn).
- Dependencies installed at minimum:
  - runtime: `@tanstack/react-query`
  - dev: `tailwindcss`, `postcss`, `autoprefixer`, `vitest`,
    `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `eslint`
    (+ typescript-eslint / react plugins as per Vite TS template)
- Copy **unchanged** from export (then adapt only where F1.1 requires):
  - `export/src/` → `frontend/src/` (components, hooks, lib, types)
  - `export/tailwind.config.js` → `frontend/tailwind.config.js`
- New files created:
  - `frontend/index.html` (Inter Tight + JetBrains Mono font links per
    `export/README.md`)
  - `frontend/src/main.tsx` — `QueryClientProvider`, render `App`
  - `frontend/src/App.tsx` — tab state, `AppShell`, `BottomTabBar`, screen
    routing, modal/full-screen flows for check-in / log activity / log incident
  - `frontend/src/index.css` — Tailwind directives + safe-area base styles
  - `frontend/vite.config.ts` — dev server port `5173`, proxy
    `'/api' → 'http://backend:${BACKEND_PORT}'` (read from env or default
    `8084` to match compose)
  - `frontend/tsconfig.json`, `frontend/tsconfig.node.json`
  - `frontend/postcss.config.js`
  - `frontend/eslint.config.js` (or `.eslintrc` matching project conventions)
  - `frontend/vitest.config.ts` (can stub minimal config; expanded in F1.4)
- **`App.tsx` routing behaviour:**
  - Tabs: `dashboard` | `log` | `goals` | `settings` using existing
    `BottomTabBar`
  - Dashboard tab → `DashboardScreen` with engine from hook
  - Log tab → `LogHistoryScreen`
  - Goals tab → placeholder: centred **"Coming soon"** (product copy, not
    ticket jargon)
  - Settings tab → same placeholder
  - Full-screen overlays (no tab bar): `MorningCheckInScreen`, `LogActivityScreen`,
    `LogIncidentScreen` — opened from dashboard CTAs / log tab actions; back
    navigation returns to prior tab
  - Pass `useMilestoneEngine()` once at App level; prop-drill `engine` to screens
    (matches prototype contract)
- **`docker-compose.yml` frontend service** replaces placeholder:
  - Build or bind-mount `frontend/`
  - Command runs `npm run dev -- --host 0.0.0.0`
  - Port `5173:5173`
  - Depends on healthy backend (optional but preferred)
- Root `Makefile`:
  - `make dev` unchanged (`docker compose up`)
  - Document that frontend is reachable at `http://localhost:5173` after compose up
- Manual verification (owner gate for F1.1 before F1.2 if no frontend tests yet):
  - With seeded backend running, app renders Dashboard with **mock data still
    in hook** (F1.3 rewires later) OR early stub shows shell without crash
  - Four tabs navigate; Goals/Settings show "Coming soon"
  - No TypeScript errors on `npx tsc --noEmit --project frontend/tsconfig.json`
    for scaffold files (copied export files may warn until F1.4 — acceptable if
    documented)

### Reuse / extend

- `export/src/components/ui/AppShell.tsx`, `BottomTabBar.tsx`
- `export/src/components/screens/*`
- `export/src/hooks/useMilestoneEngine.ts` (mock implementation until F1.3)
- `docker-compose.yml` backend service (unchanged)
- `plans/TRD.md` §1 architecture diagram (Vite proxy)

### Edge cases to handle

- Backend down → app shell still renders (mock hook works offline); real error
  handling is Phase 8 F3.1
- `max-w-[440px]` AppShell column preserved for mobile-first preview
- Tab bar hidden on full-screen flows (`withTabBar={false}` on AppShell)
- CORS not required — all API calls use relative `/api/...` through Vite proxy

### Files to create / modify

- `frontend/**` (new tree)
- `docker-compose.yml` (frontend service)
- `Makefile` (comment or doc target only — full lint/test expansion in F1.4)
- `.gitignore` — ensure `frontend/node_modules`, `frontend/dist` ignored

### Out of scope

- API client (`F1.2`)
- Hook rewire (`F1.3`)
- Replacing mock data

---

## F1.2 — Typed API client + snake↔camel mappers

**Type:** frontend  
**Branch:** `feat/phase-6-frontend`  
**Depends on:** F1.1

### Acceptance criteria

- Tests in `frontend/src/lib/api/mappers.test.ts` (and/or per-resource tests)
  are written **before** mapper implementation. They fail first.
- `frontend/src/lib/api/` module structure:

  | File | Responsibility |
  | --- | --- |
  | `client.ts` | Base `apiFetch<T>()`, `ApiError` (status, body snippet), JSON parse, relative `/api` paths |
  | `mappers.ts` | Generic + entity-specific snake↔camel transforms |
  | `dashboard.ts` | `getDashboard(asOf?)` |
  | `activityLogs.ts` | list, create, patch, delete |
  | `dailyCheckIns.ts` | list, create, get today, get by date, patch |
  | `flareUpIncidents.ts` | list, create, patch |
  | `load.ts` | summary, checkViolations, delayedTax |
  | `activityClasses.ts` | list, create, patch |
  | `activities.ts` | list, create, patch |
  | `trainingBlocks.ts` | list, active, create, patch |
  | `rules.ts` | list by block, create, patch, delete |
  | `weeklyTargets.ts` | list by block, create, patch |
  | `recoveryTargets.ts` | list by block, create |
  | `goals.ts` | list, create, patch |
  | `health.ts` | `getHealth()` |
  | `index.ts` | Barrel exports |

- **`ApiError`:** thrown on non-2xx; exposes `status: number`, `message: string`,
  optional parsed `detail` from FastAPI error body.
- **Mapper rules (minimum):**
  - Response: snake_case JSON → camelCase objects matching `types.ts`
  - Request: camelCase draft → snake_case JSON for POST/PATCH bodies
  - Dates: `YYYY-MM-DD` strings pass through; datetimes ISO 8601 → `ISODateTime`
  - `user_id` omitted on reads → do not require `userId` on mapped entities
    (optional field omitted or undefined)
  - Check-in embedded `flare_up` → `flareUp` with
    `likelyCauseActivityClassIds: activityClassId ? [id] : []`
  - Dashboard `as_of` → available to hook as `todayDate`
  - Dashboard `recovery_streaks[]` → `RecoveryStreak[]` camelCase type (new
    interface in `types.ts` or `hooks/useMilestoneEngine.ts`)
  - `daily_scores[].state` includes backend `"neutral"` → map to
    `SafetyState | 'neutral'` (matches existing engine types)
- **Endpoints implemented** (match `docs/api-map.md` / TRD §5):

  All CRUD + load + dashboard routes. Phase 6 **uses** a subset in F1.3; Phase 7
  consumes the rest — implement fully typed wrappers now to avoid contract drift.

- **`checkViolations` request:** `{ activity_id, volume_value, rpe, as_of? }`
- **`checkViolations` response:** `{ violations: RuleViolationSnapshot[] }`
  mapped to camelCase
- No `any` in TypeScript; strict types throughout.
- Mapper unit tests cover at minimum:
  - `ActivityLogRead` round-trip (request body for create)
  - `DashboardRead` top-level keys including `recovery_streaks`
  - `DailyCheckInRead` with embedded `flare_up`
  - `RuleViolationRead` severity values
  - Error body → `ApiError`

### Reuse / extend

- `frontend/src/types.ts` — domain types (extend for `RecoveryStreak` if needed)
- `docs/api-map.md` — path and field reference
- `backend/app/schemas/*` — authoritative snake_case field names
- `export/src/lib/mockData.ts` — fixture values for mapper tests (import
  allowed in test files only)

### Edge cases to handle

- Empty list responses `[]` — not null
- `block: null` on dashboard — map to `null`, not undefined shape mismatch
- Optional nullable fields (`notes`, `rpe`, `volume_unit`) — preserve null vs omit
- `DELETE` returns 204 with empty body — client handles no JSON parse
- Invalid JSON error response — `ApiError` with fallback message

### Files to create / modify

- `frontend/src/lib/api/**`
- `frontend/src/types.ts` (extend if needed for `RecoveryStreak`)
- `frontend/src/lib/api/mappers.test.ts` (+ optional resource tests)

### Out of scope

- React Query hooks (F1.3)
- MSW integration tests (optional in F1.4)

---

## F1.3 — Rewire `useMilestoneEngine` to real API

**Type:** frontend  
**Branch:** `feat/phase-6-frontend`  
**Depends on:** F1.2

### Acceptance criteria

- Tests in `frontend/src/hooks/useMilestoneEngine.test.tsx` written **before**
  hook rewire. Use mocked `frontend/src/lib/api` module or MSW. Fail first.
- Remove runtime dependency on `lib/mockData.ts` from the hook (file may remain
  in repo for mapper tests / reference).
- Remove runtime calls to `computeClassStatuses`, `computeWeeklyProgress`, etc.
  from the hook — dashboard query supplies derived fields.
- **`useQuery` keys and sources:**

  | Hook field | Source |
  | --- | --- |
  | `todayDate` | dashboard `asOf` |
  | `userName` | dashboard `userName` |
  | `block` | dashboard `block` |
  | `activityClasses` | dashboard `activityClasses` |
  | `activities` | dashboard `activities` |
  | `logs` | **`GET /api/activity-logs`** (full list, not dashboard logs) |
  | `incidents` | dashboard `incidents` |
  | `hasCheckedInToday` | dashboard `hasCheckedInToday` |
  | `classStatuses` | dashboard `classStatuses` |
  | `suggestions` | dashboard `suggestions` |
  | `weeklyProgress` | dashboard `weeklyProgress` |
  | `dailyScores` | dashboard `dailyScores` |
  | `loadSeries` | dashboard `loadSeries` |
  | `flareUpDates` | dashboard `flareUpDates` |
  | `weekLoadThreshold` | dashboard `weekLoadThreshold` |
  | `cleanStreak` | dashboard `cleanStreak` |
  | `recoveryStreaks` | dashboard `recoveryStreaks` (**new** on result type) |

- **`useMutation` behaviour:**
  - `submitLog` → `POST /api/activity-logs` with client UUID, mapped snake body,
    includes `ruleViolationsAtLog` from last check result; on success invalidate
    `['dashboard']` and `['activity-logs']`
  - `submitCheckIn` → `POST /api/daily-check-ins` with client UUID; map flare-up
    fields to API shape (`flare_up` nested create when `hasFlareUp`); invalidate
    `['dashboard']`
  - `submitIncident` → `POST /api/flare-up-incidents` with client UUID;
    invalidate `['dashboard']`
- **`checkViolations(activityId, volumeValue, rpe)`:**
  - Calls `POST /api/load/check-violations` via API client
  - Debounced ~300 ms when invoked from Log Activity screen inputs (implement
    debounce in hook or document screen-level pattern — prefer hook wrapper
    `checkViolationsDebounced` or internal debounce)
  - Uses dashboard `todayDate` as `as_of` unless overridden
  - Returns `RuleViolationSnapshot[]` synchronously from latest completed request
    OR documents async pattern with loading state — **must not** block submit;
    Log Activity screen expects sync array from memo (use queryClient.fetchQuery
    with short cache or keep last result + debounced refetch)
- **Extended `MilestoneEngineResult`:**
  - Add `recoveryStreaks: RecoveryStreak[]`
  - Existing fields unchanged for screen compatibility
  - Mutations remain `void` returning (fire-and-forget with invalidate) unless
    tests require Promise — match prototype UX
- **Loading / error exposure (minimal for Phase 6):**
  - Hook may expose `isLoading` / `isError` optional fields OR App shows blank
    until loaded — full skeleton UX is Phase 8. At minimum: don't crash on
    pending query; Dashboard renders empty-safe defaults or null guard in App.
- Hook tests cover at minimum:
  - Dashboard + activity-logs queries invoked on mount
  - `submitLog` POST body includes snake_case keys and generated `id`
  - Successful mutation invalidates both query keys
  - `checkViolations` calls load API (mocked)

### Reuse / extend

- `frontend/src/lib/api/` from F1.2
- `export/src/hooks/useMilestoneEngine.ts` — mutation draft interfaces unchanged
- All five Tier-3 screens — **no import changes** if result type extended additively

### Edge cases to handle

- Duplicate check-in same day → backend upsert semantics on POST; UI should
  refresh dashboard CTA away
- Log with violations → `rule_violations_at_log` persisted; history row shows badge
- Backend unreachable → hook error state; App must not white-screen (minimal message OK)
- Stale closure on `checkViolations` while logs changing — use latest dashboard
  `as_of` from query cache
- Activity log list ordering — backend returns newest-first; Log History grouping
  unchanged

### Files to create / modify

- `frontend/src/hooks/useMilestoneEngine.ts`
- `frontend/src/hooks/useMilestoneEngine.test.tsx`
- `frontend/src/types.ts` (if `RecoveryStreak` not added in F1.2)
- `frontend/src/App.tsx` (only if query loading guards needed)

### Out of scope

- Screen copy / label fixes (`F1.4`)
- Delayed tax dashboard panel
- Recovery streaks UI section
- Optimistic updates (nice-to-have; invalidation sufficient for Phase 6)

---

## F1.4 — TypeScript, ESLint, Vitest, Makefile, label cleanup

**Type:** frontend + devops  
**Branch:** `feat/phase-6-frontend`  
**Depends on:** F1.3

### Acceptance criteria

- `npx tsc --noEmit --project frontend/tsconfig.json` passes clean.
- `npx eslint frontend/src` passes clean (zero errors; warnings policy: fix or
  document in ticket commit message).
- Vitest:
  - `npm --prefix frontend run test -- --coverage` passes
  - Coverage ≥ **70%** on `frontend/src/lib/api/` and
    `frontend/src/hooks/` (scoped threshold in vitest config acceptable)
  - Existing mapper + hook tests from F1.2/F1.3 green
- **Hardcoded prototype labels removed:**
  - `DashboardScreen` activity status rows: use
    `activityClasses.find(c => c.id === cs.activityClassId)?.name` instead of
    `cls-foot` / `cls-recovery` ternary
  - `WeeklyLoadGraph` title: derive from first weekly-cap class name or
    `"Load"` fallback — remove hardcoded `"Foot Load"` string
  - Do **not** change layout or behaviour beyond label source
- Root **`Makefile`** updated:
  - `make lint` — backend gates + `tsc` + `eslint` frontend
  - `make test` — backend pytest + frontend vitest with coverage
  - Backend-only path still works from `backend/` for CI parity
- **`AGENTS.md` quality gates** satisfied for frontend existence.
- End-to-end manual verification checklist passes (owner or agent documents in
  handoff):
  1. `docker compose up` + seed DB → Dashboard shows seeded Sam scenario
  2. Dashboard class statuses match backend (foot class caution at seed `as_of`)
  3. Log Activity → live violations show for cap/rest rules → submit → appears in
     Log History
  4. Morning Check-In submit → dashboard CTA hidden on refresh
  5. Log Incident → incident reflected in dashboard flare markers / data
  6. Goals / Settings tabs → "Coming soon"

### Reuse / extend

- `Makefile` backend targets
- `AGENTS.md` §Quality Gates
- `docs/patterns.md` — test naming conventions

### Edge cases to handle

- `activityClasses` empty → status label falls back to `"Unknown class"`
- Graph title when `block` null → sensible default `"Weekly load"`
- ESLint on copied export files — fix issues without rewriting components

### Files to create / modify

- `frontend/src/components/screens/DashboardScreen.tsx` (labels only)
- `frontend/src/components/composites/WeeklyLoadGraph.tsx` (title prop source in App or screen)
- `Makefile`
- `frontend/vitest.config.ts` (coverage thresholds)
- `frontend/package.json` scripts: `test`, `lint`

### Out of scope

- Phase 8 loading skeletons / error boundary
- Phase 7 screen ports
- Backend changes

---

## Out of scope (explicit)

- Port Goals / Settings / NewActivitySheet (Phase 7)
- Delayed tax dashboard UI (Phase 7+)
- Recovery streaks compliance UI (Phase 7)
- `CalendarHeatmap` wiring (Phase 7)
- Review milestone auto-detection (Phase 8 F3.2)
- MCP context endpoint (Phase 8 B6.1)
- Auth / multi-user
- Log pagination
- Pydantic camelCase aliases on backend
- Capacitor / native packaging
- Deleting `export/` or `engine.ts` (keep as reference)

---

## Verification (phase complete)

```bash
# From repo root after seed + compose
make lint
make test
docker compose up   # backend + frontend
# open http://localhost:5173
```

Expected: five functional screens on real API data; Goals/Settings placeholders;
Log History shows full seeded history (>30 days if seed spans >30 days);
mutations persist across reload.

---

## Open questions for owner (non-blocking defaults applied)

| # | Question | Default if silent |
| --- | --- | --- |
| 1 | Vitest 70% coverage whole `frontend/src` vs scoped `api/` + `hooks/` only? | **Scoped** to `api/` + `hooks/` for Phase 6 |
| 2 | Add `@/` path alias and migrate copied imports? | **New files only**; copied relative imports stay until touched |
| 3 | `checkViolations` sync API for LogActivity memo — use `useQuery` with enabled flag vs manual fetch + local state? | **Local state updated by debounced fetchQuery** — document in hook |

---

**Status:** `SIGNED OFF` — Phase 6 ticket set ready for Test Writer on **F1.1**.
