import { pathToFileURL } from "node:url";
import { closePool, getPool } from "./pool.js";
import { runMigrations } from "./migrate.js";
import { DISTRICTS, SCHOOLS, USERS } from "../adapters/seed-data.js";

// Seeds reference districts/schools/users for the mock environment (T025). The mock
// AuthProvider resolves roles from the same fixed identities in seed-data.ts, so this
// script exists to make the identities inspectable in the database and to provide a
// stable base for manual smoke testing (quickstart.md). Idempotent.
export async function seed(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS seed_districts (
       district_id uuid PRIMARY KEY, district_name varchar(255) NOT NULL)`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS seed_schools (
       school_id uuid PRIMARY KEY, school_name varchar(255) NOT NULL,
       district_id uuid NOT NULL REFERENCES seed_districts(district_id))`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS seed_users (
       user_id uuid PRIMARY KEY, name varchar(255) NOT NULL, role varchar(30) NOT NULL,
       school_id uuid, district_id uuid)`,
  );

  for (const d of Object.values(DISTRICTS)) {
    await pool.query(
      `INSERT INTO seed_districts (district_id, district_name) VALUES ($1,$2)
       ON CONFLICT (district_id) DO UPDATE SET district_name = EXCLUDED.district_name`,
      [d.id, d.name],
    );
  }
  for (const s of SCHOOLS) {
    await pool.query(
      `INSERT INTO seed_schools (school_id, school_name, district_id) VALUES ($1,$2,$3)
       ON CONFLICT (school_id) DO UPDATE SET school_name = EXCLUDED.school_name`,
      [s.schoolId, s.schoolName, s.districtId],
    );
  }
  for (const u of Object.values(USERS)) {
    await pool.query(
      `INSERT INTO seed_users (user_id, name, role, school_id, district_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role`,
      [u.userId, u.name, u.role, u.schoolId ?? null, u.districtId ?? null],
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMigrations()
    .then(() => seed())
    .then(() => {
      console.log(
        `Seeded ${Object.keys(DISTRICTS).length} districts, ${SCHOOLS.length} schools, ${Object.keys(USERS).length} users.`,
      );
      return closePool();
    })
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
