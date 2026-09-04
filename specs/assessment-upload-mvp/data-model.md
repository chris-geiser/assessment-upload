# Data Model: Assessment Data Upload MVP

**Date**: 2026-07-07 | **Spec**: spec.md | **DB**: PostgreSQL 16

Four application tables plus two warehouse-stub tables. All IDs are UUIDs. All timestamps are UTC `timestamptz`. No physical deletes anywhere (constitution P3).

## Entities

### upload_records

One row per file submission attempt. Created before any processing (FR-005).

- **Fields**:
  - `upload_id`: uuid PK, default gen_random_uuid()
  - `filename`: varchar(255) not null
  - `file_size_bytes`: int not null
  - `row_count`: int
  - `column_count`: int
  - `storage_key`: varchar(500) - StorageAdapter key `uploads/{upload_id}/original.{ext}`
  - `assessment_type`: varchar(50) not null - config id, e.g. `DIBELS_8`
  - `assessment_window`: varchar(10) not null - `BOY` | `MOY` | `EOY`
  - `school_id`: uuid not null; `school_name`: varchar(255) not null
  - `district_id`: uuid not null; `district_name`: varchar(255) not null
  - `uploaded_by_user_id`: uuid not null; `uploaded_by_name`: varchar(255); `uploaded_by_role`: varchar(30)
  - `status`: varchar(30) not null default `'in_progress'` - see states
  - `validation_summary`: jsonb - `{totalRows, cleanRows, errorRows, warningRows, submittedRows}`
  - `column_mapping`: jsonb - final mapping used at submission
  - `previous_upload_id`: uuid null, FK → upload_records(upload_id)
  - `replacement_status`: varchar(20) not null default `'active'` - `active` | `superseded`
  - `created_at`, `submitted_at`, `loaded_at`, `updated_at`: timestamptz
- **Relationships**: has many assessment_records, pipeline_events, processing_jobs; optionally supersedes one upload_record (chain via previous_upload_id).
- **Validation**: partial unique index enforcing one active upload per window:
  `UNIQUE (assessment_type, school_id, assessment_window) WHERE replacement_status = 'active' AND status <> 'failed'`
- **States**: `in_progress` → `validated_with_warnings` (optional) → `processing` → `loaded` | `partially_loaded` | `failed`. Any state → `replacement_status = 'superseded'` via the replace flow. Abandoned uploads stay `in_progress` (audit trail, FR-005).
- **Indexes**: (school_id, assessment_window), (district_id), (status), (created_at desc)

### processing_jobs

Async pipeline unit for one submission or resubmission (D6).

- **Fields**:
  - `job_id`: uuid PK
  - `upload_id`: uuid not null FK → upload_records
  - `stage`: varchar(20) not null - `queued` | `validating` | `validated` | `loading` | `complete` | `failed`
  - `progress_pct`: int not null default 0
  - `rows_submitted`: int not null
  - `rows_loaded`: int not null default 0
  - `rows_failed`: int not null default 0
  - `row_indexes`: jsonb - stable original-parse indexes included in this job (partial submit bookkeeping)
  - `error`: jsonb null - `{code, message, stage, timestamp}` (message must satisfy P4)
  - `created_at`, `started_at`, `completed_at`: timestamptz
- **Relationships**: belongs to upload_record. An upload can have multiple jobs (submit, then resubmit-fixed-rows).
- **States**: `queued` → `validating` → `validated` → `loading` → `complete`; any stage → `failed`. Worker claims jobs with `FOR UPDATE SKIP LOCKED`.

### pipeline_events

Structured observability log (FR-017). Append-only.

- **Fields**: `event_id` uuid PK; `upload_id` uuid FK; `job_id` uuid null FK; `event_type` varchar(40) - `file_received`, `validation_started`, `validation_completed`, `mapping_applied`, `load_started`, `load_completed`, `load_failed`, `upload_superseded`; `status` varchar(20); `processing_duration_ms` int; `detail` jsonb (row counts, messages); `created_at` timestamptz.
- **Validation**: event_type constrained by CHECK; never updated or deleted.

### submitted_rows (session bridge)

Tracks which original row indexes were transmitted per upload, so resubmission sends only new rows (FR-018).

- **Fields**: `upload_id` uuid FK, `row_index` int, `job_id` uuid FK, `loaded` boolean, `created_at`. PK (upload_id, row_index).
- **Note**: inline edits themselves are session-only client state (PRD US-3.6); only submitted data reaches the server.

## Warehouse Stub Tables (behind WarehouseLoader)

### assessment_records

One row per student per assessment type per window (PRD US-6.1, minimal MVP form).

- **Fields**:
  - `record_id`: uuid PK
  - `upload_id`: uuid not null FK → upload_records
  - `assessment_source`: varchar(50) not null - config id
  - `assessment_window`: varchar(10) not null
  - `assessment_date`: date null
  - `student_id`: varchar(255) not null
  - `student_first_name`, `student_last_name`: varchar(255)
  - `grade_level`: varchar(10) - normalized (`K`, `1` ... `12`)
  - `school_id`: uuid; `school_name`: varchar(255)
  - `district_id`: uuid; `district_name`: varchar(255)
  - `overall_score`: numeric(10,2) null
  - `overall_score_type`: varchar(30) null - `raw` | `scaled` | `percentile` | `fluency` | `accuracy` | `composite`
  - `performance_level_native`: varchar(50) null - as provided by source
  - `performance_level`: varchar(30) null - normalized: `Above Benchmark` | `Near Benchmark` | `Below Benchmark`
  - `metadata`: jsonb - source-specific fields (e.g., DIBELS composite, i-Ready Lexile)
  - `superseded`: boolean not null default false - set true by `supersedeRecords` (FR-021)
  - `created_at`, `updated_at`: timestamptz
- **Validation**: `UNIQUE (assessment_source, student_id, school_id, assessment_window) WHERE superseded = false`. Default queries filter `superseded = false` (SC-007).
- **Indexes**: (upload_id), (student_id, school_id), (assessment_source, assessment_window)

### assessment_subtests

EAV measure rows (PRD US-6.1).

- **Fields**: `subtest_id` uuid PK; `record_id` uuid not null FK → assessment_records ON DELETE CASCADE; `measure_name` varchar(100) not null; `measure_score` numeric(10,2) null; `measure_max` numeric(10,2) null (copied from config at load); `measure_type` varchar(30); `created_at`.
- **Validation**: `UNIQUE (record_id, measure_name)`.
- **Relationships**: assessment_records has many assessment_subtests. Expected volume ~120K rows/year; no partitioning needed.

## Config Shape (not a table; packages/shared, constitution P1)

```typescript
interface AssessmentConfig {
  id: string;                        // "DIBELS_8" (versioned, D9)
  displayName: string;               // "DIBELS 8th Edition"
  vendor: string;                    // "Amplify / mCLASS"
  canonicalFields: CanonicalField[]; // {name, label, type, category: "student"|"measure",
                                     //  required?, max?, min?, measureType?}
  synonymMap: Record<string, string>;      // normalized header → canonical name
  requiredByGrade: Record<string, string[]>; // "1": ["LNF","PSF",...]
  performanceLevels: Record<string, NormalizedLevel>; // "Core" → "Above Benchmark"
  crossFieldChecks: CrossFieldCheck[];     // e.g., ORF-Accuracy ±10% consistency
}
```

All 5 configs seeded from PRD v1.3 Appendix (field lists, synonyms, score maxima, performance level mappings). The Appendix table is the authoritative source for config contents; do not invent measures or synonyms beyond it plus the explicit examples in PRD US-2.1/3.2.
