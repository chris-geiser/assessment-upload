import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import {
  getAssessmentConfig,
  mapColumns,
  toColumnMapping,
  validateRows,
  type SourceRow,
} from "@assessment/shared";
import { buildServer } from "../app.js";
import { MockAuthProvider } from "../adapters/auth-provider.js";
import { SCHOOLS, USERS } from "../adapters/seed-data.js";
import { getPool } from "../db/pool.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures");

function readCsv(name: string): { headers: string[]; rows: SourceRow[] } {
  const text = readFileSync(join(fixturesDir, name), "utf8").replace(/\n+$/, "");
  const lines = text.split("\n");
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const obj: SourceRow = {};
    headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    return obj;
  });
  return { headers, rows };
}

const FIXTURES = [
  "dibels-clean", "dibels-dirty", "dibels-renamed-headers",
  "iready-clean", "iready-dirty", "star-clean", "star-dirty",
  "vallss-clean", "vallss-dirty", "amira-clean", "amira-dirty",
];

let app: FastifyInstance;

async function insertUpload(type: string): Promise<string> {
  const s = SCHOOLS[0];
  const res = await getPool().query<{ upload_id: string }>(
    `INSERT INTO upload_records
       (filename, file_size_bytes, assessment_type, assessment_window,
        school_id, school_name, district_id, district_name, uploaded_by_user_id)
     VALUES ('f.csv',100,$1,'MOY',$2,$3,$4,$5,$6) RETURNING upload_id`,
    [type, s.schoolId, s.schoolName, s.districtId, s.districtName, USERS.SCHOOL_ADMIN.userId],
  );
  return res.rows[0].upload_id;
}

beforeEach(async () => {
  app = await buildServer({ authProvider: new MockAuthProvider("SCHOOL_ADMIN") });
  await app.ready();
});
afterEach(async () => {
  if (app) await app.close();
});

describe("P8: client and server engines agree on every fixture (T043)", () => {
  for (const base of FIXTURES) {
    it(`${base}: /validate response equals the client engine result`, async () => {
      const expected = JSON.parse(readFileSync(join(fixturesDir, "expected", `${base}.json`), "utf8"));
      const type = expected.assessmentType as string;
      const config = getAssessmentConfig(type)!;
      const { headers, rows } = readCsv(`${base}.csv`);
      const mapping = toColumnMapping(mapColumns(headers, config));

      const clientResult = validateRows(rows, mapping, config);

      const uploadId = await insertUpload(type);
      const res = await request(app.server)
        .post(`/api/uploads/${uploadId}/validate`)
        .send({ rows, columnMapping: mapping });

      expect(res.status).toBe(200);
      expect(res.body.summary).toEqual(clientResult.summary);
      expect(res.body.issues).toEqual(clientResult.issues);
    });
  }
});
