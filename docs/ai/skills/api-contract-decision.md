---
name: api-contract-decision
summary: Decide whether to extend an existing API contract or create a new one.
triggers:
  - add endpoint
  - change route shape
  - change request body
  - change response shape
  - add filtering
  - add pagination
roles:
  - architect
  - planner
  - implementer
  - reviewer
read_first:
  - AGENTS.md
  - docs/architecture.md
  - docs/api-map.md
approval_required_if:
  - API contract changes
related_skills:
  - backend-boundary-decision
  - schema-decision
canonical: true
---

# API Contract Decision

Use when:
- adding or changing endpoints,
- deciding whether to extend an existing route or create a new one,
- changing request or response shapes,
- adding filtering, sorting, pagination, or domain actions.

Goal:
Choose the API shape that best fits the domain, existing contracts, and long-term maintainability.

Core rules:
- Reuse an existing endpoint when the resource and contract still fit clearly.
- Add a new endpoint when forcing the change into an existing one would make the contract unclear or overloaded.
- Use nouns for resources, not verbs.
- Prefer query parameters for filtering, sorting, and pagination.
- Use `GET` for retrieval, `POST` for creation, `PATCH` for partial update, `PUT` for full replacement, and `DELETE` for deletion.
- Keep request and response shapes consistent with similar endpoints.
- Avoid both endpoint sprawl and overloaded “do everything” routes.

Checks:
- Does this fit an existing resource cleanly?
- Is this a standard resource operation or a distinct domain action?
- Would this confuse existing consumers?
- Is there already a nearby endpoint with the same concept under a different name?

Output:
1. Recommended endpoint or contract change.
2. Why it fits.
3. Why alternatives are worse.
4. Whether approval is required.
5. Which files must change.
