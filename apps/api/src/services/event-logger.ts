import type pg from "pg";
import { getPool } from "../db/pool.js";

export type PipelineEventType =
  | "file_received"
  | "validation_started"
  | "validation_completed"
  | "mapping_applied"
  | "load_started"
  | "load_completed"
  | "load_failed"
  | "upload_superseded";

export interface LogEventInput {
  uploadId: string;
  jobId?: string | null;
  eventType: PipelineEventType;
  status?: string;
  processingDurationMs?: number;
  detail?: Record<string, unknown>;
}

// Append-only structured observability log (FR-017). Never updated or deleted.
export async function logEvent(
  input: LogEventInput,
  pool: pg.Pool = getPool(),
): Promise<void> {
  await pool.query(
    `INSERT INTO pipeline_events
       (upload_id, job_id, event_type, status, processing_duration_ms, detail)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      input.uploadId,
      input.jobId ?? null,
      input.eventType,
      input.status ?? null,
      input.processingDurationMs ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
    ],
  );
}
