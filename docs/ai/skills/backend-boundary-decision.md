---
name: backend-boundary-decision
summary: Decide where backend logic should live in the repo's services-first architecture.
triggers:
  - add business rule
  - move backend logic
  - add backend helper
  - split overloaded service
  - consider repository layer
roles:
  - architect
  - implementer
  - reviewer
read_first:
  - AGENTS.md
  - docs/architecture.md
  - docs/V1-TRD.md
approval_required_if:
  - new repository or data-access layer
  - cross-cutting backend abstraction changes
related_skills:
  - api-contract-decision
  - schema-decision
canonical: true
---

# Backend Boundary Decision

Use when:
- deciding where backend logic should live,
- adding new business rules or orchestration,
- deciding route versus service versus helper,
- considering whether a repository or data-access module is justified,
- noticing logic spread across layers.

Goal:
Place backend logic in the layer where it belongs so the code stays coherent, testable, and easy to extend.

Core rules:
- Keep routers thin and focused on transport concerns.
- Put business rules, orchestration, and normal database access in `services/`.
- Use helpers only for reusable logic that is not itself domain orchestration.
- Do not smear logic across layers with unclear ownership.
- Do not introduce unnecessary service-layer ceremony for trivial one-step CRUD.
- Repository or data-access modules are allowed later only when explicitly justified and approved, not by default.

Checks:
- Is this HTTP transport handling, business logic, data access, or pure utility logic?
- Should this stay inside an existing service?
- Would a helper clarify reuse without obscuring ownership?
- Is a new repository or data-access layer truly justified by repeated complex access patterns or cross-service reuse?

Output:
1. Recommended layer or boundary.
2. Why it belongs there.
3. Why alternatives are worse.
4. Whether a new abstraction is justified.
5. Which files or modules should change.
