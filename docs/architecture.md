# Architecture decisions

These are default biases, not absolutes.
Goal: coherent, testable, evolvable software.

## General
- Make the smallest coherent change, not the smallest possible diff.
- Prefer consistency with existing patterns unless there is a clear reason to improve them.
- Avoid both extremes: unnecessary new abstractions and overloaded existing ones.
- If a decision is cross-cutting or unclear, present options and ask before implementing.

## Scope
- Do not refactor unrelated areas.
- You may adjust adjacent code when required for naming, state, API, or component coherence.
- If the right fix needs broader restructuring, stop and propose it first.
- Do not hide architecture changes inside UI or bugfix tasks.

## Reuse
- Reuse existing code when semantics, interaction pattern, and data shape are genuinely similar.
- Create something new when reuse would cause awkward branching, misleading names, or unclear ownership.
- Before creating something new, check whether extension is clean.
- Before extending something existing, check whether it becomes harder to understand.

## Components
- Prefer existing UI primitives and shared patterns before bespoke components.
- Extend an existing component when the semantic role and interaction model stay the same.
- Create a new shared component when the pattern will recur across screens.
- Create a page-local component when logic is feature-specific and unlikely to be reused.
- Avoid both duplicate bespoke components and over-generalised god components.

## State
- Keep state local when it affects one component or one bounded interaction.
- Lift or share state when multiple components coordinate on it.
- Server data belongs in the data/query layer, not duplicated local state.
- Do not duplicate a source of truth; derive when possible.
- Avoid both unnecessary global state and fragmented local state.

## API
- Reuse existing resource shapes and endpoint conventions when they still fit clearly.
- Add a new endpoint when forcing it into an existing one would make the contract unclear or overloaded.
- Do not create parallel endpoints for the same concept with slightly different naming.
- Update api-map.md for approved API changes.
- Stop and ask before material API contract changes.

## Database
- Model data by query patterns, constraints, lifecycle, and relationships, not convenience.
- Do not create a new table by default.
- Do not embed child records in JSON/arrays by default.
- Use a new table when data has repeated records, independent filtering/sorting, joins, constraints, reporting value, or its own lifecycle.
- Keep data on an existing table when it is truly an attribute of the same entity.
- Use join tables for many-to-many relationships.
- Use JSON/JSONB for metadata, external payloads, config blobs, or semi-structured non-core data.
- Migration creation requires explicit approval.
- Update database-schema.md for approved schema changes.

## Naming and logic
- Prefer domain names over UI labels or temporary implementation detail.
- Use one term for one concept across frontend, API, and database where possible.
- Put business rules in reusable, testable code, not scattered across UI, routes, and helpers.
- Avoid ceremony for trivial one-step CRUD paths.

## Verification
- Match testing strength to change risk.
- New business rules, shared component behaviour, API changes, and schema changes usually need tests.
- Small UI tweaks still need verification, even if not elaborate tests.
- Extend the nearest existing test pattern rather than inventing a new style.

## Ask before implementing
Stop and ask if the task would:
- add or materially change database schema,
- add or materially change API contracts,
- introduce or broadly reshape shared state,
- add a new cross-cutting abstraction,
- replace an existing architectural pattern,
- require significant refactoring outside task scope.

For non-trivial work, state briefly before coding:
- what existing pattern you inspected,
- whether you are reusing, extending, or creating,
- where state should live,
- whether API or schema changes are needed,
- how the change will be verified.
