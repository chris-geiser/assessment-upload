# Research and Decision Log: Assessment Data Upload MVP

**Date**: 2026-07-07 | **Spec**: spec.md

Every open item from the PRD, tech spec draft, and engineering context package is resolved here. All decisions are reversible; each names the seam that makes the swap bounded. Items marked `[ENGINEERING INPUT NEEDED]` in the source documents map to a decision below.

## D1. Backend Stack

- **Decision**: Node.js 20 + TypeScript + Fastify.
- **Rationale**: The prototype and its parsing/matching libraries (PapaParse, SheetJS, Fuse.js) are JavaScript. One language across the stack lets client and server share the validation engine and assessment configs, which directly serves constitution P8 (server re-validates with the same rules). Fastify over Express for built-in schema validation and speed.
- **Alternatives considered**: Ruby/Rails (Ignite's likely production stack, but no shared validation code and unknown to this greenfield); Python/FastAPI (fine, but forces duplicating the validation engine).

## D2. Database

- **Decision**: PostgreSQL 16 for application tables (uploads, jobs, events) and the warehouse-stub tables (assessment_records, assessment_subtests).
- **Rationale**: JSONB for metadata and processing logs, partial unique indexes for the one-active-upload-per-window constraint, and it runs anywhere. Migrations via node-pg-migrate.
- **Alternatives considered**: SQLite (simpler but no JSONB parity and diverges from any production path).

## D3. Warehouse Integration

- **Decision**: `WarehouseLoader` interface; MVP implementation writes to the local Postgres core + subtest tables. Interface methods: `loadRecords(uploadId, records)`, `supersedeRecords(uploadId)`.
- **Rationale**: The real decision (direct Snowflake write vs. S3 staging vs. existing Stitch/dbt chain) belongs to Ignite's Data Engineering team (PRD open item #2). The interface pins the contract so that decision is a one-file swap.
- **Alternatives considered**: Building the Stitch/dbt path now (blocked on credentials and team decisions; would kill the one-shot).

## D4. Authentication and Roles

- **Decision**: `AuthProvider` interface; MVP implementation is a mock session with a visible dev role/school switcher offering SCHOOL_ADMIN (single school), DISTRICT_ADMIN (multi-school district), IGNITE_ADMIN. All route guards and data scoping depend only on the interface.
- **Rationale**: Sphinx Gate integration (PRD open item #3) requires the real portal. The mock preserves every role-dependent behavior so authorization logic is fully testable.
- **Alternatives considered**: Skipping auth entirely (would leave role scoping untested and un-specced).

## D5. Raw File Storage

- **Decision**: `StorageAdapter` interface with S3-compatible key semantics (`uploads/{upload_id}/original.{ext}`); MVP implementation writes to a local `storage/` directory.
- **Rationale**: No cloud credentials needed for one-shot. Lifecycle policy (45-day post-contract destruction, PRD US-6.4) is documented as the production adapter's responsibility and out of MVP scope.
- **Alternatives considered**: MinIO in Docker (closer to S3 but adds infra to the one-shot).

## D6. Async Pipeline and Status Updates

- **Decision**: Postgres-backed `processing_jobs` table plus an in-process worker loop in the API service. Frontend polls `GET /jobs/:jobId/status` every 5 seconds. No WebSocket, no Redis.
- **Rationale**: PRD US-4.3 explicitly allows polling. A queue system (Celery/Sidekiq/SQS, tech spec open item) adds infrastructure without changing the contract; the jobs table is the durable record either way, so a real queue is a drop-in later.
- **Alternatives considered**: WebSocket (better latency, more failure modes to handle in one shot); BullMQ + Redis (adds a service dependency).

## D7. Assessment Config Storage

- **Decision**: Git-checked TypeScript module (`packages/shared/src/assessment-configs/`), one file per assessment type, exporting a typed `AssessmentConfig`. Shared by client and server.
- **Rationale**: Type-checked, code-reviewed, versioned, and satisfies P1 (new type = new config file). Matches the tech spec's own recommendation (git-checked config with optional DB overrides later).
- **Alternatives considered**: Database table (runtime updates without deploy, but adds admin UI scope); YAML (loses type checking).

## D8. Fuzzy Matching

- **Decision**: Fuse.js, threshold 0.70, with confidence bands per PRD US-2.1 (High = exact/synonym, Medium ≥ 0.85, Low = 0.70 to 0.85). Identity fields (student_id, names) require synonym-or-exact match to auto-map; fuzzy suggestions for identity fields render as Low confidence and are never auto-selected.
- **Rationale**: Already validated in the prototype. The identity-field restriction adopts the tech spec's own caution that fuzzy matching is risky for student identity fields.

## D9. Assessment Versioning (PRD Open Question #13)

- **Decision**: Config `id` is a versioned string (`DIBELS_8`); `display_name` carries the edition ("DIBELS 8th Edition"). Only DIBELS 8 ships. A future DIBELS 9 is a separate config entry.
- **Rationale**: Zero-cost structural answer that defers the policy question (how to treat districts on older editions) without blocking the model.

## D10. Frontend Stack

- **Decision**: React 18 + Vite + TypeScript + Tailwind CSS. App-local component kit (Btn, SecondaryBtn, Table, DataGrid, Badge, Select, Modal, Stepper, Toast) styled to brand purple #632E93.
- **Rationale**: Prototype is React/Tailwind JSX; components port with minimal translation. The local kit satisfies P5 in a greenfield and documents the visual contract a future port to the real component-kit must honor.
- **Alternatives considered**: Next.js (SSR adds nothing here); importing the prototype JSX directly (149KB single file; it is a reference, not a codebase).

## D11. File Parsing

- **Decision**: Client-side parsing with PapaParse (CSV, with delimiter auto-detection and UTF-8 → ISO-8859-1 fallback) and SheetJS (XLSX/XLS, with sheet selection). Server receives parsed rows plus the raw file for audit, and independently validates structure.
- **Rationale**: Matches PRD US-1.6 and the tech spec assumption; preserves instant preview UX.

## D12. Testing Stack

- **Decision**: Vitest + React Testing Library (frontend), Vitest + supertest against Fastify (API), shared validation-engine unit tests in the shared package. Fixture set: for each of the 5 types, one clean file, one dirty file (known error/warning census), plus one renamed-headers DIBELS file, one ambiguous-headers file, one multi-sheet XLSX, one empty file. Fixture generation is a scripted task with documented expected counts.
- **Rationale**: One-shot success depends on the agent verifying its own work; fixtures with known expected outcomes make every checkpoint objective.

## D13. Monorepo Layout

- **Decision**: npm workspaces monorepo: `packages/shared` (configs, validation engine, types), `apps/api`, `apps/web`.
- **Rationale**: The shared validation engine is the architectural centerpiece (P8); a monorepo is the simplest structure that lets both sides import it.

## Deferred (Explicitly Out of MVP)

| Item | Where it lands later |
|---|---|
| Real warehouse write (Snowflake/Stitch/dbt) | `WarehouseLoader` production implementation |
| Sphinx Gate auth | `AuthProvider` production implementation |
| S3 storage + 45-day lifecycle automation | `StorageAdapter` production implementation |
| Email notifications | Post-MVP per PRD Out of Scope |
| CX Dashboard (PRD US-8) | Pending CX discovery |
| Data Explorer views | Separate feature spec |
| WebSocket status | Swap for polling if latency matters |
| PII exposure audit | PM action item, not code |
