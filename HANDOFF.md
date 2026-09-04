# Handoff: Assessment Data Upload prototype

Paste this file into a new chat to continue the work with full context. It covers what was built, the decisions behind it, the environment traps, and what is left. Everything here is as of September 3, 2026.

## The project in one paragraph

A spec-driven build of Ignite Reading's assessment-data upload flow for the School Portal: a coordinator uploads a CSV or Excel export from one of five assessment products (DIBELS 8, i-Ready, STAR, VALLSS, Amira), the system detects the type, maps columns to a canonical schema, validates every row with a specific message, lets the user fix errors inline, and submits clean rows for warehouse loading. It replaces a manual process costing about 360 analyst hours a year. Outcome ticket: OST-333, target 5 hours of analyst time saved per week.

## Where things live

- Code: https://github.com/chris-geiser/assessment-upload (public), local clone at `/Users/chrisgeiser/Claude/3rd Party Data Ingestion/assessment-ingest`
- Live demo: https://chris-geiser.github.io/assessment-upload/ (GitHub Pages, browser-only, synthetic data, redeploys on every push to `main`)
- Product docs in the repo: `ONE-PAGER.md` (exec summary, read first), `PRD.md` (product PRD on the Ignite template), `specs/assessment-upload-mvp/` (engineering spec package: constitution, spec, plan, data-model, contracts/api, research, tasks, quickstart), `docs/templates/` (one-pager and engineering-spec templates)
- Design references used: saved School Portal pages in `../School Portal/` (the `Students/` rostering wizard drove the stepper and shell), portal tokens extracted from its compiled CSS
- Writing rules: https://docs.google.com/document/d/1OCq9MpBbBo2u34Gy2io7R5EFI8aqpCUbVh2bAS3QG8E and PRD template https://docs.google.com/document/d/1UQA3nLNLxA5oqL3S6fgh7rvacuh6tdlSQzYX7EDviBk

## Architecture

npm-workspaces monorepo. `packages/shared` holds the config-driven engine (five assessment configs plus registry, detection, mapping, validation) and runs identically in the browser and on the server. `apps/api` is Fastify 4 with Postgres, a custom SQL migration runner, and three stubbed interfaces (WarehouseLoader, StorageAdapter, AuthProvider with a mock three-role session). `apps/web` is React 18 with Vite and Tailwind, an app-local component kit standing in for the private `@Ignite-Reading/component-kit`, and a `VITE_DEMO` mock API so the static build runs with no backend.

## What is built

Phases 1 to 5 of `specs/assessment-upload-mvp/tasks.md` are complete and committed: setup, the shared engine and fixtures with hand-authored censuses, database and adapters, component kit, and user stories 1 to 3 (upload and preview, column mapping, validate and fix inline). Beyond the spec: a demo-scoped adaptive submit (Submit, Submit with Warnings, Submit Clean Rows Only (N), disabled when only errors remain, with partial submit and a success screen), a sample-file dropdown in the demo, alignment to the portal shell and real design tokens, and four UX refinements from a component-kit review (Inter font, no off-palette gray or blue, sentence-case copy, visible focus tooltip for validation messages). 118 automated tests pass across the three workspaces.

## Decisions and judgment calls worth knowing

- Brand purple is `#573988` (the portal's purple-500), not the `#632E93` stated in the constitution, which is the SPARK scale. The app follows the real design system and the config notes the discrepancy.
- The data model's one-active-upload-per-window index made "create the record before processing" and "hold a duplicate pending a decision" impossible together. Migration 002 excludes `in_progress` rows from that uniqueness. The spec conflict is flagged in the PRD.
- The DIBELS ORF-Accuracy plus/minus 10 percent check needed a words-attempted input, so an optional `ORF_WORDS_ATTEMPTED` field was added, excluded from detection scoring.
- Detection scores measure fields only; identity fields look the same across every type and would erase the 15-point lead.
- Migrations use a small custom SQL runner instead of node-pg-migrate (a reversible research decision) to avoid TypeScript transpilation friction.
- Kit adoption was deferred on purpose: the component-kit repo is private and this environment cannot install it, and the prototype stays a demo, so the local kit remains and the port is productionization work.
- The flow is a single-page stage machine, not one route per step like the portal; converting to routes is a later choice.

## Environment traps that cost time

- Postgres drifted across sessions (11.4, later 18.4 via Homebrew). On this Mac, PG18 needs `export LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8` before `pg_ctl start` or it fails with "postmaster became multithreaded." No Docker is installed, so `docker-compose.yml` is spec-only.
- The dev and test databases lived in a session-scoped scratchpad and did not survive between sessions. Re-create with `initdb`, start with the LC_ALL env and `-p 5432 -k /tmp`, then `createdb assessment_ingest` and `createdb assessment_ingest_test`. API tests run migrations themselves; the dev DB needs `npm run migrate -w apps/api`.
- Run tests with `npm test` or `npm run test -w <workspace>`. `npx vitest --dir apps/api` from the root ignores the workspace vitest config and hits the dev database.
- Never `npm test | grep ...`: the pipe hides npm's exit code and a red suite looks green. One commit was pushed that way; the code was fine but the check was not.
- The browser-preview tool in that session was bound to a different project and could not run this monorepo, so visual verification was done through the test suite, built-CSS inspection, and curls against the live Pages URL.
- GitHub Pages required setting Settings, Pages, Source to "GitHub Actions" once; the workflow fails at `configure-pages` until then.

## What is left

Phase 6 (US4): server `POST /submit` with re-validation and 422/409 errors, an in-process job worker claiming `processing_jobs` with `FOR UPDATE SKIP LOCKED`, stage transitions with `pipeline_events` logging, a row-to-warehouse-record transformer, `GET /jobs/:id/status`, retry, and the 5-stage polling modal. It also needs two config additions across all five types: an overall-score field and a performance-level canonical field (whether district exports carry a level column is unknown). Phase 7 (US5): upload history table with pagination and detail view. Phase 8 (US6): duplicate detection dialog, replace-decision route, supersession chain, lineage in history. Phase 9: config-extension test (SC-005), accessibility sweep, lint rule banning raw buttons and tables outside the kit, final gates. Deferred beyond that: real kit adoption, the `data-grid.css` restyle (hatched error markers, sticky student column, error popover), a hosted backend if stakeholders should click a real pipeline.

## Open questions

Scrum team (candidates: Chihuahua or Moorhen in the Platform program, Démarche in Shared Services), the exact OST-333 outcome wording (the Jira connector needed auth that could not run), and whether district exports include a performance-level column.

## How to run it

```bash
cd "/Users/chrisgeiser/Claude/3rd Party Data Ingestion/assessment-ingest"
export LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
# start Postgres per the traps section, then:
npm install
npm run migrate && npm run seed
npm run dev        # api :3001, web :5173
npm test           # all workspaces
```

## Working rules that held up

Plan and get approval before implementing. Ask instead of assuming; mark gaps [TBD] or [DATA NEEDED]. Be blunt about what is wrong and name the cost of every recommendation. Apply the writing rules to every document (no em dashes, lead with the decision, numbers over adjectives, sentence case). Commit per phase with a passing checkpoint, and verify the exit code, not the grep.
