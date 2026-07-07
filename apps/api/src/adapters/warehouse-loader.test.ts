import { describe, expect, it } from "vitest";
import { getPool } from "../db/pool.js";
import { PostgresStubLoader, type LoadContext } from "./warehouse-loader.js";
import { SCHOOLS, USERS } from "./seed-data.js";

const school = SCHOOLS[0];

async function insertUpload(): Promise<string> {
  const res = await getPool().query<{ upload_id: string }>(
    `INSERT INTO upload_records
       (filename, file_size_bytes, assessment_type, assessment_window,
        school_id, school_name, district_id, district_name, uploaded_by_user_id)
     VALUES ('dibels.csv', 100, 'DIBELS_8', 'MOY', $1,$2,$3,$4,$5)
     RETURNING upload_id`,
    [school.schoolId, school.schoolName, school.districtId, school.districtName, USERS.SCHOOL_ADMIN.userId],
  );
  return res.rows[0].upload_id;
}

function ctxFor(uploadId: string): LoadContext {
  return {
    uploadId,
    assessmentSource: "DIBELS_8",
    assessmentWindow: "MOY",
    schoolId: school.schoolId,
    schoolName: school.schoolName,
    districtId: school.districtId,
    districtName: school.districtName,
  };
}

describe("PostgresStubLoader", () => {
  it("loads core records with normalized performance level and subtests with config maxima", async () => {
    const loader = new PostgresStubLoader();
    const uploadId = await insertUpload();

    const res = await loader.loadRecords(ctxFor(uploadId), [
      {
        studentId: "1001",
        studentFirstName: "Ada",
        studentLastName: "Lovelace",
        gradeLevel: "1",
        overallScore: 50,
        overallScoreType: "composite",
        performanceLevelNative: "Core",
        subtests: [
          { measureName: "LNF", measureScore: 40 },
          { measureName: "ORF", measureScore: 50 },
        ],
      },
    ]);
    expect(res.loaded).toBe(1);

    const rec = await getPool().query(
      "SELECT performance_level, grade_level FROM assessment_records WHERE upload_id = $1",
      [uploadId],
    );
    expect(rec.rows[0].performance_level).toBe("Above Benchmark");
    expect(rec.rows[0].grade_level).toBe("1");

    const subs = await getPool().query(
      `SELECT measure_name, measure_max, measure_type FROM assessment_subtests
       ORDER BY measure_name`,
    );
    const lnf = subs.rows.find((r) => r.measure_name === "LNF")!;
    expect(Number(lnf.measure_max)).toBe(200);
    expect(lnf.measure_type).toBe("fluency");
  });

  it("supersedeRecords soft-deletes so default (superseded=false) queries exclude them (SC-007)", async () => {
    const loader = new PostgresStubLoader();
    const uploadId = await insertUpload();
    await loader.loadRecords(ctxFor(uploadId), [
      { studentId: "1001", performanceLevelNative: "Core", subtests: [] },
    ]);

    const before = await getPool().query(
      "SELECT count(*)::int AS n FROM assessment_records WHERE superseded = false",
    );
    expect(before.rows[0].n).toBe(1);

    const { superseded } = await loader.supersedeRecords(uploadId);
    expect(superseded).toBe(1);

    const after = await getPool().query(
      "SELECT count(*)::int AS n FROM assessment_records WHERE superseded = false",
    );
    expect(after.rows[0].n).toBe(0);

    // Still retrievable for audit.
    const audit = await getPool().query("SELECT count(*)::int AS n FROM assessment_records");
    expect(audit.rows[0].n).toBe(1);
  });
});
