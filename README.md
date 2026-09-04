# Assessment Data Upload MVP

Greenfield web app for the partner assessment-upload flow: upload → auto-detect →
map → validate → inline fix → submit → track → history, with dedup/versioning. A
shared TypeScript validation engine and assessment config module run identically on
client (speed) and server (truth).

**Live demo:** https://chris-geiser.github.io/assessment-upload/ (browser-only, synthetic
data, one-click sample files; redeploys on every push to `main`).

## Documents

Read them in this order. Each has one audience.

- **[ONE-PAGER.md](ONE-PAGER.md)**, for SLT and teams outside the build. A one-page
  decision summary: the decision being asked (fund the remaining server pipeline,
  history, and replace phases and assign a team, or keep the prototype as a demo), the
  problem with its number (about 360 analyst hours a year spent hand-loading files from
  five assessment products), the bet, the outcome (OST-333, 5 hours of analyst time
  saved per week), the cost, the risks, what we are not doing, and current status.
- **[PRD.md](PRD.md)**, the product requirements document on the Ignite PRD template.
  Covers the problem, the proposed solution and the approach behind it (one config-driven
  engine run on client and server, infrastructure behind swappable interfaces), goals,
  success metrics, and target users. Its data-model section explains how one system
  handles five formats: a per-type config registry, detection at 30% field match with a
  15-point lead, column mapping by exact then synonym then fuzzy match, and a two-table
  warehouse (a core record per student plus per-measure subtest rows). The user stories
  carry a status of Done, Demo, or Remaining so the document doubles as the build
  tracker.
- **[HANDOFF.md](HANDOFF.md)**, for whoever continues the work, human or agent. A
  full-context brief: what is built, the judgment calls and why (the brand purple is
  `#573988` not the constitution's `#632E93`; the one-active-upload index was reconciled
  in migration 002; the ORF-Accuracy check needed a helper field; component-kit adoption
  is deferred because the kit repo is private and this stays a demo), the environment
  traps that cost time, what is left in Phases 6 to 9, open questions, and run commands.
- **[specs/assessment-upload-mvp/](specs/assessment-upload-mvp/)**, the engineering spec
  package the build followed: constitution (non-negotiables), spec (stories with
  Given/When/Then scenarios), plan, data model, API contract, research decisions, phased
  tasks with test gates, and quickstart.

## Layout

```
packages/shared   assessment configs, validation engine, canonical types (client + server)
apps/api          Fastify 4 API, Postgres, in-process job worker, local stub adapters
apps/web          React 18 + Vite + Tailwind, app-local component kit, VITE_DEMO mock API
fixtures          clean/dirty test files per assessment type + expected censuses
specs             engineering spec package (see Documents)
.github/workflows GitHub Pages deploy of the browser-only demo
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

Run tests with `npm test` or `npm run test -w <workspace>`. Running `npx vitest` from the
repo root skips the workspace config and points the API tests at the dev database.

### Local Postgres without Docker

The development Mac has no Docker and has run Postgres 11 and 18 across sessions.
Everything the schema uses (partial unique indexes, JSONB, `FOR UPDATE SKIP LOCKED`,
`gen_random_uuid()` via the `pgcrypto` extension) works on both. `docker-compose.yml`
declares Postgres 16 to match the spec for environments that have Docker. To run locally:

```bash
export LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8   # Postgres 18 on macOS fails to start without a locale
initdb -D ./pgdata -U postgres --auth=trust
pg_ctl -D ./pgdata -o "-p 5432 -k /tmp" start
createdb -h 127.0.0.1 -U postgres assessment_ingest
createdb -h 127.0.0.1 -U postgres assessment_ingest_test
```

Set `DATABASE_URL=postgres://postgres@127.0.0.1:5432/assessment_ingest` in
`apps/api/.env` (copy from `.env.example`). The API test suite migrates its own database.

## Demo build

The hosted demo has no backend. `VITE_DEMO=true` swaps in a browser mock for the
session and upload endpoints (`apps/web/src/demo/mockApi.ts`); the validation engine
already runs client-side. `npm run build:pages -w apps/web` produces the static build,
and `.github/workflows/deploy-pages.yml` publishes it.
