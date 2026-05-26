**Read this before every session. Keep it short. Update CURRENT SPRINT each phase.**
---
## What This Project Is
A self-hosted personal dashboard (FastAPI + SQLModel + SQLite → React + TypeScript + Tailwind).
Full spec: `/docs/V1-PRD.md` (what/why) and `/docs/V1-TRD.md` (how/schema/stack). Read those when you need depth.
Project-specific role prompts live in `/agents/`. For a major feature or phase build, start with `/agents/orchestrator.md` — one gated agent at a time, no parallel tickets or sub-agents.
AI guidance lives in:
- `agents/README.md` — role prompts and when to use them
- `docs/ai/README.md` — shared AI workflow notes
- `docs/ai/rules.md` — shared hooks and rules
- `docs/ai/skills/index.md` — shared skills catalog and routing guide
---
## Hard Constraints
1. **No commits to &#42;***`main`****.** All work on feature branches: `feat/`, `fix/`, `chore/`.
2. **No commit without passing the required tests for that scope. In the per-ticket orchestrator flow, failing tests must exist before code, and the targeted tests for that ticket must pass before that ticket is committed. Run make test before end-of-batch handoff or any broader commit. Do not skip or comment out failing tests. For repo bootstrap work before any tests exist, owner approval is the required verification gate.**
3. **Tests before code.** Failing tests must exist before any production code is written.
4. **No business logic in routers.** Logic and DB access belong in `services/`. Routers call services and return responses.
5. **No hardcoded config.** All env-specific values in `.env`, read via `backend/app/core/config.py`.
6. **No schema changes without Alembic.** Run `alembic revision --autogenerate` — never raw SQL DDL.
7. **No &#42;***`any`**** in TypeScript. No untyped Python.** `mypy --strict` and `tsc --noEmit` must pass clean.
8. **No &#42;***`git push`**** without owner instruction.** Prepare the branch and commit, then stop and report.
9. **No changes outside current task scope.** If you spot something else to fix, add it to `plans/BACKLOG.md`.
10. **No secrets committed.** `.env`, `data/`, `*.db` are in `.gitignore`. Stop immediately if you accidentally stage them.
11. **Keep commits small and trackable.** Prefer one logical change per commit, even during early scaffolding.
---
## Quality Gates (must all pass before marking a task done)
```javascript
bash# Backend
ruff check .
mypy app --strict
radon cc app -n C          # No function complexity > 10
pytest --cov=app --cov-fail-under=80

# Frontend
npx tsc --noEmit
npx eslint src
npm run test -- --coverage  # ≥ 70%
```
`make lint` and `make test` run these. Use them.
---
## Current Sprint — 
**Goal:** 
**Status (2026-05-18):** 
**Ticket source:** `plans/...` 
**Primary references:** 
**Out of scope:** 

---
## Definition of Done
1. All acceptance criteria tests pass
2. All quality gates pass
3. Owner has reviewed the summary
4. Owner (not the agent) merges to `main`
