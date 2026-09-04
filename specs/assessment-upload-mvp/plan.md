# Implementation Plan: Assessment Data Upload MVP

**Date**: 2026-07-07 | **Spec**: spec.md | **Decisions**: research.md

## Summary

Greenfield, self-contained web application implementing the partner upload flow: upload → auto-detect → map → validate → inline fix → submit → track → history, with dedup/versioning. A shared TypeScript validation engine and assessment config module run identically on client (speed) and server (truth). Infrastructure (warehouse, auth, file storage) sits behind three interfaces with local stub implementations so production integrations are bounded swaps.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 (backend and frontend)
**Frontend**: React 18, Vite, Tailwind CSS, app-local component kit
**Backend**: Fastify 4, node-pg-migrate, in-process job worker
**Shared**: `packages/shared` with assessment configs, validation engine, canonical types
**Primary Dependencies**: PapaParse (CSV), SheetJS/xlsx (Excel), Fuse.js (fuzzy match), uuid, pg
**Storage**: PostgreSQL 16 (app tables + warehouse-stub tables); local filesystem via StorageAdapter for raw files
**Testing**: Vitest, React Testing Library, supertest; fixture files with known validation censuses
**Target Platform**: Desktop web (per PRD, desktop only for initial release); local dev via docker-compose (Postgres) + two dev servers
**Project Type**: Monorepo web app (npm workspaces)
**Performance Goals**: 10,000-row validation renders ≤ 10s; inline edit re-validation ≤ 1s; status refresh ≤ 5s
**Constraints**: 50MB upload limit; no external cloud services; WCAG 2.1 AA
**Scale/Scope**: ~40 files per assessment window, ~250 rows average, ~120K subtest rows/year; performance ceiling tested at 10K rows

## Constitution Check

| Principle | How the plan complies |
|---|---|
| P1 Config-driven | All type behavior in `packages/shared/src/assessment-configs/`; engine consumes config only; SC-005 test enforces zero-code type addition |
| P2 Interfaces | `WarehouseLoader`, `StorageAdapter`, `AuthProvider` in `apps/api/src/adapters/` with stub implementations |
| P3 Auditable | Upload record created in the parse endpoint before any processing; soft-deletes only; raw file stored on receipt |
| P4 Human messages | `ValidationIssue` type requires row, field, value, message; format enforced by unit test |
| P5 Component kit | `apps/web/src/kit/` is the only source of interactive primitives; lint rule bans raw `<button>`/`<table>` outside kit |
| P6 Accessibility | Kit primitives own focus/aria/target-size behavior; axe checks in component tests |
| P7 Checkpoints | tasks.md phases end with test gates |
| P8 Server truth | API `/submit` re-runs full engine before load; client summary never trusted |

No violations. Complexity tracking: none needed; the only arguable complexity is the monorepo, justified by the shared engine (D13).

## Project Structure

