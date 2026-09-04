# Feature Specification: Assessment Data Upload MVP

**Created**: 2026-07-07
**Status**: Approved for implementation
**Source of truth**: PRD v1.3 (`roe-assessment-data-ingestion/01-prd-v1.3.md`). This spec covers PRD user stories US-1, US-2, US-3, US-4, US-5, and US-10. PRD US-6/US-7 ship only as the minimal warehouse stub and event logging needed by this scope. PRD US-8 (CX Dashboard) and US-9 (staging table demo) are out of scope. Story numbering below is local to this spec; PRD IDs are cross-referenced per story.

## Overview

District coordinators upload assessment data files (CSV/Excel) through a school partner portal. The system auto-detects the assessment type (DIBELS 8th Edition, i-Ready Diagnostic, STAR Early Literacy/Reading, VALLSS K-3, or Amira Learning), maps columns to a canonical schema, validates every row with specific error messages, lets users fix simple errors inline in the browser, and submits clean rows for warehouse loading with real-time status tracking, upload history, and versioned replacement of prior uploads.

This replaces a manual Google Drive process that consumes 4 hours per district per cycle and 360+ analyst hours per year.

## User Scenarios & Testing

### User Story 1 - Upload and Preview a File (Priority: P1) [PRD US-1]

A district coordinator selects a benchmark period, uploads a CSV or Excel file, and sees a preview with the auto-detected assessment type before continuing.

**Why this priority**: Entry point for everything. Without upload and detection there is no product.

**Independent Test**: Upload each of the 5 fixture files; verify correct auto-detection, preview contents, and metadata record creation. Upload an oversized, unsupported, and empty file; verify error messages.

**Acceptance Scenarios**:

1. **Given** a logged-in SCHOOL_ADMIN on the Assessment Data page, **When** they select period MOY and drop a valid DIBELS CSV (under 50MB), **Then** the file parses, a preview shows column headers and the first 5 rows with row/column counts, and a badge reads "DIBELS 8th Edition (auto-detected)" with a "Not the right assessment? Change type" link.
2. **Given** a parsed file whose headers score below the detection threshold or are ambiguous between two types, **When** the preview renders, **Then** the user is prompted to select the assessment type manually from a list ranked by confidence.
3. **Given** a 60MB file, **When** the user drops it, **Then** upload is rejected with "File too large" and the upload zone remains usable.
4. **Given** an Excel file with multiple sheets, **When** it is uploaded, **Then** the user is prompted to select a sheet before preview.
5. **Given** any successful file selection, **When** parsing completes, **Then** an upload metadata record exists (UUID, timestamp, user, school, district, assessment type, period, filename, file size, row count) before any further processing.
6. **Given** a previewed file, **When** the user clicks the clearly labeled "Remove file" action (text label, not icon-only), **Then** the file is discarded and the upload zone returns.
7. **Given** any point in the flow, **Then** a persistent 4-stage stepper (Upload, Map, Validate, Submit) shows the current stage highlighted and completed stages checked, with adequate spacing below the page header.

**Detection rule**: a type is auto-detected when at least 30% of its canonical fields match the file's headers AND its match score leads the second-best type by at least 15 percentage points. Otherwise prompt manual selection.

### User Story 2 - Review and Adjust Column Mapping (Priority: P1) [PRD US-2]

After preview, the coordinator reviews how file columns were automatically mapped to canonical fields and adjusts any mapping before validation.

**Why this priority**: Schema variability is the root cause of the manual work this product eliminates. Mapping is the core value.

**Independent Test**: Feed a fixture file with renamed columns (e.g., "LNF - Fall Score", "LASID"); verify auto-mapping via synonyms, confidence indicators, manual override, reset, and the blocking error when a required field is unmapped.

**Acceptance Scenarios**:

1. **Given** a previewed DIBELS file with header "LNF - Fall Score", **When** the mapping screen renders, **Then** that column is auto-mapped to canonical field LNF with a High confidence indicator.
2. **Given** the mapping screen, **Then** canonical fields are grouped into two labeled sections, "Student Info" (student_id, student_first_name, student_last_name, school_name, grade_level) and "Assessment Measures" (type-specific score fields). This grouping is a hard requirement.
3. **Given** any canonical field, **When** the user opens its dropdown, **Then** they can choose any source column or "Not Present", and their override persists for the session.
4. **Given** user overrides exist, **When** the user clicks "Reset to Auto-Mapped", **Then** all mappings revert to the automatic result.
5. **Given** a required field mapped to "Not Present" or unmapped, **When** the user tries to continue to validation, **Then** advancement is blocked with a message naming the missing fields.
6. **Given** a header with no exact or synonym match, **When** auto-mapping runs, **Then** fuzzy matching applies with confidence shown as Medium (similarity at least 0.85) or Low (0.70 to 0.85); below 0.70 the field shows as unmapped.

