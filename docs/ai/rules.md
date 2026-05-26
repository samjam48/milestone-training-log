# Hooks And Rules

This file is the canonical shared definition for the repo's AI hooks and rules.

Use it to keep:
- repo policy in `AGENTS.md`,
- role prompts in `agents/*.md`,
- shared skills in `docs/ai/skills/*.md`,
- and tool-specific adapters in `.claude/skills/*` and `.cursor/rules/*`

aligned without duplicating the same workflow logic in multiple places.

## Terms

- `Rule`: a named policy or checklist that defines what an agent must check.
- `Hook`: a trigger point that invokes one or more rules.

In this repo, rules are the canonical reusable units. Hooks are the moments in workflow where those rules should fire.

## First-Pass Scope

This pass is intentionally lightweight:
- `docs/ai/rules.md` is the single shared source of truth.
- Tool-specific files are thin adapters that point back here.
- The current implementation is soft enforcement plus lightweight repo scripts, not full CI-grade automation.
- Harder automation can be added later for the highest-value checks.

## Source Of Truth

- Repo policy and quality gates: `AGENTS.md`
- Role workflows: `agents/*.md`
- Shared decision logic: `docs/ai/skills/*.md`
- Shared hooks and rules: `docs/ai/rules.md`
- Tool-specific adapters: `CLAUDE.md`, `CODEX.md`, `.claude/skills/*`, `.cursor/rules/*`

## Hook Map

| Hook | When it fires | Rules invoked | First-pass status |
| --- | --- | --- | --- |
| `before-non-trivial-work` | Before planning, implementation, testing, review, or verification work begins | `start-work-context` | Shared doc plus tool adapters |
| `before-schema-change` | Before editing models, migrations, persisted DTOs, or schema-shaping services | `schema-change-check` | Shared doc plus tool adapters |
| `before-api-change` | Before adding or changing endpoints, params, or request/response shapes | `api-contract-check` | Shared doc plus tool adapters |
| `before-backend-boundary-change` | Before adding business rules, moving backend logic, or introducing a new backend module | `backend-boundary-check` | Shared doc plus tool adapters |
| `before-frontend-boundary-change` | Before introducing shared state, extracting components, or reshaping server data | `frontend-boundary-check` | Shared doc plus tool adapters |
| `before-test-design` | Before writing tests or choosing verification scope for a behavior change | `test-strategy-check` | Shared doc plus tool adapters |
| `after-contract-or-schema-change` | After approved API or schema changes land | `docs-sync-check` | Shared doc plus tool adapters |
| `before-commit` | Before any commit | `pre-commit-verification` | Shared doc plus tool adapters |
| `on-critical-area-touch` | When touching auth, billing, permissions, schema, migrations, or production-critical flows | `critical-area-escalation` | Shared doc plus tool adapters |

## Rules

### `start-work-context`

Purpose:
- Ensure agents start from repo rules and the correct guidance instead of jumping straight into edits.

Trigger:
- Before any non-trivial task.

Required checks:
1. Read `AGENTS.md`.
2. Identify whether the task is planning, implementation, testing, review, or verification.
3. Open the relevant role prompt in `agents/` if the role workflow applies.
4. Check `docs/ai/skills/index.md` for the relevant shared skills.
5. Identify which repo docs and tests are in scope.

Suggested supporting docs:
- `AGENTS.md`
- `docs/ai/README.md`
- `docs/ai/skills/index.md`
- relevant `agents/*.md`

Future hard automation:
- Low value for strict automation. Keep as a soft workflow rule.

### `schema-change-check`

Purpose:
- Prevent ad hoc data-model changes and force explicit schema reasoning.

Trigger:
- Before editing models, migrations, persisted DTOs, schema-related services, or API shapes that imply persisted data changes.

Required checks:
1. Use `schema-decision`.
2. Confirm whether the schema change is already approved.
3. Identify all required update points: migration, model, API, tests, and docs.
4. Confirm the change follows the services-first backend model.

Suggested supporting docs:
- `AGENTS.md`
- `docs/ai/skills/schema-decision.md`
- `docs/database-schema.md`
- `docs/V1-TRD.md`

Future hard automation:
- Medium value. Could later be reinforced with migration presence checks or model/migration diff heuristics.

### `api-contract-check`

Purpose:
- Keep API changes coherent and prevent overloaded or inconsistent contracts.

Trigger:
- Before adding or changing endpoints, route params, query params, request bodies, response shapes, or domain actions.

