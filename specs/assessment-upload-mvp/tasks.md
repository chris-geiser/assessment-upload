# Tasks: Assessment Data Upload MVP

**Inputs**: spec.md, plan.md, data-model.md, contracts/api.md, research.md, constitution.md
**Reference UI**: `roe-assessment-data-ingestion/02-prototype-v2.jsx` (visual/interaction reference only; do not import)

Rules for the implementing agent: work phases in order; every checkpoint means `npm test` passes for the listed suites before continuing; a task is done only when its file exists and its tests pass; constitution violations are defects.

## Phase 1: Setup

- [ ] T001 Create npm workspaces monorepo (root package.json, tsconfig base, .gitignore, README.md) per plan.md Project Structure
- [ ] T002 Add docker-compose.yml with Postgres 16 and create apps/api/.env.example (DATABASE_URL, PORT=3001, STORAGE_DIR)
- [ ] T003 [P] Scaffold apps/web with Vite + React 18 + TypeScript + Tailwind (brand purple #632E93 in tailwind.config)
- [ ] T004 [P] Scaffold apps/api with Fastify 4 + TypeScript, health route, and Vitest + supertest wiring
- [ ] T005 [P] Scaffold packages/shared with Vitest and export stub in packages/shared/src/index.ts
- [ ] T006 Add root scripts: dev (concurrently), test, migrate, seed; verify `npm test` runs all three workspaces

**Checkpoint**: `npm run dev` serves web and api; `npm test` green.

## Phase 2: Foundational (blocks all stories)

### Shared types and configs

- [ ] T007 Define core types (AssessmentConfig, CanonicalField, ValidationIssue, ColumnMapping, DetectionResult, NormalizedLevel) in packages/shared/src/types.ts per data-model.md Config Shape
- [ ] T008 [P] Write DIBELS 8 config in packages/shared/src/assessment-configs/dibels-8.ts (fields, synonyms incl. "LNF - Fall Score"/"NWF-WWR"/"LASID"/"ORF-WC", maxima LNF≤200 PSF≤100 NWF-CLS≤95 NWF-WRC≤95 WRF≤180 ORF≤350 MAZE≤80 ORF-Acc≤100, requiredByGrade per PRD US-3.2, levels Core/Strategic/Intensive → Above/Near/Below, ORF-Accuracy ±10% cross-field check)
- [ ] T009 [P] Write i-Ready config in packages/shared/src/assessment-configs/iready.ts (domains ≤800, "Scale Score" synonyms, On Grade Level/One Below/Two+ Below mapping)
- [ ] T010 [P] Write STAR config in packages/shared/src/assessment-configs/star.ts (Scaled ≤1400, PR ≤99, domains ≤1000, "SS"/"PR"/"GE" synonyms, At-Above/On Watch/Intervention+Urgent mapping)
- [ ] T011 [P] Write VALLSS config in packages/shared/src/assessment-configs/vallss.ts (Letter Sounds ≤28, Sight Words ≤50, Decodable ≤50, Passage Reading ≤8, Retell ≤12, "Student SIS ID" synonym, Low/Moderate/High Risk mapping)
- [ ] T012 [P] Write Amira config in packages/shared/src/assessment-configs/amira.ts (ORF ≤300, ISIP ≤300, Accuracy ≤100%, "WCPM"/"ISIP ER" synonyms, Tier 1/2/3 mapping)
- [ ] T013 Create config registry in packages/shared/src/assessment-configs/index.ts and registry unit test (5 types present, ids versioned, every measure has a max)

### Shared engine

- [ ] T014 Implement detection scoring (30% match, 15% lead, ambiguous result) in packages/shared/src/detection.ts with unit tests
- [ ] T015 Implement multi-strategy mapper (exact → synonym → Fuse.js 0.70 → heuristics; confidence bands; identity fields never fuzzy-auto-mapped per D8) in packages/shared/src/mapping.ts with unit tests
- [ ] T016 Implement grade and performance level normalization in packages/shared/src/validation/normalize.ts ("1st"→"1", "Kindergarten"→"K"; native→normalized levels) with unit tests
- [ ] T017 Implement validation engine (required, type, range, cross-field, grade-measure, negative-score, whitespace-empty, empty-row-warning rules; P4 message format "Row N: Field ... . Do X.") in packages/shared/src/validation/engine.ts and rules.ts with unit tests including message-format assertions

### Fixtures

- [ ] T018 Write fixture generator script in fixtures/generate.ts producing all files listed in plan.md fixtures/ plus fixtures/expected/*.json censuses (exact error/warning counts per dirty file); commit generated fixtures
- [ ] T019 Add engine-vs-census test: run engine over every fixture and assert exact match with fixtures/expected in packages/shared/src/__tests__/fixtures.test.ts

### Database and adapters

- [ ] T020 Write migrations for upload_records, processing_jobs, pipeline_events, submitted_rows, assessment_records, assessment_subtests per data-model.md (all constraints, partial unique indexes) in apps/api/src/db/migrations/
- [ ] T021 [P] Implement StorageAdapter interface + LocalFsStorage in apps/api/src/adapters/storage-adapter.ts with tests
- [ ] T022 [P] Implement AuthProvider interface + MockAuthProvider (3 roles, seeded schools/districts) in apps/api/src/adapters/auth-provider.ts, plus auth plugin with role guards in apps/api/src/plugins/auth.ts and scoping tests
- [ ] T023 [P] Implement WarehouseLoader interface + PostgresStubLoader (loadRecords with core+subtest inserts and level normalization, supersedeRecords) in apps/api/src/adapters/warehouse-loader.ts with tests
- [ ] T024 Implement session routes (GET /api/session, dev-only POST /api/session/switch) in apps/api/src/routes/session.ts per contracts/api.md
- [ ] T025 Implement seed script (users, schools, districts for all 3 roles) in apps/api/src/db/seed.ts

### Component kit

- [ ] T026 [P] Build kit primitives Btn, SecondaryBtn, Badge, Select, Modal, Toast, SummaryCard, Stepper in apps/web/src/kit/ with axe accessibility tests (P6: focus-visible, aria, 44px targets, contrast tokens)
- [ ] T027 [P] Build Table and editable DataGrid (controlled, click-to-edit, Enter/blur commit, Escape cancel, row/cell class hooks, windowed rendering for 10K rows) in apps/web/src/kit/ with tests
- [ ] T028 Build dev RoleSwitcher in apps/web/src/auth/RoleSwitcher.tsx wired to /api/session

**Checkpoint**: shared engine passes fixture censuses; migrations apply cleanly; adapters and kit tested. Foundation ready.

## Phase 3: User Story 1 - Upload and Preview a File (P1)

**Goal**: file in, preview + detection out, metadata recorded.
**Independent Test**: spec.md US1 scenarios against fixtures.

- [ ] T029 [P] [US1] Implement client parse wrapper (PapaParse with delimiter/encoding fallback, SheetJS with sheet selection) in apps/web/src/lib/parse-file.ts with tests for multi-sheet, empty, corrupted, tab-delimited files
- [ ] T030 [P] [US1] Implement upload-service (create record before processing, store raw file, run detection) in apps/api/src/services/upload-service.ts and POST /api/uploads route in apps/api/src/routes/uploads.ts with contract tests (201, FILE_TOO_LARGE, UNSUPPORTED_TYPE, EMPTY_FILE, SCHOOL_SCOPE; duplicate field returned but decision deferred to US6)
- [ ] T031 [US1] Build UploadZone (drag-drop + browse, size/type errors) and PeriodSelector (required before advance) in apps/web/src/features/upload/
- [ ] T032 [US1] Build FilePreview (headers, first 5 rows, counts, detection badge with "(auto-detected)" and change-type link, manual selection prompt on ambiguous, labeled "Remove file" action) in apps/web/src/features/upload/FilePreview.tsx
- [ ] T033 [US1] Build useUploadFlow state machine (stages Upload/Map/Validate/Submit, session persistence, back navigation) and wire Stepper into apps/web/src/pages/AssessmentDataPage.tsx
- [ ] T034 [US1] Component tests: detection badge per fixture, ambiguous prompt, remove-file, stepper stage transitions in apps/web/src/__tests__/us1.test.tsx

**Checkpoint**: all 5 clean fixtures preview with correct detection; US1 suites green.

## Phase 4: User Story 2 - Column Mapping (P1)

**Goal**: reviewed, adjustable mapping gated on required fields.
**Independent Test**: spec.md US2 scenarios with dibels-renamed-headers.csv.

- [ ] T035 [US2] Build ColumnMappingForm (hard two-group layout Student Info / Assessment Measures, per-field dropdown + "Not Present", confidence indicators, Reset to Auto-Mapped, session persistence of overrides) in apps/web/src/features/upload/ColumnMappingForm.tsx
- [ ] T036 [US2] Implement required-field gate (block advance, name missing fields) in useUploadFlow and mapping form
- [ ] T037 [US2] Component tests: synonym auto-map of renamed headers, override + reset, block on unmapped required field in apps/web/src/__tests__/us2.test.tsx

**Checkpoint**: renamed-headers fixture auto-maps High confidence; gate blocks correctly.

## Phase 5: User Story 3 - Validate and Fix Inline (P1)

**Goal**: full validation UX with inline correction.
**Independent Test**: spec.md US3 scenarios; dirty fixture censuses on screen match fixtures/expected.

- [ ] T038 [US3] Build ValidationGrid on kit DataGrid (summary cards with always-yellow warning card, row tints, cell borders with focus-accessible messages, All/Issues filter, submitted count slot) in apps/web/src/features/upload/ValidationGrid.tsx
- [ ] T039 [US3] Wire inline editing to engine re-validation (single-row re-check ≤1s, cross-field pairs re-checked together, counts update) in ValidationGrid + useUploadFlow
- [ ] T040 [P] [US3] Implement validation report CSV download (row_number, field_name, value, severity, message; sorted) in apps/web/src/features/upload/report.ts with test
- [ ] T041 [P] [US3] Implement POST /api/uploads/:uploadId/validate route in apps/api/src/routes/validation.ts with contract tests including 422 REQUIRED_FIELDS_UNMAPPED
- [ ] T042 [US3] Add 10K-row performance test (validation + render ≤10s, progress indicator shown >2s; move engine to web worker if budget fails) in apps/web/src/__tests__/us3-perf.test.tsx
- [ ] T043 [US3] P8 agreement test: client engine result equals /validate response for every fixture in apps/api/src/__tests__/engine-agreement.test.ts

**Checkpoint**: dirty fixtures show exact expected censuses; inline fix flow works; client/server agree.

## Phase 6: User Story 4 - Submit and Track (P2)

**Goal**: async pipeline with adaptive submit, partial submit, resubmit.
**Independent Test**: spec.md US4 scenarios.

- [ ] T044 [US4] Implement pipeline-service (job worker with SKIP LOCKED claim, stage transitions queued→validating→validated→loading→complete/failed, event logging per FR-017, WarehouseLoader call, submitted_rows bookkeeping) in apps/api/src/services/pipeline-service.ts with tests
- [ ] T045 [US4] Implement POST /api/uploads/:uploadId/submit (server re-validation, 422 SERVER_VALIDATION_FAILED, 409 ROWS_ALREADY_SUBMITTED), GET /api/jobs/:jobId/status, POST /api/jobs/:jobId/retry in apps/api/src/routes/submissions.ts and jobs.ts with contract tests
- [ ] T046 [US4] Build SubmitActionBar (adaptive states per FR-013, warnings confirmation dialog, one-line status text only) in apps/web/src/features/upload/SubmitActionBar.tsx
- [ ] T047 [US4] Build PipelineStatusModal (5 stages, 5s polling, dismissable, connection-lost state, failure state with retry, success counts, Continue Editing / Resubmit Fixed Rows / Done / Upload Another File flows) in apps/web/src/features/upload/PipelineStatusModal.tsx
- [ ] T048 [US4] Integration test: clean submit to Complete; mixed file partial submit → inline fix → resubmit transmits only new row indexes → Done, in apps/web/src/__tests__/us4.test.tsx and apps/api/src/__tests__/pipeline.test.ts

**Checkpoint**: full submit loop green including partial/resubmit; toast on failure; events logged for every stage.

## Phase 7: User Story 5 - Upload History (P2)

**Goal**: scoped, live-updating history with detail view.
**Independent Test**: spec.md US5 scenarios.

- [ ] T049 [P] [US5] Implement GET /api/uploads (role scoping, pagination 20, superseded inline) and GET /api/uploads/:uploadId in apps/api/src/routes/uploads.ts with contract tests
- [ ] T050 [US5] Build UploadHistoryTable (columns, badges incl. Partially Loaded and >24h Processing warning, 5s polling while any row Processing, click row → detail; Processing row click reopens PipelineStatusModal) in apps/web/src/features/history/UploadHistoryTable.tsx
- [ ] T051 [US5] Build UploadDetailSheet (full metadata + validation summary) in apps/web/src/features/history/UploadDetailSheet.tsx
- [ ] T052 [US5] Tests: badge states, empty state, pagination, DISTRICT_ADMIN multi-school scope in apps/web/src/__tests__/us5.test.tsx

**Checkpoint**: history reflects live pipeline state; scoping verified for all 3 roles.

## Phase 8: User Story 6 - Replace a Previous Upload (P3)

**Goal**: dedup detection, confirmation, supersession chain, lineage display.
**Independent Test**: spec.md US6 scenarios.

- [ ] T053 [US6] Implement dedup-service (metadata match school+type+period, 90-day configurable window) and POST /api/uploads/:uploadId/replace-decision in apps/api/src/services/dedup-service.ts and routes/uploads.ts with contract tests (replace chain of 3, cancel persists failed record)
- [ ] T054 [US6] Build DuplicateDialog (exact copy per FR-020 wording, Replace/Cancel) and wire into upload flow before validation in apps/web/src/features/upload/DuplicateDialog.tsx
- [ ] T055 [US6] Lineage display: dimmed "Replaced" rows inline in UploadHistoryTable, superseded detail shows original validation summary; warehouse default-query test proves only active records return (SC-007) in apps/api/src/__tests__/supersession.test.ts

**Checkpoint**: replacement end to end including chain-of-3; SC-007 test green.

## Phase 9: Polish and Cross-Cutting

- [ ] T056 [P] SC-005 config-extension test: register synthetic 6th assessment config + fixture, drive detect→map→validate→load with zero app-code changes, in packages/shared/src/__tests__/config-extension.test.ts
- [ ] T057 [P] Accessibility sweep: axe run over every feature screen, keyboard-only walkthrough test of the full upload flow, in apps/web/src/__tests__/a11y.test.tsx
- [ ] T058 [P] Lint rule banning raw button/table elements outside apps/web/src/kit/ (P5) in eslint config
- [ ] T059 Write README.md run instructions matching quickstart.md exactly; verify every quickstart scenario manually
- [ ] T060 Final gate: full `npm test`, all quickstart scenarios pass, grep codebase for literal assessment-type branching (P1 violation check) and for TODO/FIXME left by implementation

**Checkpoint**: release candidate.

## Dependencies & Execution Order

### Phase Dependencies
- Phase 1 → Phase 2 → all story phases.
- US1 (Phase 3) blocks US2 blocks US3 (the flow is sequential through the stepper).
- US4 depends on US3. US5 depends on US4 (needs statuses to display). US6 depends on US5 (lineage display) and US4 (supersedeRecords path), though T053 backend work can start after Phase 2.
- Phase 9 last.

### Parallel Opportunities
- All [P] tasks within a phase touch different files and can run simultaneously.
- T008 to T012 (five configs) are fully parallel.
- Backend route tasks marked [P] can proceed alongside frontend tasks in the same phase.

## Implementation Strategy

MVP-first: Phases 1 to 5 deliver the P1 core (upload, map, validate, fix inline). Stop and validate there if needed; it is independently demonstrable. Phases 6 to 8 complete the loop. Phase 9 is the quality gate. Total: 60 tasks.
