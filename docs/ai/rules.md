# Hooks And Rules

This file is the canonical shared definition for the repo's AI workflow rules.

Use it to keep:
- repo policy in `AGENTS.md`
- role prompts in `agents/*.md`
- shared skills in `docs/ai/skills/*.md`
- and tool entrypoints such as `CLAUDE.md`

aligned without copying the same workflow logic into multiple files.

## Terms

- `Rule`: a named policy or checklist that defines what an agent must check
- `Hook`: a trigger point that invokes one or more rules

Rules are the reusable units. Hooks are the moments where they should fire.

## Source Of Truth

- Repo policy and quality gates: `AGENTS.md`
- Role workflows: `agents/*.md`
- Shared decision logic: `docs/ai/skills/*.md`
- Shared hooks and rules: `docs/ai/rules.md`
- Product and system design: `README.md`, `DESIGN.md`, `MOCKUPS.md`, `plans/milestone-architecture.md`
- Living implementation references: `docs/architecture.md`, `docs/patterns.md`, `docs/api-map.md`, `docs/database-schema.md`

## Hook Map

| Hook | When it fires | Rules invoked |
| --- | --- | --- |
| `before-non-trivial-work` | Before planning, implementation, testing, review, or verification begins | `start-work-context` |
| `before-schema-change` | Before editing models, migrations, persisted DTOs, or schema-shaping services | `schema-change-check` |
| `before-api-change` | Before adding or changing endpoints, params, or request/response shapes | `api-contract-check` |
| `before-backend-boundary-change` | Before adding business rules, moving backend logic, or introducing a new backend module | `backend-boundary-check` |
| `before-frontend-boundary-change` | Before introducing shared state, extracting components, or reshaping server data | `frontend-boundary-check` |
| `before-test-design` | Before writing tests or choosing verification scope for a behavior change | `test-strategy-check` |
| `after-contract-or-schema-change` | After approved API or schema changes land | `docs-sync-check` |
| `before-commit` | Before any commit | `pre-commit-verification` |
| `on-critical-area-touch` | When touching schema, migrations, core load calculations, destructive data operations, or future auth or sync flows | `critical-area-escalation` |

## Rules

### `start-work-context`

Purpose:
- Ensure work starts from the repo rules and the correct Milestone docs instead of guesswork

Trigger:
- Before any non-trivial task

Required checks:
1. Read `AGENTS.md`.
2. Identify whether the task is planning, implementation, testing, review, or verification.
3. Open the relevant role prompt in `agents/` if the role workflow applies.
4. Check `docs/ai/skills/index.md` for the relevant shared skills.
5. Identify which design docs, architecture docs, and tests are in scope.

Suggested supporting docs:
- `AGENTS.md`
- `docs/ai/README.md`
- `docs/ai/skills/index.md`
- relevant `agents/*.md`

### `schema-change-check`

Purpose:
- Prevent ad hoc data-model changes and force explicit schema reasoning

Trigger:
- Before editing models, migrations, persisted DTOs, schema-related services, or API shapes that imply persisted data changes

Required checks:
1. Use `schema-decision`.
2. Confirm whether the schema change is already approved.
3. Identify all required update points: migration, model, API, tests, and docs.
4. Confirm the change follows the services-first backend model.

Suggested supporting docs:
- `AGENTS.md`
- `docs/ai/skills/schema-decision.md`
- `docs/database-schema.md`
- `plans/milestone-architecture.md`

### `api-contract-check`

Purpose:
- Keep API changes coherent and prevent overloaded or inconsistent contracts

Trigger:
- Before adding or changing endpoints, route params, query params, request bodies, response shapes, or domain actions

Required checks:
1. Use `api-contract-decision`.
2. Confirm whether approval is required.
3. Check whether an existing endpoint already fits.
4. Identify contract docs and tests that must change.

Suggested supporting docs:
- `AGENTS.md`
- `docs/ai/skills/api-contract-decision.md`
- `docs/api-map.md`
- `plans/milestone-architecture.md`

### `backend-boundary-check`

Purpose:
- Keep backend logic aligned with the repo's services-first architecture