Required checks:
1. Use `api-contract-decision`.
2. Confirm whether approval is required.
3. Check whether an existing endpoint already fits.
4. Identify contract docs and tests that must change.

Suggested supporting docs:
- `AGENTS.md`
- `docs/ai/skills/api-contract-decision.md`
- `docs/api-map.md`
- `docs/V1-TRD.md`

Future hard automation:
- Medium value. Could later be reinforced by API contract tests or route-change review gates.

### `backend-boundary-check`

Purpose:
- Keep backend logic aligned with the repo's services-first architecture.

Trigger:
- Before adding business rules, moving backend logic, creating helpers, or introducing a new backend module or abstraction.

Required checks:
1. Confirm routers stay thin.
2. Confirm business rules and ordinary DB access live in `services/`.
3. Use `backend-boundary-decision` when placement is unclear.
4. Escalate if a repository or data-access layer seems necessary.

Suggested supporting docs:
- `AGENTS.md`
- `docs/ai/skills/backend-boundary-decision.md`
- `docs/architecture.md`
- `docs/V1-TRD.md`

Future hard automation:
- Low-to-medium value. Mostly review-enforced rather than mechanically enforceable.

### `frontend-boundary-check`

Purpose:
- Avoid accidental state sprawl, duplicate server-state shaping, and component-boundary drift.

Trigger:
- Before introducing shared state, extracting components, moving data transformations, or reshaping server-backed data.

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

Future hard automation:
- Low value for strict automation. Best kept as a guided review and workflow rule.

### `test-strategy-check`

Purpose:
- Match verification strength to change risk without inflating test cost or missing regressions.

Trigger:
- Before writing tests and before implementing behavior changes that need verification.

Required checks:
1. Use `test-strategy-decision`.
2. Pick the lowest effective test layer.
3. Identify what should not be over-mocked.
4. Call out any manual verification that remains.

Suggested supporting docs:
- `docs/ai/skills/test-strategy-decision.md`
- `docs/patterns.md`
- relevant nearby tests

Future hard automation:
- Low value for strict automation. Best supported by prompt routing and review.

### `docs-sync-check`

Purpose:
- Keep API and schema docs accurate when the underlying contract changes.

Trigger:
- After approved API or schema changes are made.

Required checks:
1. Update `docs/api-map.md` when API routes, params, or contract shapes changed.
2. Update `docs/database-schema.md` when persisted data structures changed.
3. Mention explicitly when no doc update is required and why.

Suggested supporting docs:
- `docs/api-map.md`
- `docs/database-schema.md`
- relevant changed files

Future hard automation:
- Medium value. Could later be reinforced by change detectors that flag route or model changes without matching doc updates.

Current lightweight enforcement:
- `scripts/docs-sync-check.sh --staged`

### `pre-commit-verification`

Purpose:
- Keep commit quality aligned with the agreed workflow.

Trigger:
- Before any commit.

Required checks:
1. Follow `AGENTS.md` as the canonical policy.
2. In the per-ticket orchestrator flow, confirm failing tests existed before code.
3. Confirm the targeted tests for that ticket now pass before the ticket commit.
4. Before end-of-batch handoff or broader commits, run `make lint` and `make test`.
5. Do not skip or comment out failing tests.

Suggested supporting docs:
- `AGENTS.md`
- `agents/orchestrator.md`
- `agents/pr-checker.md`

Future hard automation:
- High value. Candidate for later pre-commit helpers, CI gates, or review tooling.

Current lightweight enforcement:
- `scripts/pre-commit-verification.sh --mode ticket --test-command "<cmd>"`
- `scripts/pre-commit-verification.sh --mode full`
- `.githooks/pre-commit` after running `scripts/install-git-hooks.sh`

### `critical-area-escalation`

Purpose:
- Slow down changes in areas where mistakes are disproportionately expensive.

Trigger:
- When touching auth, billing, permissions, database schema, migrations, or production-critical flows.

Required checks:
1. Confirm explicit owner approval where required.
2. Confirm the relevant architecture or contract skills were used.
3. Require non-author review before merge readiness.
4. Call out residual risk clearly.

Suggested supporting docs:
- `AGENTS.md`
- relevant shared skills
- relevant role prompts

Future hard automation:
- Medium value. Likely best implemented later through file-path-based review warnings rather than hard blocking first.

## Environment Mapping

### Shared

