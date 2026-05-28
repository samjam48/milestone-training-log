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
**Goal:** Frontend scaffold + API integration — Vite app wired to backend via typed client and React Query.
**Status (2026-05-28):** Phase 0–5 complete on `main`; Phase 6 tickets signed off; implementation not started.
**Branch:** `feat/phase-6-frontend`
**Ticket source:** `plans/tickets-phase-6-frontend-2026-05-28.md`
**Primary references:** `plans/TRD.md`, `plans/PRD.md`, `DESIGN.md`, `docs/api-map.md`, `export/src/hooks/useMilestoneEngine.ts`, `GET /api/dashboard`
**Out of scope:** Goals/Settings/NewActivity screens (Phase 7), loading/error polish + review milestone + MCP stub (Phase 8), auth, multi-user support

---
## Definition of Done
1. Acceptance criteria tests pass for the scoped work
2. Required quality gates pass for the scoped work
3. Owner has reviewed the summary
4. Owner, not the agent, decides when to merge to `main`
