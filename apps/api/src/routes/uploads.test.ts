import { rm } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { MockAuthProvider } from "../adapters/auth-provider.js";
import { LocalFsStorage } from "../adapters/storage-adapter.js";
import { SCHOOLS } from "../adapters/seed-data.js";
import { getPool } from "../db/pool.js";

const storageDir = ".test-storage-uploads";
const lincoln = SCHOOLS[0].schoolId; // SCHOOL_ADMIN's own school
const washington = SCHOOLS[1].schoolId; // another school in the district

const DIBELS_HEADERS = [
  "Student ID", "First Name", "Last Name", "School", "Grade",
  "LNF", "PSF", "NWF-CLS", "NWF-WRC", "WRF", "ORF", "ORF-Accuracy", "MAZE",
];

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildServer({
    authProvider: new MockAuthProvider("SCHOOL_ADMIN"),
    storage: new LocalFsStorage(storageDir),
  });
  await app.ready();
});

afterAll(async () => {
  if (app) await app.close();
  await rm(storageDir, { recursive: true, force: true });
});

function post(meta: Record<string, unknown>, opts: { filename?: string; content?: string } = {}) {
  return request(app.server)
    .post("/api/uploads")
    .field("meta", JSON.stringify(meta))
    .attach("file", Buffer.from(opts.content ?? "Student ID,LNF\n1001,40\n"), {
      filename: opts.filename ?? "dibels.csv",
      contentType: "text/csv",
    });
}

const baseMeta = {
  filename: "dibels.csv",
  fileSizeBytes: 40,
  rowCount: 1,
  columnCount: DIBELS_HEADERS.length,
  headers: DIBELS_HEADERS,
  assessmentWindow: "MOY",
  schoolId: lincoln,
};

describe("POST /api/uploads", () => {
  it("201: creates the record before processing, auto-detects, returns duplicate=null", async () => {
    const res = await post(baseMeta);
    expect(res.status).toBe(201);
    expect(res.body.uploadId).toBeTruthy();
    expect(res.body.detection.detected).toBe("DIBELS_8");
    expect(res.body.detection.ambiguous).toBe(false);
    expect(res.body.duplicate).toBeNull();

    const row = await getPool().query(
      "SELECT status, storage_key, assessment_type FROM upload_records WHERE upload_id = $1",
      [res.body.uploadId],
    );
    expect(row.rows[0].status).toBe("in_progress");
    expect(row.rows[0].storage_key).toMatch(/^uploads\//);
    expect(row.rows[0].assessment_type).toBe("DIBELS_8");
  });

  it("400 FILE_TOO_LARGE when the declared size exceeds 50MB", async () => {
    const res = await post({ ...baseMeta, fileSizeBytes: 60 * 1024 * 1024 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("400 UNSUPPORTED_TYPE for a non-spreadsheet file", async () => {
    const res = await post({ ...baseMeta, filename: "notes.txt" }, { filename: "notes.txt" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNSUPPORTED_TYPE");
  });

  it("400 EMPTY_FILE when there are no headers", async () => {
    const res = await post({ ...baseMeta, headers: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("EMPTY_FILE");
  });

  it("403 SCHOOL_SCOPE when uploading for a school the user does not administer", async () => {
    const res = await post({ ...baseMeta, schoolId: washington });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("SCHOOL_SCOPE");
  });

  it("returns a duplicate match when a prior active upload exists for the same window", async () => {
    await post(baseMeta);
    const res = await post(baseMeta);
    expect(res.status).toBe(201);
    expect(res.body.duplicate).not.toBeNull();
    expect(res.body.duplicate.filename).toBe("dibels.csv");
  });
});
