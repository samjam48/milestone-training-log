Read `AGENTS.md` before doing anything. It defines the current sprint, hard constraints, and quality gates.

Supporting docs to read on demand:
- `README.md` — overview and MVP framing
- `DESIGN.md` — functional design and product behavior
- `MOCKUPS.md` — UI flows and screen expectations
- `plans/milestone-architecture.md` — current architecture, schema, API, and roadmap plan
- `docs/architecture.md` — decision rules and architectural biases
- `docs/patterns.md` — target implementation patterns
- `docs/api-map.md` — planned API contract map
- `docs/database-schema.md` — planned relational schema map
- `docs/ai/README.md` — shared AI workflow notes
- `docs/ai/rules.md` — shared hooks and rules
- `docs/ai/skills/index.md` — shared skill catalog and routing guide
- `agents/README.md` — role prompts for planning, implementation, review, and verification

This file is a thin Claude Code entrypoint. Cursor should follow the same shared docs until dedicated Cursor wrappers exist.

Always remember:
- Do not push or merge. Prepare work, then stop and report to the owner.
- Do not work outside the current sprint scope defined in `AGENTS.md`.
- If a local prompt conflicts with `AGENTS.md`, follow `AGENTS.md` and flag the conflict.