Trigger:
- Before adding business rules, moving backend logic, creating helpers, or introducing a new backend module or abstraction

Required checks:
1. Confirm routers stay thin.
2. Confirm business rules and ordinary database access live in `services/`.
3. Use `backend-boundary-decision` when placement is unclear.
4. Escalate if a repository or data-access layer seems necessary.

Suggested supporting docs:
- `AGENTS.md`
- `docs/ai/skills/backend-boundary-decision.md`
- `docs/architecture.md`
- `plans/milestone-architecture.md`

### `frontend-boundary-check`

Purpose:
- Avoid accidental state sprawl, duplicate server-state shaping, and component-boundary drift

Trigger:
- Before introducing shared state, extracting components, moving data transformations, or reshaping server-backed data

Required checks:
1. Use `frontend-state-decision` when state ownership is changing.
2. Use `frontend-data-flow-check` when server data is being reshaped or duplicated.
3. Use `component-boundary-decision` when extraction or reuse is changing.
4. Use `large-component-refactor` when breaking apart a large frontend file.

Suggested supporting docs:
- `docs/ai/skills/frontend-state-decision.md`
- `docs/ai/skills/frontend-data-flow-check.md`
- `docs/ai/skills/component-boundary-decision.md`
- `docs/ai/skills/large-component-refactor.md`

### `test-strategy-check`

Purpose:
- Match verification strength to change risk without inflating test cost or missing regressions

Trigger:
- Before writing tests and before implementing behavior changes that need verification

Required checks:
1. Use `test-strategy-decision`.
2. Pick the lowest effective test layer.
3. Identify what should not be over-mocked.
4. Call out any manual verification that remains.

Suggested supporting docs:
- `docs/ai/skills/test-strategy-decision.md`
- `docs/patterns.md`
- relevant nearby tests

### `docs-sync-check`

Purpose:
- Keep API and schema docs accurate when the underlying contract changes

Trigger:
- After approved API or schema changes are made

Required checks:
1. Update `docs/api-map.md` when API routes, params, or contract shapes changed.
2. Update `docs/database-schema.md` when persisted data structures changed.
3. Mention explicitly when no doc update is required and why.

Suggested supporting docs:
- `docs/api-map.md`
- `docs/database-schema.md`
- relevant changed files

### `pre-commit-verification`

Purpose:
- Keep commit quality aligned with the agreed workflow

Trigger:
- Before any commit

Required checks:
1. Follow `AGENTS.md` as the canonical policy.
2. In the per-ticket workflow, confirm failing tests existed before code.
3. Confirm the targeted tests for that ticket now pass before the ticket commit.
4. Before end-of-batch handoff or broader commits, run `make lint` and `make test`.
5. Do not skip or comment out failing tests.

Suggested supporting docs:
- `AGENTS.md`
- `agents/orchestrator.md`
- `agents/pr-checker.md`

### `critical-area-escalation`

Purpose:
- Slow down changes in areas where mistakes are disproportionately expensive

Trigger:
- When touching schema, migrations, core load calculations, destructive data operations, or future auth or sync flows

Required checks:
1. Confirm explicit owner approval where required.
2. Confirm the relevant architecture or contract skills were used.
3. Require non-author review before merge readiness.
4. Call out residual risk clearly.

Suggested supporting docs:
- `AGENTS.md`
- relevant shared skills
- relevant role prompts

## Environment Mapping

- `AGENTS.md` is the repo-wide policy entrypoint.
- `CLAUDE.md` is the current Claude Code entrypoint.
- Cursor should read `AGENTS.md` and the relevant docs directly until `.cursor/` wrappers exist.
- If future `.claude/skills/` or `.cursor/rules/` files are added, keep them as thin pointers back to this file instead of new sources of truth.

## Maintenance Rules

- Update the shared file first and any tool entrypoints second.
- Do not add tool-specific rule content that is more detailed than this canonical doc.
- If a rule needs deeper decision logic, keep the rule here and move the decision detail into a skill doc.
- This repo does not currently ship Claude or Cursor wrapper inventories, git hooks, or rule scripts. Add them only if the owner wants automation, and record that work in `plans/BACKLOG.md` first.
