import { beforeAll, afterAll, beforeEach } from "vitest";
import { runMigrations } from "../db/migrate.js";
import { getPool, closePool } from "../db/pool.js";

// Applied to every API test file (vitest setupFiles). Migrations are idempotent;
// each test starts from a truncated database. fileParallelism is disabled in the
// vitest config so files do not race on the shared test database.
const TABLES = [
  "assessment_subtests",
  "assessment_records",
  "submitted_rows",
  "pipeline_events",
  "processing_jobs",
  "upload_records",
];

beforeAll(async () => {
  await runMigrations(getPool());
});

beforeEach(async () => {
  await getPool().query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await closePool();
});
