import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import type pg from "pg";
import { closePool, getPool } from "./pool.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

// Up-only SQL migration runner (constitution P3: no destructive migrations in MVP).
// Each numbered .sql file runs once inside a transaction and is recorded in
// _migrations so re-running is a no-op.
export async function runMigrations(pool: pg.Pool = getPool()): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const applied = new Set(
    (await pool.query<{ name: string }>("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    ),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      ran.push(file);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return ran;
}

// CLI entry: `npm run migrate -w apps/api`. pathToFileURL handles spaces in the path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then((ran) => {
      console.log(ran.length ? `Applied: ${ran.join(", ")}` : "No pending migrations.");
      return closePool();
    })
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
