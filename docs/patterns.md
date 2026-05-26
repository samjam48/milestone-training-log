# Implementation Patterns

Concrete implementation shapes for this repo.
Use this alongside `docs/architecture.md`:

- `architecture.md` explains **how to decide**
- `patterns.md` shows **how we usually implement it here**

This document describes target patterns to reinforce, not every legacy artifact already present in the codebase.

---

## Thin app entrypoints

- **Pattern:** Keep `App.tsx` and similar top-level entrypoints thin and declarative.
- **Use when:** Wiring the app shell, handing off to one feature-level workspace controller, or setting up a page-level composition root.
- **Avoid when:** The file needs to own domain-specific orchestration, drag-and-drop logic, fetch state, or mutation flows.
- **Canonical example:** `frontend/src/App.tsx` delegating to `frontend/src/features/workspace/WorkspaceExperience.tsx`
- **Common mistake:** Letting top-level files become the default place for “just one more” workflow, modal, or board concern.

## Feature orchestration

- **Pattern:** Put multi-component feature coordination in a feature controller or feature-level component under `features/`.
- **Use when:** A screen coordinates queries, derived filters, optimistic state, dialogs, and feature-specific presentation.
- **Avoid when:** The logic only affects one small presentational component, or can stay as a local helper without cross-component coordination.
- **Canonical example:** `frontend/src/features/workspace/WorkspaceExperience.tsx`
- **Common mistake:** Splitting related orchestration across unrelated components, or pushing it back into shared layout components.

## Shared UI primitive vs feature component

- **Pattern:** Put reusable interaction primitives in `components/ui/`; put domain-specific reusable UI in feature or domain folders.
- **Use when:** The same semantic UI surface should look and behave consistently across screens.
- **Avoid when:** The component only exists to avoid a few repeated lines, or would need misleading props to appear “generic.”
- **Canonical example:** `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/DialogFormFooter.tsx`, `frontend/src/components/ui/ConfirmDialog.tsx`
- **Common mistake:** Creating bespoke variants of buttons, footers, or simple dialogs instead of extending the shared primitive cleanly.

## Dialog container and presentation split

- **Pattern:** Keep dialog state, submit flows, and API coordination in a hook or controller; keep the dialog component focused on rendering and events.
- **Use when:** The dialog owns validation, autosave, nested modals, or mutation side effects.
- **Avoid when:** The dialog is a tiny local confirm with no meaningful state beyond open/closed.
- **Canonical example:** `frontend/src/features/tasks/useTaskDialog.tsx` with `frontend/src/components/TaskDialog.tsx`; `frontend/src/features/projects/useProjectDialog.tsx` with `frontend/src/components/ProjectDialog.tsx`
- **Common mistake:** Mixing fetch logic, mutation wiring, validation, and detailed JSX in one giant component until it becomes the new monolith.

## Dialog action layout

- **Pattern:** Use the shared footer layout and keep destructive actions outside the primary save/cancel pair.
- **Use when:** Building create/edit forms or any modal with a primary confirm action.
- **Avoid when:** The modal is only a single-purpose confirmation dialog that already uses `ConfirmDialog`.
- **Canonical example:** `frontend/src/components/ui/DialogFormFooter.tsx`, `frontend/src/components/ui/ConfirmDialog.tsx`
- **Common mistake:** Reintroducing custom footer button orders or mixing archive/delete into the same visual group as save.

## Archive and restore flows

- **Pattern:** Reuse shared archive list and confirm primitives for browse-and-restore flows.
- **Use when:** Archived entities need a list view, restore action, details preview, or filterable archive browser.
- **Avoid when:** The action is a one-off inline archive button with no archive browser or restore surface.
- **Canonical example:** `frontend/src/features/archives/ArchiveList.tsx`, `frontend/src/components/ArchiveDialog.tsx`, `frontend/src/components/ui/ConfirmDialog.tsx`
- **Common mistake:** Building separate restore UIs for each entity with slightly different confirmation behavior and no shared interaction model.

## Kanban board composition

- **Pattern:** Reuse shared Kanban shell pieces and keep domain-specific card content thin.
- **Use when:** A board needs the same drag context, column shell, sortable card shell, and empty-state behavior across domains.
- **Avoid when:** A board has a genuinely different interaction model and would need heavy branching to fit the shared shell.
- **Canonical example:** `frontend/src/components/kanban/KanbanBoard.tsx`, `frontend/src/components/kanban/KanbanColumn.tsx`, `frontend/src/components/TaskKanbanBoard.tsx`, `frontend/src/components/ProjectKanbanBoard.tsx`
- **Common mistake:** Copying drag-and-drop plumbing into a second board instead of extending the shared shell.

## Frontend data flow

- **Pattern:** Keep server fetching in API/query modules, orchestration in feature controllers, and rendering in components.
- **Use when:** Loading server data, shaping it for one screen, handling optimistic updates, or coordinating invalidation.
- **Avoid when:** Presentational components would need to know request details, response parsing, or mutation recovery logic.
- **Canonical example:** `frontend/src/api/projects.ts`, `frontend/src/api/ventures.ts`, `frontend/src/features/workspace/WorkspaceExperience.tsx`
- **Common mistake:** Fetching in leaf components, duplicating the same transformation in several places, or mixing formatting logic into mutation modules.

