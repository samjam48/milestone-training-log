# Agent Prompts

Project-specific agent prompts live in this directory.

Start with `AGENTS.md` for repo-wide rules.
Shared skill discovery lives in `docs/ai/skills/index.md`.
Shared hooks and rules live in `docs/ai/rules.md`.

For a **major feature or full phase build**, use `orchestrator.md` as the single entry point. It delegates to the specialized agents below one at a time and does not parallelize work.

Specialized agents (invoked by the orchestrator, not run in parallel):

- `orchestrator.md` controls gated, sequential flow: planning once per feature (Architect → Planner), then per-ticket Test Writer → Implementer → Reviewer → commit, then developer verification and PR Checker.
- `architect.md` runs **once per major feature** — shapes PRD, TRD, and ADR outputs and confirms UX/DB detail with the owner.
- `planner.md` runs **once per major feature** — produces the full detailed ticket file.
- `test-writer.md` turns approved ticket acceptance criteria into failing tests only.
- `implementer.md` writes the minimum production changes needed to satisfy failing tests.
- `reviewer.md` reviews the branch diff for code quality, architecture, and convention issues.
- `pr-checker.md` runs the full quality gate sequence and reports pass or fail without fixing.

## Role To Skill Routing

| Role | Use these skills when relevant |
| --- | --- |
| `architect.md` | `api-contract-decision`, `schema-decision`, `component-boundary-decision`, `frontend-state-decision`, `frontend-data-flow-check`, `backend-boundary-decision`, `large-component-refactor` |
| `planner.md` | `api-contract-decision`, `schema-decision`, `test-strategy-decision`, `component-boundary-decision`, `frontend-state-decision`, `frontend-data-flow-check` |
| `test-writer.md` | `test-strategy-decision`, `api-contract-decision`, `schema-decision` |
| `implementer.md` | `backend-boundary-decision`, `api-contract-decision`, `schema-decision`, `component-boundary-decision`, `frontend-state-decision`, `frontend-data-flow-check`, `large-component-refactor` |
| `reviewer.md` | `backend-boundary-decision`, `api-contract-decision`, `schema-decision`, `component-boundary-decision`, `frontend-state-decision`, `frontend-data-flow-check`, `test-strategy-decision`, `large-component-refactor` |
