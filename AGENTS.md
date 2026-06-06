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
## Current Sprint — Stage 2.5: Usage logic & block clarity (active)
**Goal:** Close the gap between stored block rules, goals, and logs and daily-use behaviour: activity-linked goals with auto-progress, retroactive log dates, class/exercise caps in Edit Rules, smarter suggestion buckets, and cap-driven load risk.
**Status (2026-06-06):** **Stage 2.5 implementation complete** on `feat/stage-2-5-usage-logic` (S25.B1–S25.D1). Pending **O25.1** owner smoke before merge to `main`.
**Production (live):** App `https://milestone-activity.netlify.app` · API `https://milestone-training-log.onrender.com` · DB Supabase Postgres (session pooler). Runbook: `docs/deploy.md`.
**Deploy branch:** `main` (Render + Netlify auto-deploy from GitHub).
**Ticket source:** `plans/tickets-stage-2-5-usage-logic-2026-06-06.md` (S25.B1–S25.D1 required; **O25.1** owner smoke)
**Planning:** `plans/feature-brief-stage-2-5-usage-logic-2026-06-06.md`, `plans/technical-design-stage-2-5-usage-logic-2026-06-06.md`
**Primary references:** `DESIGN.md`, `docs/patterns.md`, `docs/api-map.md`, `docs/database-schema.md`

**Archive:** Stage 2 polish in `plans/tickets-stage-2-polish-2026-06-05.md` · Phase 0–10 in `plans/archive/phase-0-10/` · Phase 11 in `plans/tickets-phase-11-production-2026-06-04.md`

---
## Definition of Done
1. Acceptance criteria tests pass for the scoped work
2. Required quality gates pass for the scoped work
3. Owner has reviewed the summary
4. Owner, not the agent, decides when to merge to `main`