- Canonical definition: `docs/ai/rules.md`
- Shared discovery entrypoints: `docs/ai/README.md`, `AGENTS.md`, `docs/ai/skills/index.md`

### Cursor

- Use thin `.mdc` wrappers in `.cursor/rules/`.
- Each wrapper should point back to `docs/ai/rules.md`.
- These are soft trigger artifacts now, not hard automation.

### Claude

- Use thin `SKILL.md` wrappers in `.claude/skills/`.
- Each wrapper should point back to `docs/ai/rules.md`.
- These are discovery and reminder artifacts, not independent sources of truth.

### Codex

- Use `AGENTS.md`, `CODEX.md`, and `docs/ai/rules.md`.
- There is no repo-native Codex hook mechanism in this pass.
- Keep Codex at pointer-level guidance unless a concrete native mechanism is later adopted.

## Rollout Order

### Phase 1: Shared guidance and wrappers

- Create `docs/ai/rules.md`.
- Link it from `AGENTS.md`, `docs/ai/README.md`, `CLAUDE.md`, `CODEX.md`, and `agents/README.md`.
- Add thin Cursor and Claude wrappers for each named rule.
- Add lightweight scripts for `docs-sync-check` and `pre-commit-verification`.
- Add a repo-local `.githooks/pre-commit` and install helper.

### Phase 2: Prompt integration

- Reference the relevant rules from the role prompts where helpful.
- Reduce duplicate workflow wording that the shared rules doc now owns.

### Phase 3: Hard automation candidates

Highest-value candidates:
1. `pre-commit-verification`
2. `docs-sync-check`
3. `schema-change-check`
4. `api-contract-check`

Lower-value candidates that should likely remain mostly soft:
- `start-work-context`
- `frontend-boundary-check`
- `test-strategy-check`

## Ownership And Maintenance

| Artifact | Owner | Update when |
| --- | --- | --- |
| `AGENTS.md` | Repo workflow owner | Repo policy, commit policy, or quality gates change |
| `docs/ai/rules.md` | AI workflow owner | Hook names, rule definitions, rollout policy, or environment mapping changes |
| `docs/ai/skills/*.md` | AI workflow owner plus area owner | Decision logic or trigger guidance changes |
| `CLAUDE.md`, `CODEX.md` | Tool entrypoint owner | Shared entrypoints or tool usage guidance changes |
| `.claude/skills/*`, `.cursor/rules/*` | AI workflow owner | Canonical doc paths or wrapper inventory changes |
| `agents/*.md` | Role workflow owner | Role responsibilities or routing behavior changes |

Maintenance rules:
- Update the shared file first, adapters second.
- Do not add tool-specific rule content that is more detailed than the canonical shared doc.
- If a rule becomes large enough to need complex logic, keep the rule here and move the decision detail into a skill or supporting doc.

## First-Pass Artifact Inventory

Canonical shared doc:
- `docs/ai/rules.md`

Shared references:
- `AGENTS.md`
- `docs/ai/README.md`
- `CLAUDE.md`
- `CODEX.md`
- `agents/README.md`
- `docs/agent-upgrade-assessment.md`

Thin adapters:
- `.claude/skills/start-work-context/SKILL.md`
- `.claude/skills/schema-change-check/SKILL.md`
- `.claude/skills/api-contract-check/SKILL.md`
- `.claude/skills/backend-boundary-check/SKILL.md`
- `.claude/skills/frontend-boundary-check/SKILL.md`
- `.claude/skills/test-strategy-check/SKILL.md`
- `.claude/skills/docs-sync-check/SKILL.md`
- `.claude/skills/pre-commit-verification/SKILL.md`
- `.claude/skills/critical-area-escalation/SKILL.md`
- `.cursor/rules/start-work-context.mdc`
- `.cursor/rules/schema-change-check.mdc`
- `.cursor/rules/api-contract-check.mdc`
- `.cursor/rules/backend-boundary-check.mdc`
- `.cursor/rules/frontend-boundary-check.mdc`
- `.cursor/rules/test-strategy-check.mdc`
- `.cursor/rules/docs-sync-check.mdc`
- `.cursor/rules/pre-commit-verification.mdc`
- `.cursor/rules/critical-area-escalation.mdc`

Lightweight scripts and hook:
- `scripts/docs-sync-check.sh`
- `scripts/pre-commit-verification.sh`
- `scripts/install-git-hooks.sh`
- `.githooks/pre-commit`