**Mapping strategy order (first match wins)**: (1) exact match, case-insensitive; (2) synonym lookup from the assessment config; (3) fuzzy match, similarity threshold 0.70; (4) heuristic signals (numeric ratio, uniqueness).

### User Story 3 - Validate Data and Fix Errors Inline (Priority: P1) [PRD US-3]

The coordinator runs validation, sees specific row/field-level errors and warnings in an editable grid, and fixes simple issues by clicking cells, without re-exporting from their assessment platform.

**Why this priority**: Inline correction is the differentiator that eliminates multi-day email back-and-forth.

**Independent Test**: Validate a dirty fixture (missing IDs, out-of-range scores, wrong grade measures); verify counts, cell highlighting, hover messages, filter toggle, downloadable report, and that an inline edit re-validates the row and updates counts.

**Acceptance Scenarios**:

1. **Given** a mapped file of up to 10,000 rows, **When** validation runs, **Then** results display within 10 seconds, with a progress indicator if it takes over 2 seconds.
2. **Given** validation results, **Then** summary cards show error count (red), warning count (always yellow, never green at zero), and clean count (green), with row-level background tints and cell-level colored borders carrying hover messages.
3. **Given** a DIBELS row with ORF = 412, **When** validated, **Then** the ORF cell shows an error "Score 412 exceeds maximum of 350" (maximums come from config: LNF ≤ 200, ORF ≤ 350, MAZE ≤ 80, etc.).
4. **Given** a grade 1 DIBELS row missing a required grade-1 measure, **When** validated, **Then** the row is flagged per the config's grade-specific requirements.
5. **Given** an error cell, **When** the user clicks it, edits the value, and presses Enter or blurs, **Then** the affected row re-validates immediately, summary counts update, and Escape cancels the edit. Cross-field rules (e.g., ORF-Accuracy consistency within ±10%) re-evaluate together.
6. **Given** validation results, **When** the user clicks the report download, **Then** a CSV downloads with columns row_number, field_name, value, severity, message, sorted by row then field.
7. **Given** the grid, **Then** an "All Rows" / "Rows with Issues" toggle filters the view.
8. **Given** a numeric name field (e.g., first name "123"), **Then** it produces a warning, not an error.

**Validation checks (all config-driven per type)**: required field presence, data type correctness, value range per measure, cross-field consistency, grade-measure requirements, grade normalization ("1st" → "1", "Kindergarten" → "K"). Negative scores are errors. Whitespace-only cells are treated as empty. Fully empty rows are warnings.

### User Story 4 - Submit and Track Pipeline Progress (Priority: P2) [PRD US-4]

The coordinator submits validated rows and watches the file move through a 5-stage pipeline to completion, including partial submission of clean rows while fixing the rest.

**Why this priority**: Completes the core loop, but only valuable once US1 to US3 work.

**Independent Test**: Submit a clean file and verify the status modal progresses Upload → Validate → Validated → Loading → Complete and history shows "Loaded". Submit a mixed file with "Submit Clean Rows Only (N)", fix remaining rows, resubmit, and verify only unsubmitted rows transmit.

**Acceptance Scenarios**:

1. **Given** validation results, **Then** the submit control adapts: "Submit" (all clean), "Submit with Warnings" plus confirmation dialog (warnings only), "Submit Clean Rows Only (N)" (mixed), or disabled with guidance (all errors). Controls sit in a distinct action bar containing only buttons and a one-line status (e.g., "124 of 130 rows ready to submit").
2. **Given** a submission, **Then** the payload contains validated, column-mapped rows (not the raw file) plus metadata (assessment type, period, school, district, user, timestamp, mapping, validation summary), and the raw file is stored separately for audit.
3. **Given** a submission in progress, **Then** a dismissable modal shows 5 stages with animated progress and green checkmarks, updating at least every 5 seconds. Navigating away is safe: history shows live status, and clicking a "Processing" row reopens the modal.
4. **Given** a completed load, **Then** the modal shows "[N] rows loaded successfully" and a completion event is recorded (upload_id, rows_loaded, table, timestamp, duration).
5. **Given** a pipeline failure, **Then** the failure is recorded (upload_id, stage, message, timestamp), a toast appears, the modal shows a plain-language error with a retry option, and history shows "Failed".
6. **Given** a partial submission with error rows remaining, **Then** the modal offers "Continue Editing ([M] issues)", the grid gains a "Submitted" count, and "Resubmit Fixed Rows" transmits only rows not yet submitted.
7. **Given** all rows eventually clean, **Then** the modal offers "Done" (primary, returns to history) and "Upload Another File" (secondary, resets the flow).
8. **Given** the server receives submitted rows, **Then** it independently re-validates all rows with the full rule set before loading; rows failing server validation are rejected with the same message format.