```text
assessment-ingest/
├── package.json                      # npm workspaces root
├── docker-compose.yml                # Postgres 16
├── README.md
├── packages/shared/
│   └── src/
│       ├── types.ts                  # AssessmentConfig, ValidationIssue, ColumnMapping, canonical row types
│       ├── assessment-configs/
│       │   ├── index.ts              # registry: all configs keyed by id
│       │   ├── dibels-8.ts           # + iready.ts, star.ts, vallss.ts, amira.ts
│       ├── detection.ts              # auto-detect scoring (30% match, 15% lead)
│       ├── mapping.ts                # exact/synonym/fuzzy/heuristic mapper
│       ├── validation/
│       │   ├── engine.ts             # runs config rules over rows
│       │   ├── rules.ts              # required/type/range/cross-field/grade rules
│       │   └── normalize.ts          # grade + performance level normalization
│       └── __tests__/
├── apps/api/
│   └── src/
│       ├── server.ts
│       ├── plugins/auth.ts           # AuthProvider wiring, role guards
│       ├── adapters/
│       │   ├── warehouse-loader.ts   # interface + PostgresStubLoader
│       │   ├── storage-adapter.ts    # interface + LocalFsStorage
│       │   └── auth-provider.ts      # interface + MockAuthProvider
│       ├── routes/
│       │   ├── uploads.ts            # parse, get, history, duplicate-check, replace
│       │   ├── validation.ts         # server-side validate
│       │   ├── submissions.ts        # submit, resubmit
│       │   └── jobs.ts               # job status
│       ├── services/
│       │   ├── upload-service.ts
│       │   ├── dedup-service.ts
│       │   ├── pipeline-service.ts   # job worker, stage transitions, event log
│       │   └── event-logger.ts
│       ├── db/
│       │   ├── migrations/
│       │   └── queries/
│       └── __tests__/
├── apps/web/
│   └── src/
│       ├── kit/                      # Btn, SecondaryBtn, Table, DataGrid, Badge, Select, Modal, Stepper, Toast, SummaryCard
│       ├── auth/RoleSwitcher.tsx     # dev-only role/school switcher
│       ├── pages/AssessmentDataPage.tsx
│       ├── features/upload/
│       │   ├── UploadZone.tsx
│       │   ├── FilePreview.tsx
│       │   ├── PeriodSelector.tsx
│       │   ├── DuplicateDialog.tsx
│       │   ├── ColumnMappingForm.tsx
│       │   ├── ValidationGrid.tsx
│       │   ├── SubmitActionBar.tsx
│       │   ├── PipelineStatusModal.tsx
│       │   └── useUploadFlow.ts      # stepper/session state machine
│       ├── features/history/
│       │   ├── UploadHistoryTable.tsx
│       │   └── UploadDetailSheet.tsx
│       ├── lib/parse-file.ts         # PapaParse/SheetJS wrapper
│       └── __tests__/
└── fixtures/
    ├── dibels-clean.csv, dibels-dirty.csv, dibels-renamed-headers.csv
    ├── iready-clean.csv, iready-dirty.csv
    ├── star-clean.csv, star-dirty.csv
    ├── vallss-clean.csv, vallss-dirty.csv
    ├── amira-clean.csv, amira-dirty.csv
    ├── ambiguous-headers.csv, multi-sheet.xlsx, empty.csv
    └── expected/                     # JSON census per dirty fixture (expected errors/warnings)
```

## Data Flow (happy path)

1. Client parses file locally → `POST /api/uploads` with headers, row count, metadata, and the raw file (multipart) → upload record created, raw file stored, duplicate check runs, detection result returned.
2. Client runs mapping + validation locally with the shared engine; user edits inline.
3. `POST /api/uploads/:id/submit` with mapped rows → server re-validates with the same engine → creates processing job → worker transitions job through stages, logs pipeline events, calls `WarehouseLoader.loadRecords` → job status polled by client.
4. History reads upload records; replacement calls `WarehouseLoader.supersedeRecords` on the old upload inside the replace flow.

## Key Risks for the Implementing Agent

- **DataGrid scope creep**: the editable grid is the largest component. Keep it dumb: controlled data in, edit events out, no validation logic inside the component (engine owns that).
- **10K-row rendering**: virtualize rows (windowing) in the grid; validate in a web worker if main-thread validation exceeds the 10s budget on fixtures.
- **Shared engine drift**: there is exactly one validation engine. If client and server results can disagree on a fixture, that is a failed checkpoint (P8 test compares both outputs on every fixture).
- **Partial submit bookkeeping**: track per-row submission state by stable row index from the original parse, not by array position after filtering.

## Quality Gates

- All research.md decisions reflected; no `[NEEDS CLARIFICATION]` markers remain anywhere in the package.
- Data model covers all six spec entities.
- API contract covers every client/server interaction in the data flow.
- quickstart.md scenarios runnable end to end.
