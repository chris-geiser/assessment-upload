import type pg from "pg";
import { getAssessmentConfig, normalizePerformanceLevel } from "@assessment/shared";
import { getPool } from "../db/pool.js";

export interface SubtestInput {
  measureName: string; // canonical field name
  measureScore: number | null;
}

export interface RecordInput {
  studentId: string;
  studentFirstName?: string | null;
  studentLastName?: string | null;
  gradeLevel?: string | null; // already normalized ("K", "1"...)
  assessmentDate?: string | null;
  overallScore?: number | null;
  overallScoreType?: string | null;
  performanceLevelNative?: string | null;
  metadata?: Record<string, unknown>;
  subtests: SubtestInput[];
}

export interface LoadContext {
  uploadId: string;
  assessmentSource: string; // config id
  assessmentWindow: string;
  schoolId: string;
  schoolName: string;
  districtId: string;
  districtName: string;
}

// P2/D3: the only writer to the warehouse tables. Production swaps in a
// Snowflake/Stitch implementation of this interface (one-file change).
export interface WarehouseLoader {
  loadRecords(ctx: LoadContext, records: RecordInput[]): Promise<{ loaded: number }>;
  supersedeRecords(uploadId: string): Promise<{ superseded: number }>;
}

export class PostgresStubLoader implements WarehouseLoader {
  constructor(private readonly pool: pg.Pool = getPool()) {}

  async loadRecords(ctx: LoadContext, records: RecordInput[]): Promise<{ loaded: number }> {
    const config = getAssessmentConfig(ctx.assessmentSource);
    const client = await this.pool.connect();
    let loaded = 0;
    try {
      await client.query("BEGIN");
      for (const rec of records) {
        const performanceLevel = config
          ? normalizePerformanceLevel(config, rec.performanceLevelNative ?? null)
          : null;

        const inserted = await client.query<{ record_id: string }>(
          `INSERT INTO assessment_records
             (upload_id, assessment_source, assessment_window, assessment_date,
              student_id, student_first_name, student_last_name, grade_level,
              school_id, school_name, district_id, district_name,
              overall_score, overall_score_type, performance_level_native, performance_level, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING record_id`,
          [
            ctx.uploadId, ctx.assessmentSource, ctx.assessmentWindow, rec.assessmentDate ?? null,
            rec.studentId, rec.studentFirstName ?? null, rec.studentLastName ?? null, rec.gradeLevel ?? null,
            ctx.schoolId, ctx.schoolName, ctx.districtId, ctx.districtName,
            rec.overallScore ?? null, rec.overallScoreType ?? null,
            rec.performanceLevelNative ?? null, performanceLevel,
            rec.metadata ? JSON.stringify(rec.metadata) : null,
          ],
        );
        const recordId = inserted.rows[0].record_id;

        for (const sub of rec.subtests) {
          const field = config?.canonicalFields.find((f) => f.name === sub.measureName);
          await client.query(
            `INSERT INTO assessment_subtests
               (record_id, measure_name, measure_score, measure_max, measure_type)
             VALUES ($1,$2,$3,$4,$5)`,
            [
              recordId,
              field?.label ?? sub.measureName,
              sub.measureScore,
              field?.max ?? null,
              field?.measureType ?? null,
            ],
          );
        }
        loaded += 1;
      }
      await client.query("COMMIT");
      return { loaded };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Soft-delete: mark an upload's records superseded (FR-021). Default queries
  // filter superseded = false (SC-007). Never physically deletes (P3).
  async supersedeRecords(uploadId: string): Promise<{ superseded: number }> {
    const res = await this.pool.query(
      `UPDATE assessment_records
         SET superseded = true, updated_at = now()
       WHERE upload_id = $1 AND superseded = false`,
      [uploadId],
    );
    return { superseded: res.rowCount ?? 0 };
  }
}
