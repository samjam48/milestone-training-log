---
name: large-component-refactor
summary: Break a large frontend file into smaller coherent parts without changing intended behavior.
triggers:
  - monolith component
  - extract from large file
  - structural frontend refactor
  - app file split
roles:
  - architect
  - implementer
  - reviewer
read_first:
  - AGENTS.md
  - docs/architecture.md
  - docs/patterns.md
approval_required_if:
  - broad refactor outside task scope
related_skills:
  - component-boundary-decision
  - frontend-state-decision
  - frontend-data-flow-check
  - test-strategy-decision
canonical: true
---

# Large Component Refactor

Use when:
- a large frontend file is becoming hard to reason about,
- extracting pieces from a monolithic page or app file,
- breaking a large component into page-local or shared components,
- refactoring structure without intentionally changing behavior.

Goal:
Break a large component into smaller coherent parts while preserving current behavior and avoiding premature abstraction.

Core rules:
- Preserve behavior first; refactor structure second.
- Add characterization tests or other verification before risky extractions when coverage is weak.
- Extract one coherent responsibility at a time.
- Keep feature-specific pieces page-local unless reuse is real.
- Use existing component, state, and data-flow skills for boundary decisions rather than inventing abstractions ad hoc.
- Do not rewrite the whole file at once if incremental extraction is possible.
- Prefer small safe steps with passing verification between them.

Checks:
- What responsibilities currently live in this file?
- Which pieces are purely presentational, stateful, data-related, or orchestration-related?
- What can be extracted without changing behavior?
- Should the extracted piece stay local or become shared?
- What verification protects the refactor?

Output:
1. Suggested extraction order.
2. First component or concern to extract.
3. Which existing skills should guide the extraction.
4. Verification needed before and after each step.
5. Risks of over-extraction or hidden behavior change.