### User Story 5 - Upload History and Status (Priority: P2) [PRD US-5]

The coordinator sees a history of uploads for their school(s) with live status badges and can open any upload's details.

**Why this priority**: Trust and transparency; also the surface where dedup lineage appears.

**Independent Test**: Create uploads in each status; verify table columns, sort, pagination at 20 rows, live badge updates during processing, and the detail view.

**Acceptance Scenarios**:

1. **Given** the Assessment Data page, **Then** a history table below the upload section lists all uploads for the user's school(s) with columns Date, File Name, Assessment Type, Period, Rows, Status, Actions, sorted date-descending, paginated at 20.
2. **Given** an upload in each state, **Then** badges render: "Processing" (blue), "Loaded" (green), "Failed" (red), "Validated with Warnings" (yellow), "Replaced" (gray, dimmed row), "Partially Loaded" with counts (e.g., "70/130 Loaded").
3. **Given** a row click, **Then** a detail view opens with full upload details and validation summary.
4. **Given** no uploads, **Then** an empty state reads "No uploads yet. Get started by selecting a file above."
5. **Given** a DISTRICT_ADMIN, **Then** history covers all schools in their district.

### User Story 6 - Replace a Previous Upload (Priority: P3) [PRD US-10]

The coordinator uploads a corrected file for the same school, assessment type, and period without creating duplicate records.

**Why this priority**: Data integrity feature that depends on the full loop existing first.

**Independent Test**: Upload a file, then upload another with matching school/type/period; verify the confirmation dialog, supersession chain, soft-delete of prior warehouse records, and history lineage display.

**Acceptance Scenarios**:

1. **Given** an existing active upload for Lincoln Elementary / DIBELS / MOY, **When** a new file with the same combination is uploaded (metadata match, checked within a 90-day configurable window, before validation begins), **Then** a dialog states: "A DIBELS file for Lincoln Elementary (MOY) was uploaded on [date] with [N] rows. Do you want to replace it with this file?" with options "Replace Previous Upload" and "Cancel".
2. **Given** confirmation, **Then** the previous upload is marked superseded (soft-delete), its warehouse records are excluded from default queries, its raw file is retained, and the new record links to it via a previous-upload reference. Chains of replacements are tracked correctly.
3. **Given** cancellation, **Then** the user returns to the upload zone with nothing changed.
4. **Given** the history table, **Then** superseded uploads appear inline, dimmed with a "Replaced" badge, always visible without a toggle, and clicking one shows its original validation summary.

### Edge Cases

- Corrupted or unparseable file: graceful parse error message, upload zone remains usable.
- CSV in non-UTF-8 encoding: attempt UTF-8, fall back to ISO-8859-1.
- CSV with tab or pipe delimiters: delimiter auto-detection.
- Headers that are numeric or blank: treat as header-missing and prompt the user to verify.
- File with headers but zero data rows: block submission with "No rows in file".
- Same file uploaded twice within a minute: second triggers the duplicate dialog.
- Network error during submission: "Submission failed" with a Retry button; no partial state corruption.
- Polling connection lost: "Connection lost. Status may be delayed." with refresh; polling resumes.
- Upload stuck in Processing over 24 hours: warning icon with tooltip in history.
- Multi-school user: school context via school selector; single-school user sees fixed context.
- User navigates away mid-flow: stepper and state resume at the stage they left (session state).

## Requirements

### Functional Requirements

