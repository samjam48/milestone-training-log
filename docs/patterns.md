# Implementation Patterns

Concrete implementation shapes for this repo.
Use this alongside `docs/architecture.md`:

- `architecture.md` explains how to decide
- `patterns.md` shows how we should usually implement those decisions in Milestone

These examples describe the target code shape for this app, even where the folders do not exist yet.
If scaffolding lands with different names, update this doc in the same change.

---

## Thin app entrypoints

- **Pattern:** Keep `App.tsx` and similar top-level entrypoints thin and declarative.
- **Use when:** Wiring the app shell, router, query provider, or top-level layout.
- **Avoid when:** The file starts owning dashboard orchestration, form state, or feature-specific fetch logic.
- **Canonical example:** `frontend/src/App.tsx` delegating to route-level screens and shared providers.
- **Common mistake:** Letting top-level files become the default place for "just one more" data fetch, modal, or derived-state concern.

## Screen orchestration

- **Pattern:** Put multi-component screen coordination in a feature-level controller or screen module under `features/` or `pages/`.
- **Use when:** A screen coordinates queries, derived summaries, optimistic state, dialogs, or multiple related cards.
- **Avoid when:** The logic only affects one small presentational component or can stay as a local helper.
- **Canonical example:** `frontend/src/features/dashboard/DashboardExperience.tsx` coordinating weekly targets, streaks, suggestions, and risk status for `frontend/src/pages/Dashboard.tsx`.
- **Common mistake:** Splitting one screen's coordination across several unrelated shared components.

## Shared UI primitive vs feature component

- **Pattern:** Put reusable interaction primitives in `components/ui/`; put domain-specific reusable UI in feature or screen folders.
- **Use when:** The same semantic UI surface should look and behave consistently across screens.
- **Avoid when:** The component only exists to avoid a few repeated lines or would need misleading props to appear generic.
- **Canonical example:** `frontend/src/components/ui/Button.tsx`, `frontend/src/components/ui/Slider.tsx`, and domain UI such as `frontend/src/components/dashboard/WeeklyTargetCard.tsx`.
- **Common mistake:** Creating bespoke variants of buttons, sliders, or cards instead of extending a shared primitive cleanly.

## Form container and presentation split

- **Pattern:** Keep submit flows, validation, and API coordination in a hook or controller; keep the form component focused on rendering and events.
- **Use when:** The form owns validation, edit-vs-create behavior, optimistic updates, or rule-violation previews.
- **Avoid when:** The form is tiny and purely local with no meaningful logic beyond a couple of controlled fields.
- **Canonical example:** `frontend/src/features/log-activity/useLogActivityForm.ts` with `frontend/src/components/forms/LogActivityForm.tsx`; `frontend/src/features/check-ins/useDailyCheckInForm.ts` with `frontend/src/components/forms/DailyCheckInForm.tsx`.
- **Common mistake:** Mixing fetch logic, mutation wiring, validation, and full JSX into one large component.

## Dashboard data composition

- **Pattern:** Fetch raw server data or pre-composed dashboard payloads in API or query modules, then shape screen-specific sections in one orchestration layer.
- **Use when:** Building the home dashboard with weekly target progress, compliance streaks, suggestions, and status traffic lights.
- **Avoid when:** Leaf cards independently fetch overlapping data or each component invents its own summary math.
- **Canonical example:** `frontend/src/api/dashboard.ts` feeding `frontend/src/features/dashboard/DashboardExperience.tsx`.
- **Common mistake:** Duplicating risk calculation or weekly-total shaping across several card components.

## Frontend data flow

- **Pattern:** Keep server fetching in API or query modules, orchestration in feature controllers, and rendering in components.
- **Use when:** Loading server data, shaping it for one screen, handling optimistic updates, or coordinating invalidation.
- **Avoid when:** Presentational components need to know request details, response parsing, or mutation recovery logic.
- **Canonical example:** `frontend/src/api/activityLogs.ts`, `frontend/src/api/checkIns.ts`, `frontend/src/features/log-history/LogHistoryScreen.tsx`.
- **Common mistake:** Fetching in leaf components or duplicating the same server-data transformation in several places.

## Frontend state ownership

- **Pattern:** Keep state in the smallest owner that can coordinate the interaction cleanly.
- **Use when:** Choosing between local component state, screen-level state, or shared app state.
- **Avoid when:** Promoting state to a store just for convenience or scattering one interaction across unrelated components.
- **Canonical example:** Local state in `DashboardExperience.tsx` for date filters or modal state; shared state only if a concept such as active weekly rules must coordinate across several screens.
- **Common mistake:** Copying server-derived state into local stores and component state at the same time.

## Backend route and service split

