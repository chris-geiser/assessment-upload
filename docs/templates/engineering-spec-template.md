# Engineering Spec Package Template (spec-driven development)

Audience: the engineers or agents who build the feature. The package sits behind the product PRD and is linked from it. Its job is to let someone implement without asking questions, so the standard for every section is: could a careful stranger write the code and the tests from this alone?

The package scales with how well the problem is understood. A well-understood feature fills every section; an exploratory one fills the constitution, the stories, and the data model and marks the rest [TBD]. Do not invent numbers to fill a section. It can be one document or, for larger work, one file per section (the layout used for the assessment-upload prototype).

## Rules that apply across the package

These rules exist because each one was violated at least once in the assessment-upload build and cost a judgment call that a rule would have prevented.

1. Every validation or business rule cites a field that exists in the data model. A rule that references an unmodeled value is a defect in the spec.
2. Every output column (warehouse table, report, export) traces back to an input field or a documented derivation. Trace them before the build, not when the loader is being written.
3. The state model lists its invariants and walks every transition against them. Two requirements that cannot both hold under the stated constraints are a spec conflict to resolve here, not in the migration.
4. Design tokens, colors, and typography are referenced from the design system by name. Restating a hex value in the spec creates a second source of truth that drifts.
5. Thresholds are numbers with units. "Within tolerance" and "fast" are not requirements; "within 10 percentage points" and "10,000 rows in 10 seconds" are.
6. No `[NEEDS CLARIFICATION]` or `[TBD]` marker survives into the build phase it gates. Each marker has an owner.
7. Fixtures and their expected results are deliverables in the foundation phase, not test-time afterthoughts. Every checkpoint is verified against them.

---

# [Feature name] Engineering Spec

**PRD:** [link] · **One-pager:** [link] · **Owner:** [name] · **Status:** [draft / approved for build]

## 1. Constitution (non-negotiables)

Numbered principles that are defects if violated, not trade-offs. Each is one paragraph stating the MUST and the reason. Typical entries: where domain logic must live, which infrastructure must sit behind an interface, what must be auditable, what a human-facing error message must contain, which accessibility standard applies, and the rule that every phase ends in passing tests.

## 2. User stories and acceptance scenarios

One story per user goal, prioritized (P1, P2, P3), each with an independent test statement and Given / When / Then acceptance scenarios. Scenarios contain the numbers. Each scenario should map to one automated test. Follow with numbered functional requirements (FR-001…) that the scenarios exercise, and edge cases as a list.

## 3. Success criteria

Measurable outcomes (SC-001…) with the number and how it is verified. Distinguish prototype-verifiable criteria (checked by a test on fixtures) from business criteria (checked in production).

## 4. Plan

Language and versions, primary dependencies, storage, testing stack, target platform, performance goals with numbers, hard constraints (file size limits, standards), and scale assumptions. A constitution check table showing how the plan satisfies each principle. The project structure as a file tree. The happy-path data flow as a numbered list. Named risks for the implementer.

## 5. Data model

Per entity: fields with types and nullability, relationships, validation constraints (including partial unique indexes), states and every allowed transition, and indexes. Then a section for invariants (statements that must always hold) and a transition walk showing each transition preserves them (rule 3). Then a traceability table: every output field, its source input field or derivation (rule 2). Configuration shapes that are not tables go here too, with the note that they are the single place for domain-specific behavior.

## 6. Interface contracts

External API: every endpoint with method, path, auth and role scoping, request shape, response shape with an example, and every error code with its status and human-readable message. Internal seams: each interface that hides infrastructure (its methods and the stub that ships first). State which tests cover each endpoint (happy path, scoping, each error code).

## 7. Non-functional requirements

Performance budgets with numbers, size and rate limits, accessibility standard and the concrete checks (focus, contrast ratio, target size, keyboard paths), security and privacy requirements, retention rules.

## 8. Decision log

One entry per non-obvious choice: the decision, the rationale, the alternatives considered and why they lost, and the seam that makes it reversible. Items the source documents left open map to an entry here. A deferred table lists what is out of this build and where each item lands later.

## 9. Tasks and checkpoints

Ordered phases, each with numbered tasks that name the file they produce. Tasks that touch different files and can run in parallel are marked. Every phase ends in a checkpoint stating which test suites must pass before the next phase starts. Dependencies between phases are stated. Foundation includes the fixtures (rule 7).

## 10. Quickstart

The commands to run it from a clean machine, and the manual smoke scenarios that mirror the checkpoint tests, each naming the fixture and the expected outcome.

## 11. Open questions

Every remaining `[TBD]` in one place, with an owner and the phase it blocks.