## Frontend state ownership

- **Pattern:** Keep state in the smallest owner that can coordinate the interaction cleanly.
- **Use when:** Choosing between local component state, feature controller state, or shared store state.
- **Avoid when:** Promoting state to a store just for convenience, or scattering one interaction across several unrelated local states.
- **Canonical example:** `frontend/src/stores/projectFilter.ts` for cross-screen selection state, local state inside `WorkspaceExperience.tsx` for board-local behavior
- **Common mistake:** Duplicating server-derived state in stores or keeping the same source of truth in both a store and a feature controller.

## Backend route and service split

- **Pattern:** Routers translate HTTP requests and responses; services own business logic and persistence.
- **Use when:** Adding validation beyond schema shape, coordinating related writes, or enforcing domain rules.
- **Avoid when:** The route starts accumulating branching, query logic, or business-rule exceptions directly.
- **Canonical example:** `backend/app/routers/projects.py` with `backend/app/services/projects.py`; `backend/app/routers/tasks.py` with `backend/app/services/tasks.py`
- **Common mistake:** Hiding domain rules in router functions because the first version looked like simple CRUD.

## Shared backend guards and helpers

- **Pattern:** Put repeated domain guards and cross-cutting helpers in focused service modules or core helpers.
- **Use when:** Multiple write paths need the same mutable-state check, time helper, or pagination behavior.
- **Avoid when:** A helper exists only to avoid two obvious lines and creates a harder-to-read indirection.
- **Canonical example:** `backend/app/services/task_guards.py`, `backend/app/core/time.py`, `backend/app/services/pagination.py`
- **Common mistake:** Repeating the same guard logic in several service functions until behavior drifts between endpoints.

## API module shape

- **Pattern:** Keep frontend API modules responsible for request paths, request bodies, response parsing, and cache-facing query helpers only.
- **Use when:** Adding a new resource client, mutation helper, or list query.
- **Avoid when:** The module starts owning screen-specific view logic, sorting, or modal behavior.
- **Canonical example:** `frontend/src/api/projects.ts`, `frontend/src/api/client.ts`
- **Common mistake:** Letting each caller invent its own path construction, response parsing, or error-shape handling.

## Pagination contract

- **Pattern:** Treat paginated responses as a first-class API shape, not an incidental array wrapper.
- **Use when:** Adding `limit` and `cursor` to backend list routes or exposing paginated data to the frontend.
- **Avoid when:** The UI truly does not need pagination yet and a simple list is still the intended contract.
- **Canonical example:** `backend/app/schemas/pagination.py`, `backend/app/services/pagination.py`, paginated list routes in `backend/app/routers/*.py`
- **Common mistake:** Parsing `{ items, next_cursor }` and immediately throwing away cursor metadata in the caller that will eventually need it.

## Test naming

- **Pattern:** Name test files and test cases after observable behavior, not ticket IDs or implementation phases.
- **Use when:** Creating new tests or renaming touched tests.
- **Avoid when:** Smuggling branch names, sprint names, or temporary project labels into long-lived test files.
- **Canonical example:** `App.auth-redirect.test.tsx` and `it('redirects signed-out users to the login page')`
- **Common mistake:** Names like `App.1b4.test.tsx` or `phase-1-6-*.test.tsx` that stop meaning anything once the ticket is closed.

## Test scope selection

- **Pattern:** Match test scope to risk and prefer the smallest test that proves the behavior.
- **Use when:** Choosing between unit tests, feature integration tests, full-app integration tests, or backend service/route tests.
- **Avoid when:** Reaching for a full-app test by default when a feature-level test or controller test would cover the change more directly.
- **Canonical example:** Feature-level tests near `frontend/src/features/*`; backend behavior tests under `backend/app/tests/*`
- **Common mistake:** Using broad end-to-end style tests for every UI change until the harness becomes the main maintenance burden.

## UI copy

- **Pattern:** User-visible text should sound like product UI, not implementation commentary.
- **Use when:** Naming actions, labels, empty states, dialog titles, helper text, and status copy.
- **Avoid when:** The string is really for developers, reviewers, or agents rather than end users.
- **Canonical example:** Short labels such as `Time logs`, `Archive`, `Showing 3 projects`
- **Common mistake:** Shipping strings that mention phases, tickets, backend behavior, or internal workflow terms.

## Documentation sync

- **Pattern:** Update the nearest living reference when a reusable contract or implementation shape changes.
- **Use when:** Changing API contracts, schema shape, or introducing a new repeated pattern.
- **Avoid when:** The change is purely local and does not affect shared behavior or future implementation decisions.
- **Canonical example:** API changes update `docs/api-map.md`; schema changes update `docs/database-schema.md`; new repeated implementation shapes update `docs/patterns.md`
- **Common mistake:** Merging a new cross-cutting pattern into code without recording the preferred shape anywhere.
