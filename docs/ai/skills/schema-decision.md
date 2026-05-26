---
name: schema-decision
summary: Choose the persisted data shape that best fits query patterns, lifecycle, and constraints.
triggers:
  - add persisted field
  - change table shape
  - choose column versus table
  - choose join table
  - choose JSON
roles:
  - architect
  - planner
  - implementer
  - reviewer
read_first:
  - AGENTS.md
  - docs/architecture.md
  - docs/database-schema.md
approval_required_if:
  - schema changes
  - migration changes
related_skills:
  - api-contract-decision
  - backend-boundary-decision
canonical: true
---

# Schema Decision

Use this skill before proposing or implementing any non-trivial database shape change.

Read first:
- `AGENTS.md`
- `docs/patterns.md`
- `docs/database-schema.md`
- relevant models, migrations, services, and API handlers

Goal:
Choose the database shape that best fits query patterns, constraints, lifecycle, and long-term maintainability.
Do not default toward either "always add a new table" or "always extend the existing one".

## Decision process

1. Identify what kind of data this is:
- scalar attribute on an existing entity,
- repeated child record,
- many-to-many relationship,
- semi-structured metadata,
- external/raw payload.

2. Ask these questions:
- Will this data be filtered, sorted, or queried independently?
- Will it be joined to other entities?
- Does it have its own lifecycle, such as separate creation, editing, deletion, or status changes?
- Can multiple records exist per parent?
- Does it need constraints, indexes, or reporting?
- Is it core business data or incidental metadata?

3. Choose the structure:
- Existing or new column when the data is truly an attribute of the same entity.
- Child table when the data is a repeated record or needs independent querying, lifecycle, joins, or reporting.
- Join table for many-to-many relationships.
- JSON/JSONB only for metadata, config blobs, external payloads, or semi-structured data that is not a core relational entity.

## Bias checks

Avoid both failure modes:
- unnecessary new tables that fragment the model,
- stuffing relational child entities into arrays or JSON to avoid migrations.

Do not avoid a new table merely to reduce implementation effort.
Do not create a new table merely because a field group looks large.

## Output format

Before implementation, state briefly:
1. Recommended structure.
2. Why it fits the query and lifecycle needs.
3. Why the main alternatives are worse.
4. Whether schema approval is required.
5. Which files must be updated: migration, model, API, database-schema.md, tests.

## Example heuristic

- `developer.name` -> column.
- multiple interviews per developer with date, notes, recruiter, outcome, and job link -> child table.
- developers linked to many jobs and jobs linked to many developers -> join table.
- raw webhook payload from third-party service -> JSON/JSONB.
