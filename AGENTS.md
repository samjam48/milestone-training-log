**Read this before every session. Keep it short. Update CURRENT SPRINT when the active phase changes.**
---
## What This Project Is
A local-first health and performance tracking app for rehab and training decisions.
Planned stack: FastAPI + SQLModel + SQLite feeding a React + TypeScript + Tailwind frontend.

Current repo sources of truth:
- `README.md` — project overview and MVP framing
- `DESIGN.md` — functional design and product behavior
- `MOCKUPS.md` — screen flows and UI expectations
- `plans/milestone-architecture.md` — current architecture, schema, API, and roadmap plan
- `docs/architecture.md` — decision rules and architectural biases
- `docs/patterns.md` — target implementation shapes for this repo
- `docs/api-map.md` — planned API contract map
- `docs/database-schema.md` — planned relational schema map

Project-specific role prompts live in `/agents/`.
For a major feature or phase build, start with `/agents/orchestrator.md` as the workflow controller.
Use one role and one ticket at a time. No parallel tickets or sub-agents.

AI guidance lives in:
- `agents/README.md` — role prompts and when to use them
- `docs/ai/README.md` — shared AI workflow notes
- `docs/ai/rules.md` — shared hooks and rules
- `docs/ai/skills/index.md` — shared skills catalog and routing guide
---
## Hard Constraints
1. **No commits to `main`.** All work happens on feature branches: `feat/`, `fix/`, `chore/`.
2. **No commit without passing the required tests for that scope.** In the per-ticket workflow, failing tests must exist before code, and the targeted tests for that ticket must pass before that ticket is committed. Run `make test` before end-of-batch handoff or any broader commit. Do not skip or comment out failing tests. For bootstrap work before any tests exist, owner approval is the verification gate.
3. **Tests before code.** Failing tests must exist before production code is written.
4. **No business logic in routers.** Logic and database access belong in `services/`. Routers translate HTTP requests and responses.
5. **No hardcoded config.** All env-specific values belong in `.env` and must be read through one shared backend settings module.
6. **No schema changes without Alembic.** Run `alembic revision --autogenerate` for schema changes; never use raw SQL DDL as the source of truth.
7. **No `any` in TypeScript. No untyped Python.** `mypy --strict` and `tsc --noEmit` must pass clean.
8. **No `git push` without owner instruction.** Prepare the branch and commit, then stop and report.
9. **No changes outside the current task scope.** If you spot something else to fix, add it to `plans/BACKLOG.md`.
10. **No secrets committed.** `.env`, `data/`, and `*.db` stay ignored. Stop immediately if they are ever staged.
11. **Keep commits small and trackable.** Prefer one logical change per commit, even during early scaffolding.
---
## Quality Gates
These are the target gates once backend and frontend scaffolding exist:

```bash
# Backend
ruff check backend
mypy backend/app --strict
radon cc backend/app -n C
pytest --cov=backend/app --cov-fail-under=80

# Frontend
npx tsc --noEmit --project frontend/tsconfig.json
npx eslint frontend/src
npm --prefix frontend run test -- --coverage  # >= 70%
```

Once `frontend/` exists, `make lint` and `make test` must run both backend and
frontend quality gates. PR checks must run backend commands through `make` or
from `backend/` so `backend/pyproject.toml` is loaded.

`make lint` and `make test` should wrap the canonical commands once the repo bootstrap is in place.
---
## Current Sprint —
**Goal:** Frontend completion — port the 3 remaining screens (NewActivitySheet, GoalsScreen, SettingsScreen) from JSX prototypes to TypeScript and wire to the existing API.
**Status (2026-05-30):** Phase 0–6 complete and merged to `main`; Phase 7 tickets being planned.
**Branch:** `feat/phase-7-frontend-completion`
**Ticket source:** `plans/tickets-phase-7-frontend-completion-2026-05-30.md`
**Primary references:** `plans/TRD.md` §Phase 7, `plans/PRD.md`, `MOCKUPS.md` §Screens 4/5/5b/6b, `export/preview/*.jsx`, `frontend/src/hooks/useMilestoneEngine.ts`, `docs/api-map.md`
**Deferred-item routing (owner 2026-05-30):** `CalendarHeatmap` block-review → Phase 7.5; `recovery_streaks` UI, delayed-tax panel, dynamic load-graph title → Phase 8.
**Out of scope:** CalendarHeatmap / block-review grid (Phase 7.5), recovery-streaks + delayed-tax + load-graph-title dashboard surfacing (Phase 8), loading/error polish + review milestone + MCP stub (Phase 8), auth, multi-user support

---
## Definition of Done
1. Acceptance criteria tests pass for the scoped work
2. Required quality gates pass for the scoped work
3. Owner has reviewed the summary
4. Owner, not the agent, decides when to merge to `main`
