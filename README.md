# Assessment Data Upload MVP

Greenfield web app for the partner assessment-upload flow: upload → auto-detect →
map → validate → inline fix → submit → track → history, with dedup/versioning. A
shared TypeScript validation engine and assessment config module run identically on
client (speed) and server (truth).

See `specs/assessment-upload-mvp/` for the constitution, spec, plan, data model, and
API contract that govern this codebase.

## Layout

```
packages/shared   assessment configs, validation engine, canonical types (client + server)
apps/api          Fastify 4 API, Postgres, in-process job worker, local stub adapters
apps/web          React 18 + Vite + Tailwind, app-local component kit
fixtures          clean/dirty test files per assessment type + expected censuses
```

## Run

```bash
docker compose up -d                    # Postgres 16 on :5432 (see note below)
npm install
npm run migrate -w apps/api
npm run seed -w apps/api                # mock users, schools, districts
npm run dev                             # api on :3001, web on :5173
npm test                                # all workspaces
```

### Local Postgres without Docker

This machine ships Postgres 11 binaries (no Docker). Everything the schema uses
(partial unique indexes, JSONB, `FOR UPDATE SKIP LOCKED`, `gen_random_uuid()` via the
`pgcrypto` extension) works on 11. `docker-compose.yml` still declares Postgres 16 to
match the spec for environments that have Docker. To run locally without Docker:

```bash
initdb -D ./pgdata -U postgres --auth=trust
pg_ctl -D ./pgdata -o "-p 5432 -k /tmp" start
createdb -h 127.0.0.1 -U postgres assessment_ingest
createdb -h 127.0.0.1 -U postgres assessment_ingest_test
```

Set `DATABASE_URL=postgres://postgres@127.0.0.1:5432/assessment_ingest` in
`apps/api/.env` (copy from `.env.example`).
