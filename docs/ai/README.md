# AI Guidance

Repo-wide rules still start in `AGENTS.md`.

Use the files here to keep role prompts, shared skills, and tool entrypoints aligned:
- `docs/ai/rules.md` is the shared hook and rule definition
- `docs/ai/skills/index.md` is the shared skill catalog and routing guide
- `docs/ai/skills/*.md` are the canonical skill bodies
- `CLAUDE.md` is the current Claude Code entrypoint

Cursor should read the same shared docs directly until dedicated Cursor wrapper files are added.

## Start-Work Checklist

For any non-trivial task:
1. Read `AGENTS.md`.
2. Identify whether the task is planning, implementation, testing, review, or verification.
3. Open the relevant role prompt in `agents/` if using the role workflow.
4. Check `docs/ai/rules.md` for the relevant hooks and rules.
5. Check `docs/ai/skills/index.md` for matching skills.
6. Read only the project docs needed for the affected area.

## Source Of Truth

- Repo policy and quality gates: `AGENTS.md`
- Role prompts: `agents/*.md`
- Shared hooks and rules: `docs/ai/rules.md`
- Cross-cutting architecture and implementation conventions: `docs/architecture.md`, `docs/patterns.md`
- Planned contracts: `docs/api-map.md`, `docs/database-schema.md`
- Product and system design: `README.md`, `DESIGN.md`, `MOCKUPS.md`, `plans/milestone-architecture.md`
- Shared decision skills: `docs/ai/skills/*.md`
- Tool entrypoints: `CLAUDE.md`