- **Pattern:** Routers translate HTTP requests and responses; services own business logic and persistence.
- **Use when:** Adding validation beyond schema shape, coordinating related writes, or enforcing domain rules.
- **Avoid when:** The route starts accumulating branching, query logic, or business-rule exceptions directly.
- **Canonical example:** `backend/app/routers/activity_logs.py` with `backend/app/services/activity_logs.py`; `backend/app/routers/daily_check_ins.py` with `backend/app/services/daily_check_ins.py`.
- **Common mistake:** Hiding domain rules in router functions because the first version looked like simple CRUD.

## Calculation services stay isolated

- **Pattern:** Keep load calculations, delayed-tax detection, and recovery-rule evaluation in focused service modules with minimal framework coupling.
- **Use when:** Implementing rolling load windows, milestone triggers, or traffic-light risk states.
- **Avoid when:** Calculation logic leaks into routers, React components, or ORM model methods.
- **Canonical example:** `backend/app/services/load_engine.py` called by `backend/app/services/dashboard.py` and thin analytics routes.
- **Common mistake:** Recomputing the same formulas separately in the API layer and the frontend.

## Load-tax stays in the load engine

- **Pattern:** Compute **load tax** (per-session effort score, rolling seven-day series, and load-risk day states) in `backend/app/services/load_engine.py` — helpers such as `compute_log_load_tax`, `compute_load_series`, and `compute_load_risk_summary`. Dashboard and load routes call these; the frontend maps API payloads and renders graphs and rows only.
- **Use when:** Changing how performance sessions contribute to the dashboard graph, the seven-day strip, or rule-limit proximity.
- **Avoid when:** Duplicating tax tiers, recency weights, or rule-proximity math in `frontend/src/lib/engine.ts`, chart components, or card-level derived state.
- **Canonical example:** `compute_load_series` producing `load` + `daily_load` per day; `compute_load_risk_summary` producing `week_days` and `rule_limit_rows`.
- **Common mistake:** Reintroducing raw `volume × rpe` or client-side rolling windows that drift from backend constants and tests.

## Shared backend guards and helpers

- **Pattern:** Put repeated domain guards and cross-cutting helpers in focused service modules or core helpers.
- **Use when:** Multiple write paths need the same active-block lookup, rest-window check, date-window helper, or pagination behavior.
- **Avoid when:** A helper exists only to avoid two obvious lines and creates a harder-to-read indirection.
- **Canonical example:** `backend/app/services/rule_checks.py`, `backend/app/core/time.py`, `backend/app/services/pagination.py`.
- **Common mistake:** Repeating the same guard logic in several service functions until behavior drifts.

## API client module shape

- **Pattern:** Keep frontend API modules responsible for request paths, request bodies, response parsing, and cache-facing query helpers only.
- **Use when:** Adding a new resource client, mutation helper, or list query.
- **Avoid when:** The module starts owning screen-specific view logic, sorting, or modal behavior.
- **Canonical example:** `frontend/src/api/client.ts`, `frontend/src/api/goals.ts`, `frontend/src/api/trainingBlocks.ts`.
- **Common mistake:** Letting each caller invent its own path construction, response parsing, or error-shape handling.

## Test naming

- **Pattern:** Name test files and test cases after observable behavior, not ticket IDs or implementation phases.
- **Use when:** Creating new tests or renaming touched tests.
- **Avoid when:** Smuggling sprint names, branch names, or temporary project labels into long-lived test files.
- **Canonical example:** `dashboard.shows-risk-status.test.tsx` and `it('flags a class as risky when the rolling load cap is exceeded')`.
- **Common mistake:** Names like `phase-1-backend.test.ts` that stop meaning anything once the ticket is closed.

## Test scope selection

- **Pattern:** Match test scope to risk and prefer the smallest test that proves the behavior.
- **Use when:** Choosing between unit tests, service tests, route tests, feature integration tests, or end-to-end flows.
- **Avoid when:** Reaching for a full-app test by default when a focused service or feature test would cover the change more directly.
- **Canonical example:** Backend service tests around `load_engine.py`; frontend feature tests around logging and check-in flows.
- **Common mistake:** Using broad slow tests for every UI change until the test harness becomes the main maintenance burden.

## UI copy

- **Pattern:** User-visible text should sound like product UI, not implementation commentary.
- **Use when:** Naming actions, labels, empty states, dialog titles, helper text, and status copy.
- **Avoid when:** The string is really for developers, reviewers, or agents rather than end users.
- **Canonical example:** Short labels such as `Morning check-in`, `Suggested today`, `Weekly target`, `Rule warning`.
- **Common mistake:** Shipping strings that mention phases, tickets, backend behavior, or internal workflow terms.

## Documentation sync

- **Pattern:** Update the nearest living reference when a reusable contract or implementation shape changes.
- **Use when:** Changing API contracts, schema shape, or introducing a new repeated pattern.
- **Avoid when:** The change is purely local and does not affect shared behavior or future implementation decisions.
- **Canonical example:** API changes update `docs/api-map.md`; schema changes update `docs/database-schema.md`; new repeated implementation shapes update `docs/patterns.md`.
- **Common mistake:** Merging a new cross-cutting pattern into code without recording the preferred shape anywhere.
