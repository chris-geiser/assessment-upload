-- Assessment Data Upload MVP schema (data-model.md). No physical deletes anywhere
-- (constitution P3): superseded rows are soft-deleted via status/flag changes.
-- gen_random_uuid() is provided by pgcrypto (required on PostgreSQL < 13).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Application tables ────────────────────────────────────────────────────────

CREATE TABLE upload_records (
  upload_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename             varchar(255) NOT NULL,
  file_size_bytes      integer NOT NULL,
  row_count            integer,
  column_count         integer,
  storage_key          varchar(500),
  assessment_type      varchar(50) NOT NULL,
  assessment_window    varchar(10) NOT NULL CHECK (assessment_window IN ('BOY', 'MOY', 'EOY')),
  school_id            uuid NOT NULL,
  school_name          varchar(255) NOT NULL,
  district_id          uuid NOT NULL,
  district_name        varchar(255) NOT NULL,
  uploaded_by_user_id  uuid NOT NULL,
  uploaded_by_name     varchar(255),
  uploaded_by_role     varchar(30),
  status               varchar(30) NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'validated_with_warnings',
                                           'processing', 'loaded', 'partially_loaded', 'failed')),
  validation_summary   jsonb,
  column_mapping       jsonb,
  previous_upload_id   uuid REFERENCES upload_records(upload_id),
  replacement_status   varchar(20) NOT NULL DEFAULT 'active'
                         CHECK (replacement_status IN ('active', 'superseded')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  submitted_at         timestamptz,
  loaded_at            timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- One active, non-failed upload per (type, school, window) (data-model.md).
CREATE UNIQUE INDEX uq_active_upload_per_window
  ON upload_records (assessment_type, school_id, assessment_window)
  WHERE replacement_status = 'active' AND status <> 'failed';

CREATE INDEX ix_upload_school_window ON upload_records (school_id, assessment_window);
CREATE INDEX ix_upload_district ON upload_records (district_id);
CREATE INDEX ix_upload_status ON upload_records (status);
CREATE INDEX ix_upload_created_desc ON upload_records (created_at DESC);

CREATE TABLE processing_jobs (
  job_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id       uuid NOT NULL REFERENCES upload_records(upload_id),
  stage           varchar(20) NOT NULL DEFAULT 'queued'
                    CHECK (stage IN ('queued', 'validating', 'validated', 'loading', 'complete', 'failed')),
  progress_pct    integer NOT NULL DEFAULT 0,
  rows_submitted  integer NOT NULL,
  rows_loaded     integer NOT NULL DEFAULT 0,
  rows_failed     integer NOT NULL DEFAULT 0,
  row_indexes     jsonb,
  error           jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

CREATE INDEX ix_jobs_upload ON processing_jobs (upload_id);
CREATE INDEX ix_jobs_stage ON processing_jobs (stage);

CREATE TABLE pipeline_events (
  event_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id            uuid NOT NULL REFERENCES upload_records(upload_id),
  job_id               uuid REFERENCES processing_jobs(job_id),
  event_type           varchar(40) NOT NULL
                         CHECK (event_type IN ('file_received', 'validation_started',
                                               'validation_completed', 'mapping_applied',
                                               'load_started', 'load_completed', 'load_failed',
                                               'upload_superseded')),
  status               varchar(20),
  processing_duration_ms integer,
  detail               jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_events_upload ON pipeline_events (upload_id, created_at);

CREATE TABLE submitted_rows (
  upload_id   uuid NOT NULL REFERENCES upload_records(upload_id),
  row_index   integer NOT NULL,
  job_id      uuid REFERENCES processing_jobs(job_id),
  loaded      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, row_index)
);

-- ── Warehouse-stub tables (behind WarehouseLoader) ────────────────────────────

CREATE TABLE assessment_records (
  record_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id                uuid NOT NULL REFERENCES upload_records(upload_id),
  assessment_source        varchar(50) NOT NULL,
  assessment_window        varchar(10) NOT NULL,
  assessment_date          date,
  student_id               varchar(255) NOT NULL,
  student_first_name       varchar(255),
  student_last_name        varchar(255),
  grade_level              varchar(10),
  school_id                uuid,
  school_name              varchar(255),
  district_id              uuid,
  district_name            varchar(255),
  overall_score            numeric(10,2),
  overall_score_type       varchar(30)
                             CHECK (overall_score_type IS NULL OR overall_score_type IN
                                    ('raw', 'scaled', 'percentile', 'fluency', 'accuracy', 'composite')),
  performance_level_native varchar(50),
  performance_level        varchar(30)
                             CHECK (performance_level IS NULL OR performance_level IN
                                    ('Above Benchmark', 'Near Benchmark', 'Below Benchmark')),
  metadata                 jsonb,
  superseded               boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- One active record per student per source per window (SC-007 default query).
CREATE UNIQUE INDEX uq_active_assessment_record
  ON assessment_records (assessment_source, student_id, school_id, assessment_window)
  WHERE superseded = false;

CREATE INDEX ix_records_upload ON assessment_records (upload_id);
CREATE INDEX ix_records_student_school ON assessment_records (student_id, school_id);
CREATE INDEX ix_records_source_window ON assessment_records (assessment_source, assessment_window);

CREATE TABLE assessment_subtests (
  subtest_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id     uuid NOT NULL REFERENCES assessment_records(record_id) ON DELETE CASCADE,
  measure_name  varchar(100) NOT NULL,
  measure_score numeric(10,2),
  measure_max   numeric(10,2),
  measure_type  varchar(30),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, measure_name)
);
