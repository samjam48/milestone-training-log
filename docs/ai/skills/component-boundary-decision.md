---
name: component-boundary-decision
summary: Decide whether UI should stay inline, become page-local, become shared, or enter the design system.
triggers:
  - large component
  - extract component
  - add component variant
  - shared UI pattern
  - design system decision
roles:
  - architect
  - planner
  - implementer
  - reviewer
read_first:
  - AGENTS.md
  - docs/architecture.md
  - docs/patterns.md
approval_required_if:
  - new shared component pattern
  - design system changes
related_skills:
  - frontend-state-decision
  - frontend-data-flow-check
  - large-component-refactor
canonical: true
---

# Component Boundary Decision

Use when:
- a component is growing large or mixed in purpose,
- deciding inline versus page-local versus shared versus design-system,
- deciding whether to compose existing primitives or create something new,
- deciding whether a new need should be a variant of an existing component or a separate component,
- deciding whether a feature component should be promoted into the shared library.

Goal:
Choose the UI abstraction level that best preserves clarity, reuse, and maintainability.

Core rules:
- Reuse existing primitives when semantic role and interaction model match.
- Keep code inline when extraction adds indirection without reuse or clarity.
- Create a page-local component when logic is feature-specific and unlikely to recur.
- Create a shared component when the pattern is stable and likely to recur across screens.
- Promote into the design system only when reuse is real and semantics remain stable.
- Add a variant when the component keeps the same semantic role and mental model.
- Split into a separate component when variants would make behavior or meaning confusing.
- Avoid both duplicate bespoke components and over-generalized god components.

Checks:
- Is this repeated UI or a one-off feature detail?
- Would extraction improve clarity or just move lines around?
- Is reuse proven or only hypothetical?
- Does the component keep the same semantic identity across use cases?
- Would a variant still be understandable to another developer?

Output:
1. Recommended boundary: inline / page-local / shared / design-system.
2. Recommended form: reuse / extend with variant / create new component.
3. Why it fits.
4. Why alternatives are worse.
5. Expected reuse level and maintenance implications.
