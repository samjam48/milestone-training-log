# Agent Prompts

Project-specific role prompts live in this directory.

Start with `AGENTS.md` for repo-wide rules.
Shared skill discovery lives in `docs/ai/skills/index.md`.
Shared hooks and rules live in `docs/ai/rules.md`.

For a major feature or full phase build, use `orchestrator.md` as the workflow controller.
Run one role at a time and one ticket at a time. Do not parallelize the flow.

## Claude Code Subagent Registration

Registered Claude Code subagents live in `.claude/agents/`. Each file contains YAML frontmatter (name, description, tools, model, color) followed by a concise system prompt that points back to the full role doc here.

Invoke them with `@agent-name` in Claude Code (e.g. `@orchestrator`, `@test-writer`). The orchestrator uses the `Agent` tool to spawn the other roles automatically — no human relay needed between pipeline steps.

Role prompts:

- `orchestrator.md` controls the gated sequence: planning once per feature, then per-ticket Test Writer -> Implementer -> Reviewer -> commit, followed by developer verification and PR Checker.
- `architect.md` shapes a feature before tickets exist.
- `planner.md` turns approved feature scope into detailed tickets.
- `test-writer.md` converts approved acceptance criteria into failing tests only.
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
