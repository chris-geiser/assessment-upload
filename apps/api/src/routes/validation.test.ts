import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { MockAuthProvider } from "../adapters/auth-provider.js";
import { SCHOOLS, USERS } from "../adapters/seed-data.js";
import { getPool } from "../db/pool.js";

let app: FastifyInstance;

async function insertUpload(schoolIndex: number, type = "DIBELS_8"): Promise<string> {
  const s = SCHOOLS[schoolIndex];
  const res = await getPool().query<{ upload_id: string }>(
    `INSERT INTO upload_records
       (filename, file_size_bytes, assessment_type, assessment_window,
        school_id, school_name, district_id, district_name, uploaded_by_user_id)
     VALUES ('d.csv',100,$1,'MOY',$2,$3,$4,$5,$6) RETURNING upload_id`,
    [type, s.schoolId, s.schoolName, s.districtId, s.districtName, USERS.SCHOOL_ADMIN.userId],
  );
  return res.rows[0].upload_id;
}

const CLEAN_ROW = {
  student_id: "1001", student_first_name: "Ada", student_last_name: "Lovelace",
  school_name: "Lincoln", grade: "1",
  LNF: "40", PSF: "35", NWF_CLS: "30", NWF_WRC: "12", WRF: "25", ORF: "50", ORF_ACC: "95",
};
const FULL_MAPPING = Object.fromEntries(Object.keys(CLEAN_ROW).map((k) => [k, k]));

beforeEach(async () => {
  app = await buildServer({ authProvider: new MockAuthProvider("SCHOOL_ADMIN") });
  await app.ready();
});
afterEach(async () => {
  if (app) await app.close();
});

describe("POST /api/uploads/:uploadId/validate", () => {
  it("200: returns the summary and issues for the mapped rows", async () => {
    const uploadId = await insertUpload(0);
    const res = await request(app.server)
      .post(`/api/uploads/${uploadId}/validate`)
      .send({ rows: [CLEAN_ROW, { ...CLEAN_ROW, student_id: "", ORF: "999" }], columnMapping: FULL_MAPPING });
    expect(res.status).toBe(200);
    expect(res.body.summary.totalRows).toBe(2);
    expect(res.body.summary.errorRows).toBe(1);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it("422 REQUIRED_FIELDS_UNMAPPED names the missing fields", async () => {
    const uploadId = await insertUpload(0);
    const { student_id: _omit, ...partial } = FULL_MAPPING;
    void _omit;
    const res = await request(app.server)
      .post(`/api/uploads/${uploadId}/validate`)
      .send({ rows: [CLEAN_ROW], columnMapping: partial });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("REQUIRED_FIELDS_UNMAPPED");
    expect(res.body.missingFields).toContain("student_id");
  });

  it("404 when the upload does not exist", async () => {
    const res = await request(app.server)
      .post(`/api/uploads/00000000-0000-0000-0000-000000000000/validate`)
      .send({ rows: [], columnMapping: FULL_MAPPING });
    expect(res.status).toBe(404);
  });

  it("403 when validating an upload for a school the user cannot access", async () => {
    const uploadId = await insertUpload(1); // Washington; SCHOOL_ADMIN owns Lincoln
    const res = await request(app.server)
      .post(`/api/uploads/${uploadId}/validate`)
      .send({ rows: [CLEAN_ROW], columnMapping: FULL_MAPPING });
    expect(res.status).toBe(403);
  });
});
