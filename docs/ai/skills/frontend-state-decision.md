---
name: frontend-state-decision
summary: Decide the smallest coherent ownership boundary for frontend state.
triggers:
  - add UI state
  - lift state
  - shared store
  - context decision
  - server versus client state
roles:
  - architect
  - planner
  - implementer
  - reviewer
read_first:
  - AGENTS.md
  - docs/architecture.md
  - docs/V1-TRD.md
approval_required_if:
  - new shared state model
related_skills:
  - frontend-data-flow-check
  - component-boundary-decision
canonical: true
---

# Frontend State Decision

Use when:
- adding new frontend state,
- moving state between components,
- deciding between local, lifted, shared, or server-owned state,
- introducing or reshaping context or store usage.

Goal:
Choose the smallest coherent ownership boundary for state.

Core rules:
- Keep state local when only one component or one bounded interaction needs it.
- Lift state when multiple nearby components coordinate on the same value or workflow.
- Use shared state only when coordination crosses component boundaries enough that local lifting becomes awkward or duplicated.
- Server data belongs in the data or query layer, not duplicated ad hoc in component state.
- Do not duplicate a source of truth.
- Prefer derived state over copied state.

Checks:
- Who owns this state?
- Who reads it?
- Who writes it?
- Can two copies drift out of sync?
- Is this UI state, server state, or derived state?

Output:
1. Recommended owner of the state.
2. Why local / lifted / shared / server-owned is correct.
3. Risks of rejected options.
4. Whether approval is needed for broader shared-state changes.
