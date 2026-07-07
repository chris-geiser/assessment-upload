import type pg from "pg";
import { getPool } from "./pool.js";

export interface NewUploadRecord {
  filename: string;
  fileSizeBytes: number;
  rowCount: number | null;
  columnCount: number | null;
  assessmentType: string;
  assessmentWindow: string;
  schoolId: string;
  schoolName: string;
  districtId: string;
  districtName: string;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedByRole: string;
}

export interface UploadRow {
  upload_id: string;
  filename: string;
  file_size_bytes: number;
  row_count: number | null;
  column_count: number | null;
  storage_key: string | null;
  assessment_type: string;
  assessment_window: string;
  school_id: string;
  school_name: string;
  district_id: string;
  district_name: string;
  uploaded_by_user_id: string;
  uploaded_by_name: string | null;
  uploaded_by_role: string | null;
  status: string;
  validation_summary: unknown;
  column_mapping: unknown;
  previous_upload_id: string | null;
  replacement_status: string;
  created_at: string;
  submitted_at: string | null;
  loaded_at: string | null;
  updated_at: string | null;
}

export interface DuplicateMatch {
  existingUploadId: string;
  uploadedAt: string;
  rowCount: number | null;
  filename: string;
}

export async function insertUploadRecord(
  input: NewUploadRecord,
  pool: pg.Pool = getPool(),
): Promise<string> {
  const res = await pool.query<{ upload_id: string }>(
    `INSERT INTO upload_records
       (filename, file_size_bytes, row_count, column_count, assessment_type,
        assessment_window, school_id, school_name, district_id, district_name,
        uploaded_by_user_id, uploaded_by_name, uploaded_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING upload_id`,
    [
      input.filename, input.fileSizeBytes, input.rowCount, input.columnCount, input.assessmentType,
      input.assessmentWindow, input.schoolId, input.schoolName, input.districtId, input.districtName,
      input.uploadedByUserId, input.uploadedByName, input.uploadedByRole,
    ],
  );
  return res.rows[0].upload_id;
}

export async function setStorageKey(
  uploadId: string,
  storageKey: string,
  pool: pg.Pool = getPool(),
): Promise<void> {
  await pool.query(
    `UPDATE upload_records SET storage_key = $2, updated_at = now() WHERE upload_id = $1`,
    [uploadId, storageKey],
  );
}

// A prior non-failed active upload for the same window (FR-020, 90-day window).
export async function findDuplicate(
  params: {
    assessmentType: string;
    schoolId: string;
    assessmentWindow: string;
    excludeUploadId: string;
    windowDays: number;
  },
  pool: pg.Pool = getPool(),
): Promise<DuplicateMatch | null> {
  const res = await pool.query<UploadRow>(
    `SELECT * FROM upload_records
     WHERE assessment_type = $1 AND school_id = $2 AND assessment_window = $3
       AND upload_id <> $4
       AND replacement_status = 'active'
       AND status <> 'failed'
       AND created_at > now() - ($5 || ' days')::interval
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.assessmentType, params.schoolId, params.assessmentWindow, params.excludeUploadId, params.windowDays],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    existingUploadId: row.upload_id,
    uploadedAt: row.created_at,
    rowCount: row.row_count,
    filename: row.filename,
  };
}

export async function getUpload(
  uploadId: string,
  pool: pg.Pool = getPool(),
): Promise<UploadRow | null> {
  const res = await pool.query<UploadRow>(
    `SELECT * FROM upload_records WHERE upload_id = $1`,
    [uploadId],
  );
  return res.rows[0] ?? null;
}
