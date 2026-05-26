# Skills Index

Shared canonical skills live in this directory. Use them from any tool instead of copying rules into multiple places.

For shared trigger points and workflow checks, see `docs/ai/rules.md`.

## How To Use This Index

1. Start with `AGENTS.md`.
2. If the task maps to a role in `agents/`, open that prompt next.
3. Pick the skill whose trigger best matches the decision you are making.
4. Read only the listed supporting docs you actually need.

## Skills

| Skill | Purpose | Common triggers | Roles | Read first | Tool adapters |
| --- | --- | --- | --- | --- | --- |
| `api-contract-decision` | Decide whether to extend an existing API contract or create a new one | add endpoint, change request body, change response shape, add pagination | architect, planner, implementer, reviewer | `AGENTS.md`, `docs/architecture.md`, `docs/api-map.md` | `.claude/skills/api-contract-decision/SKILL.md`, `.cursor/rules/api-contract-decision.mdc` |
| `backend-boundary-decision` | Keep backend logic aligned with the repo's services-first architecture | add business rule, move backend logic, consider repository layer | architect, implementer, reviewer | `AGENTS.md`, `docs/architecture.md`, `docs/V1-TRD.md` | `.claude/skills/backend-boundary-decision/SKILL.md`, `.cursor/rules/backend-boundary-decision.mdc` |
| `component-boundary-decision` | Choose inline, page-local, shared, or design-system component boundaries | extract component, add variant, shared UI pattern | architect, planner, implementer, reviewer | `AGENTS.md`, `docs/architecture.md`, `docs/patterns.md` | `.claude/skills/component-boundary-decision/SKILL.md`, `.cursor/rules/component-boundary-decision.mdc` |
| `frontend-data-flow-check` | Keep fetching, transformation, caching, and presentation boundaries coherent | reshape server data, duplicate API state, mixed query and presentation logic | architect, planner, implementer, reviewer | `AGENTS.md`, `docs/architecture.md`, `docs/V1-TRD.md` | `.claude/skills/frontend-data-flow-check/SKILL.md`, `.cursor/rules/frontend-data-flow-check.mdc` |
| `frontend-state-decision` | Choose the smallest coherent frontend state owner | add UI state, lift state, shared store, context decision | architect, planner, implementer, reviewer | `AGENTS.md`, `docs/architecture.md`, `docs/V1-TRD.md` | `.claude/skills/frontend-state-decision/SKILL.md`, `.cursor/rules/frontend-state-decision.mdc` |
| `large-component-refactor` | Break a large frontend file into smaller coherent parts without changing intended behavior | monolith component, app file split, structural frontend refactor | architect, implementer, reviewer | `AGENTS.md`, `docs/architecture.md`, `docs/patterns.md` | `.claude/skills/large-component-refactor/SKILL.md`, `.cursor/rules/large-component-refactor.mdc` |
| `schema-decision` | Choose the right persisted data structure | add persisted field, table versus column, join table, JSON | architect, planner, implementer, reviewer | `AGENTS.md`, `docs/architecture.md`, `docs/database-schema.md` | `.claude/skills/schema-decision/SKILL.md`, `.cursor/rules/schema-decision.mdc` |
| `test-strategy-decision` | Choose the smallest effective test strategy for the risk | add tests, choose unit versus integration, identify manual verification | planner, test-writer, implementer, reviewer | `AGENTS.md`, `docs/patterns.md`, `docs/architecture.md` | `.claude/skills/test-strategy-decision/SKILL.md`, `.cursor/rules/test-strategy-decision.mdc` |

## Role Shortcuts

- `architect.md`: API, schema, state, data flow, component boundaries, large component refactors
- `planner.md`: API, schema, test strategy, frontend boundary decisions
- `test-writer.md`: test strategy first, then API or schema only when the acceptance criteria depend on them
- `implementer.md`: backend boundary, API, schema, state, data flow, component boundaries, large component refactors
- `reviewer.md`: all of the above, plus test strategy when coverage quality is part of the review
