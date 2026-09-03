# PRD: Assessment Data Upload (Prototype)

**Product Manager/Engineer:** Chris Geiser (prototype build by Claude)

**Scrum Team:** [TBD, likely Chihuahua or Moorhen (Platform program), or Démarche (Shared Services)]

**Prototype:** https://chris-geiser.github.io/assessment-upload/ · **Code:** https://github.com/chris-geiser/assessment-upload

We built the P1 core of an assessment-upload flow (upload, detect, map, validate, fix inline) and it runs as a click-through prototype with 118 passing tests. The decision this document asks for: whether to build the remaining server pipeline, upload history, and replace/dedup (Phases 6 to 8), and whether to stand up a hosted backend so stakeholders exercise a real warehouse load or keep the browser-stubbed demo. This PRD fills the Ignite template; the data model and build status sit as subsections under Proposed Solution and User Stories because you asked for both.

## The Problem

School districts assess early literacy with several products, and their data reaches us by hand today. A coordinator exports a file from the assessment platform, emails it, and an Ignite analyst cleans and loads it, which costs about 4 hours per district per assessment cycle and 360+ analyst hours per year and grows with each new district. The column variability is the constraint: every vendor names and shapes its columns differently, so there is no single format to validate against.

The five products in scope: DIBELS 8th Edition (Dynamic Indicators of Basic Early Literacy Skills; Amplify / mCLASS), i-Ready Diagnostic (Curriculum Associates), STAR Early Literacy / Reading (Renaissance), VALLSS K-3 (Virginia's K-3 literacy screener; Virginia Literacy Partnerships / UVA), and Amira Learning (Istation / HMH).

Acronyms used below: SIS (Student Information System), BOY/MOY/EOY (Beginning / Middle / End of Year benchmark windows), ORF (Oral Reading Fluency), CSV/XLSX (comma-separated / Excel files), EAV (Entity-Attribute-Value, a key-value storage pattern), WCAG (Web Content Accessibility Guidelines).

## Proposed Solution

A self-serve upload flow in the school partner portal. A coordinator selects a benchmark window, uploads a CSV or Excel file, and the system detects the assessment type, maps columns to a canonical schema, validates every row with specific messages, allows inline fixes in the browser, and submits clean rows for loading with status tracking, upload history, and versioned replacement. The flow replaces the manual Google Drive path.

The design rests on config-driven behavior and a shared engine. One validation engine and one config file per assessment type run in the browser for feedback and on the server for truth, and the server re-validates every row before loading. Assessment-specific behavior (canonical fields, synonyms, score ranges, grade rules, level mappings) lives in configuration, so a new assessment type is a new config file, not a code change. Warehouse loading, file storage, and authentication each sit behind an interface with a local stub, so each production swap is a bounded change to one file. The cost of the shared-engine choice is a JavaScript/TypeScript stack end to end; a backend in another language would mean maintaining two copies of the validation rules.

### Goals

- **OST goal:** OST-333 (https://ignite-reading.atlassian.net/browse/OST-333). [Confirm the outcome wording from the ticket.] Working assumption: removing the manual ingestion step gets more districts' data in faster, so more student results are usable each term.
- **Operational goal:** move the 360+ analyst hours/year spent cleaning and loading files toward self-serve.

### Success Metrics

Prototype-verifiable targets, all currently met on the fixture set:

- A coordinator takes a clean 250-row file from first click to submitted in under 15 minutes, with no wait beyond validation (10s cap) and pipeline processing (SC-001).
- All five types auto-detect on fixtures; an ambiguous file prompts a manual pick rather than guessing (SC-002).
- A 10,000-row file validates and renders within 10 seconds (SC-003); an inline edit re-validates within 1 second (SC-004).
- A sixth assessment type goes in by config alone (one config entry, one fixture), zero application-code changes, proven by an automated test (SC-005).
- Every validation message names the row, field, and value (SC-006).
- After a replacement upload, default warehouse queries return only the new records while superseded records stay retrievable for audit (SC-007).

Business outcome target: 5 hours of analyst time saved per week.

### Target Users

School System Admin (primary; uploads and fixes files for their school), District Admin (same, scoped to all schools in the district), and Ignite Admin (sees everything, supports and troubleshoots). Internal stakeholders: Data Engineering (owns warehouse loading and new-type configs), CX (upload support), and Partnerships.

### Data Model for Multiple Assessment Types and Matching

One system handles five formats through configuration plus a two-table warehouse shape.

**Assessment configuration (the type registry).** One typed config per assessment, keyed by a versioned id (for example `DIBELS_8`). Each config declares:

| Field | Purpose |
|---|---|
| `canonicalFields` | The normalized schema: `{ name, label, type, category (student or measure), required?, min?, max?, measureType? }` |
| `synonymMap` | Source header to canonical field (`"LNF - Fall Score"` to `LNF`, `"LASID"` to `student_id`) |
| `requiredByGrade` | Measures expected per grade (Grade 1 DIBELS expects LNF, PSF, NWF-CLS, NWF-WRC, WRF, ORF, ORF-Accuracy) |
| `performanceLevels` | Native level to normalized level (`Core` to `Above Benchmark`) |
| `crossFieldChecks` | Consistency rules (ORF-Accuracy within 10 points of words correct over words attempted) |

A sixth type is a new file of that shape plus one fixture. No service, component, or database change.

**Matching (file to canonical).** Detection scores each type by how many of its measure fields the file's headers match through the synonym map; a type auto-detects at 30% or more of its measure fields matched and a 15-point lead over the runner-up, otherwise the user picks from a confidence-ranked list. Column mapping resolves each canonical field by first match: exact, then synonym, then fuzzy (Fuse.js, similarity 0.70 or higher, shown Medium at 0.85+ and Low at 0.70 to 0.85), then light heuristics. Identity fields (student id, names) map only by exact or synonym, never by fuzzy, so a student never attaches silently to the wrong column. Grades normalize (`"1st"` to `1`, `"Kindergarten"` to `K`) and native performance levels normalize to a common Above / Near / Below Benchmark set.

**Warehouse storage (one shape for all types).** Validated rows load into two tables so a single schema holds every assessment. `assessment_records` holds one row per student per type per window, with identity, an `overall_score` and its type, and the normalized `performance_level`; a partial unique index keeps one active record per (source, student, school, window), and a `superseded` flag soft-deletes replaced records so default queries skip them while audit can still reach them. `assessment_subtests` holds the per-measure detail as EAV rows (`measure_name`, `measure_score`, `measure_max`, `measure_type`), which is what lets DIBELS's eight fluency measures and STAR's scaled and percentile scores share one schema. That EAV choice trades typed per-measure columns for flexibility: reading one type's measures means filtering rows, not selecting columns.

**Application tables (audit and pipeline).** `upload_records` (one per submission attempt, created before any processing and never hard-deleted), `processing_jobs` (async submit units), `pipeline_events` (append-only stage log), and `submitted_rows` (which row indexes were sent, so resubmission sends only new rows). No destructive deletes anywhere.

**Two config additions Phase 6 needs** (open items): a designated overall-score field per type (which measure becomes `overall_score`) and a performance-level canonical field (so the native level in the file can be mapped and normalized). Both are config-only and keep the config-driven rule intact; the cost is touching all five configs, and whether districts include a performance-level column in their exports is currently unknown, so we defer the performance-level field until we confirm it against real files.

## User Stories + Requirements

Status: **Done** (built and tested), **Demo** (client-side in the prototype, server piece pending), **Remaining** (planned, not built).

1. Upload and preview a file. As a coordinator, I want to upload a file and see it recognized before I continue. **Done.** (a) Accept .csv/.xlsx/.xls up to 50MB via drag-drop or browse, with specific rejections for oversized, unsupported, and empty files. (b) Auto-detect the type per the 30%/15% rule, allow manual override, prompt on ambiguity. (c) Create a persistent upload record before any processing; store the raw file unmodified.
2. Review and adjust column mapping. As a coordinator, I want to confirm and fix how my columns map before validating. **Done.** (a) Auto-map with High/Medium/Low confidence shown. (b) Group fields into Student Info and Assessment Measures, allow per-field override and Reset to Auto-Mapped. (c) Block advancing until required fields are mapped, naming the missing fields.
3. Validate and fix errors inline. As a coordinator, I want to see what is wrong and fix it in the browser. **Done.** (a) Validate up to 10,000 rows within 10 seconds; show error/warning/clean counts with row and cell highlighting and focus-accessible messages. (b) Edit a cell and re-validate that row within 1 second; download a validation report. (c) Re-validate on both client and server with the same rules before loading.
4. Submit and track pipeline progress. As a coordinator, I want to submit clean rows, watch them load, and submit the good rows while I fix the rest. **Demo for the adaptive submit control; Remaining for the server pipeline (Phase 6).** (a) Adaptive submit (Submit / Submit with Warnings / Submit Clean Rows Only (N) / disabled when only errors remain). **Done, client-side.** (b) Server re-validates, creates an async job, and moves it Upload to Validate to Validated to Loading to Complete with status refreshed at least every 5 seconds. **Remaining.** (c) Partial submit and resubmission send only not-yet-submitted rows; a failure shows a plain-language error with retry. **Remaining.**
5. Upload history and status. As a coordinator, I want to see my past uploads and their live status. **Remaining (Phase 7).** History table scoped to the user's school(s), paginated at 20, with live status badges and a per-upload detail view.
6. Replace a previous upload. As a coordinator, I want to upload a corrected file without creating duplicates. **Remaining (Phase 8).** Detect a duplicate by school, type, and window within a configurable window, confirm before replacing, soft-delete the superseded records, and show lineage in history.

Built versus left: Phases 1 to 5 are complete (the P1 core plus a client-side demo submit, 118 automated tests passing). Remaining is Phase 6 (server submit and async pipeline), Phase 7 (upload history), Phase 8 (replace/dedup), and Phase 9 (accessibility sweep, config-extension proof, final gates). The backend seams those phases need (warehouse loader, dedup query, event logging, the job tables) are already in place, so the remaining work is the worker, two route files, two screens, and a row-to-record transformer.

## User Flows / UX Notes

The flow is a four-step wizard modeled on the School Portal rostering pattern (numbered-circle stepper, left sidebar, per-step heading): Upload, then Map, then Validate, then Submit. A coordinator selects a benchmark window, drops a file (or, in the demo, picks a bundled sample), reviews the auto-detected type and confirms the mapping, then works the validation grid where red cells are errors that block a row and yellow cells are warnings that do not, and edits recount live. Submit adapts to the data and ends on a success confirmation.

- Live prototype: https://chris-geiser.github.io/assessment-upload/ runs in the browser with synthetic data; the sample-file dropdown loads real fixtures with one click.
- UI reference: the saved School Portal `Students` rostering flow; visual tokens (purple #573988, headings #27004b, mint, pink-red, and gold status colors) match the IRDL system pulled from the portal CSS.
- Accessibility: built to WCAG 2.1 AA (focus indicators, keyboard-accessible messages, semantic roles).
- Prototype limitation: the hosted demo stubs the backend, so Submit shows a client-side success rather than a real warehouse load. Exercising the real pipeline needs the backend and Postgres running, and a hosted backend if stakeholders should click the live load.

## Out of Scope

The CX operations dashboard and any data-explorer or reporting views on loaded data, email or push notifications of upload status, the production warehouse integration (Snowflake/Stitch/dbt), real portal authentication (Sphinx Gate), cloud file storage with lifecycle rules, mobile layouts (desktop only for the initial release), and automated PII-exposure auditing (a process item, not code).
