# Constitution: Assessment Data Ingestion Platform (Upload MVP)

**Created**: 2026-07-07
**Applies to**: All artifacts and code in this feature
**Source**: PRD v1.3 (`roe-assessment-data-ingestion/01-prd-v1.3.md`), Engineering Context Package v1.0

These principles are non-negotiable. Any implementation decision that violates a MUST is a defect, not a tradeoff.

## P1. Config-Driven Assessment Logic

Assessment-specific behavior (canonical fields, synonyms, validation rules, grade requirements, performance level mappings) MUST live in the assessment configuration module, never in application code paths. Adding a sixth assessment type MUST require only a new config entry, zero changes to services, components, or database schema. Code that branches on a literal assessment type name (e.g., `if (type === "DIBELS")`) is a constitution violation.

## P2. Infrastructure Behind Interfaces

All external infrastructure MUST be accessed through a narrow interface with a swappable implementation:

- `WarehouseLoader`: loading validated records to the warehouse. MVP ships a stub that writes to local Postgres tables. No service other than the stub may write to warehouse tables.
- `StorageAdapter`: raw file storage with an S3-compatible signature (`put`, `get`, `delete`, keyed paths). MVP ships a local filesystem implementation.
- `AuthProvider`: session and role resolution. MVP ships a mock provider with a dev role switcher (SCHOOL_ADMIN, DISTRICT_ADMIN, IGNITE_ADMIN). Route authorization logic MUST depend only on the interface.

Production swaps (Snowflake/Stitch, S3, Sphinx Gate) must each be a bounded change touching one implementation file plus wiring.

## P3. Every Upload Is Auditable

An upload metadata record MUST be created before any processing begins and MUST persist even if the upload fails or is abandoned. Raw source files MUST be stored unmodified. Superseded uploads MUST be soft-deleted (status change), never physically removed. There are no destructive deletes anywhere in this system.

## P4. Validation Messages Are for Humans

Every validation and pipeline error message MUST name the row, field, and value involved, and state what to do about it, in plain language. "Row 47: Student ID is empty. Enter the student's ID or remove the row." is acceptable. "Invalid data" and raw error codes are violations.

## P5. Component Kit Only

All interactive UI elements MUST use the app's component kit primitives (Btn, SecondaryBtn, Table, DataGrid, Badge, Select, Modal). No ad hoc button, table, or input styles. Brand primary is purple #632E93. Status colors: green (success/clean), yellow (warning), red (error), blue (processing), gray (superseded).

## P6. Accessibility Is a Requirement, Not Polish

All interactive elements MUST meet WCAG 2.1 AA: visible focus indicators, keyboard-accessible tooltips (focus-triggered, not hover-only), `aria-expanded` on collapsibles, `aria-label` on icon-only controls, text labels on destructive actions (never icon-only), 4.5:1 contrast for normal text, and 44x44px minimum touch targets.

## P7. Tested at Every Checkpoint

Each user story phase in tasks.md ends with a checkpoint that MUST have passing automated tests before the next phase begins. Fixture files (clean and dirty variants) for all 5 assessment types are part of the foundation, not an afterthought. A checkpoint with failing tests is not complete.

## P8. Client Validates for Speed, Server Validates for Truth

Client-side validation exists for immediate feedback. The server MUST independently re-validate all submitted data with the full rule set before loading. The server never trusts client validation results.