- **FR-001**: System MUST restrict the Assessment Data area to SCHOOL_ADMIN, DISTRICT_ADMIN, and IGNITE_ADMIN roles; DISTRICT_ADMIN sees all schools in their district.
- **FR-002**: System MUST accept .csv, .xlsx, and .xls files up to 50MB via drag-and-drop and browse, with specific rejection messages for oversized, unsupported, and empty files.
- **FR-003**: System MUST auto-detect assessment type per the 30% match / 15% lead rule and always allow manual override.
- **FR-004**: System MUST require a benchmark period (BOY, MOY, EOY) before a file can proceed.
- **FR-005**: System MUST create a persistent upload metadata record with a UUID before processing begins, surviving failure or abandonment.
- **FR-006**: System MUST store the raw source file unmodified, referenced from the upload record, retained per Data Sharing Agreement (active contract duration; PII destroyed or de-identified within 45 days of contract termination).
- **FR-007**: System MUST auto-map columns using exact, synonym, fuzzy (0.70 threshold), and heuristic strategies with High/Medium/Low confidence indicators.
- **FR-008**: System MUST source all canonical fields, synonyms, validation rules, grade requirements, and performance level mappings from configuration; all 5 assessment types MUST be configured at initial release with the field sets, synonyms, score ranges, and performance levels in the PRD Appendix.
- **FR-009**: System MUST block progression when required fields (student_id, student_first_name, student_last_name, school_name, grade_level, plus type-specific requirements) are unmapped, naming the missing fields.
- **FR-010**: System MUST validate all rows client-side within 10 seconds for 10,000 rows and display errors, warnings, and clean counts with row and cell level indicators.
- **FR-011**: System MUST support inline cell editing with immediate row re-validation, Enter/blur commit, Escape cancel, and session-only edit history.
- **FR-012**: System MUST generate a downloadable validation report CSV (row_number, field_name, value, severity, message).
- **FR-013**: System MUST present adaptive submit options (Submit / Submit with Warnings / Submit Clean Rows Only (N) / disabled) in a distinct action bar.
- **FR-014**: System MUST transmit validated, mapped rows plus metadata over HTTPS (TLS 1.2+), not the raw file.
- **FR-015**: System MUST re-validate all submitted rows server-side with the full rule set before loading.
- **FR-016**: System MUST process submissions asynchronously and expose per-upload status covering the 5 stages, refreshed at least every 5 seconds.
- **FR-017**: System MUST record structured events at every pipeline stage (received, validation started/completed, mapping applied, load started/completed/failed) with timestamp, upload_id, status, and duration.
- **FR-018**: System MUST support partial submission and resubmission of only not-yet-submitted rows.
- **FR-019**: System MUST show upload history scoped to the user's school(s) with live status badges, pagination at 20, and a detail view per upload.
- **FR-020**: System MUST detect duplicate uploads by metadata match (school + assessment type + period, 90-day configurable window) before validation and require explicit confirmation to replace.
- **FR-021**: System MUST soft-delete superseded uploads and their warehouse records, track the supersession chain, and display lineage inline in history.
- **FR-022**: System MUST load validated records into a universal core record plus per-measure subtest structure through the warehouse loading interface, normalizing performance levels to Above / Near / Below Benchmark per config.
- **FR-023**: System MUST meet the accessibility requirements in constitution P6.
- **FR-024**: System MUST display a persistent 4-stage stepper throughout the upload flow.

### Key Entities

- **Upload**: one file submission attempt. Identity (UUID), file metadata, assessment type, period, school/district/user context, status, validation summary, supersession link, raw file reference.
- **Assessment Record**: one student's results for one assessment type in one window. Identity fields, overall score, normalized performance level, source-specific metadata.
- **Subtest Result**: one measure score belonging to an assessment record (measure name, score, max, measure type).
- **Assessment Config**: per-type definition of canonical fields, synonyms, validation rules, grade requirements, performance level mappings. Not a database entity.
- **Pipeline Event**: structured log entry for one stage transition of one upload.
- **Processing Job**: async unit tracking a submission through loading, with stage, progress, and error detail.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A coordinator can take a clean 250-row fixture file from first click to submitted in under 15 minutes; the flow itself imposes no waiting beyond validation (10 seconds max) and pipeline processing.
- **SC-002**: All 5 fixture files auto-detect correctly (100% on fixtures); an ambiguous-header fixture prompts manual selection rather than guessing.
- **SC-003**: Validation of a 10,000-row file completes and renders within 10 seconds.
- **SC-004**: An inline cell edit re-validates and updates counts within 1 second.
- **SC-005**: A sixth assessment type can be added end-to-end (detection, mapping, validation, loading) by adding one config entry and one fixture, with zero application code changes, demonstrated by an automated test.
- **SC-006**: 100% of validation messages name the row, field, and value, verified by message format tests.
- **SC-007**: After a replacement upload, default warehouse queries return only the new upload's records while superseded records remain retrievable for audit.
- **SC-008**: Every user story checkpoint passes its automated test suite.
