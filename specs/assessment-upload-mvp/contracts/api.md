# API Contract: Assessment Data Upload MVP

**Date**: 2026-07-07 | **Base**: `/api` | **Auth**: all endpoints require a session from `AuthProvider`; role guards noted per endpoint. All responses JSON. Errors use `{error: {code, message}}` with human-readable messages (constitution P4). Status codes: 400 (bad input), 401 (no session), 403 (role/scope), 404, 409 (duplicate), 422 (validation), 500.

Role scoping rule (applies everywhere): SCHOOL_ADMIN sees only their school; DISTRICT_ADMIN sees all schools in their district; IGNITE_ADMIN sees everything.

## Uploads

### POST /api/uploads

Creates the upload record (before any processing, FR-005), stores the raw file, runs duplicate check and auto-detection.

Request: `multipart/form-data`
- `file`: the raw file (≤ 50MB; .csv/.xlsx/.xls)
- `meta`: JSON - `{filename, fileSizeBytes, rowCount, columnCount, headers: string[], assessmentWindow: "BOY"|"MOY"|"EOY", schoolId, assessmentTypeOverride?: string}`

Response `201`:
```json
{
  "uploadId": "uuid",
  "detection": {
    "detected": "DIBELS_8",
    "confidence": 0.87,
    "ambiguous": false,
    "scores": {"DIBELS_8": 0.87, "IREADY": 0.42, "STAR": 0.35, "VALLSS": 0.20, "AMIRA": 0.25}
  },
  "duplicate": null
}
```

Duplicate case (still `201`, upload record exists but is held):
```json
{
  "uploadId": "uuid",
  "detection": { "...": "..." },
  "duplicate": {
    "existingUploadId": "uuid",
    "uploadedAt": "2026-03-10T14:15:00Z",
    "rowCount": 130,
    "filename": "DIBELS_MOY_2026.xlsx"
  }
}
```

Errors: `400 FILE_TOO_LARGE`, `400 UNSUPPORTED_TYPE`, `400 EMPTY_FILE`, `403 SCHOOL_SCOPE`.

### POST /api/uploads/:uploadId/replace-decision

Resolves a duplicate hold (FR-020/021).

Request: `{"action": "replace" | "cancel"}`

- `replace`: marks the existing upload `replacement_status = 'superseded'`, sets `previous_upload_id` on the new record, calls `WarehouseLoader.supersedeRecords(existingUploadId)`, logs `upload_superseded` event. Response `200 {"status": "proceed"}`.
- `cancel`: marks the new upload record status `failed` with detail `cancelled_duplicate` (record persists, P3). Response `200 {"status": "cancelled"}`.

### GET /api/uploads?schoolId=&limit=20&offset=0

Upload history scoped by role. Includes superseded rows inline.

Response `200`:
```json
{
  "uploads": [{
    "uploadId": "uuid", "filename": "...", "assessmentType": "DIBELS_8",
    "assessmentWindow": "MOY", "rowCount": 130, "status": "loaded",
    "replacementStatus": "active", "previousUploadId": null,
    "validationSummary": {"totalRows":130,"cleanRows":124,"errorRows":6,"warningRows":0,"submittedRows":124},
    "schoolName": "...", "createdAt": "...", "loadedAt": "..."
  }],
  "total": 42
}
```

### GET /api/uploads/:uploadId

Full detail for the history sheet view: all fields above plus `columnMapping`, `uploadedByName`, and the latest job summary.

## Validation

### POST /api/uploads/:uploadId/validate

Server-side validation with the full shared engine (P8). Client calls this before enabling submit to guarantee client/server agreement; it is also re-run inside submit.

Request: `{"rows": [{...}], "columnMapping": {"student_id": "LASID", "...": "..."}}`
(rows keyed by source column headers; `rowIndex` implicit by array order and echoed back)

Response `200`:
```json
{
  "summary": {"totalRows": 130, "cleanRows": 124, "errorRows": 4, "warningRows": 2},
  "issues": [{
    "rowIndex": 46, "field": "student_id", "value": "",
    "severity": "error",
    "message": "Row 47: Student ID is empty. Enter the student's ID or remove the row."
  }]
}
```

Errors: `422 REQUIRED_FIELDS_UNMAPPED` with `{"missingFields": ["student_id"]}` (FR-009).

Note: `rowIndex` is 0-based and stable from the original parse; user-facing messages use 1-based row numbers.

## Submission and Jobs

### POST /api/uploads/:uploadId/submit

Request:
```json
{
  "rows": [{"__rowIndex": 0, "student_id": "1001", "...": "..."}],
  "columnMapping": {"...": "..."},
  "includeWarnings": true
}
```
Rows are the mapped, edited values for the row indexes being submitted (all clean rows on first submit; only newly fixed rows on resubmit; server rejects any `__rowIndex` already in `submitted_rows`).

Response `202`:
```json
{
  "jobId": "uuid", "uploadId": "uuid",
  "rowsSubmitted": 124, "rowsSkipped": 6,
  "statusUrl": "/api/jobs/{jobId}/status"
}
```

Errors: `422 SERVER_VALIDATION_FAILED` with the same issues shape as /validate (server found errors the client missed); `409 ROWS_ALREADY_SUBMITTED`.

### GET /api/jobs/:jobId/status

Polled every 5 seconds by the pipeline modal (D6).

Response `200`:
```json
{
  "jobId": "uuid", "uploadId": "uuid",
  "stage": "loading",
  "progressPct": 45,
  "rowsSubmitted": 124, "rowsLoaded": 56, "rowsFailed": 0,
  "events": [
    {"timestamp": "...", "eventType": "load_started", "message": "Loading 124 rows into the warehouse"}
  ],
  "error": null
}
```

Failure case: `stage: "failed"`, `error: {"code": "WAREHOUSE_UNAVAILABLE", "message": "The data warehouse could not be reached. Your data is saved. Retry in a few minutes or contact support."}`.

Stage mapping to the 5-stage UI: `queued`/`validating` → Validate, `validated` → Validated, `loading` → Loading, `complete` → Complete. (Upload stage completes client-side at file receipt.)

### POST /api/jobs/:jobId/retry

Re-queues a failed job. Response `202` with the same shape as submit. Only valid from `failed`; otherwise `409`.

## Session (mock auth, D4)

### GET /api/session
Response: `{"userId": "...", "name": "...", "role": "SCHOOL_ADMIN", "schools": [{"schoolId": "...", "schoolName": "...", "districtId": "...", "districtName": "..."}]}`

### POST /api/session/switch  (dev-only)
Request: `{"role": "DISTRICT_ADMIN", "schoolId?": "..."}`. Swaps the mock session. Excluded from production builds.

## Contract Tests

Every endpoint above gets a supertest suite covering: happy path, role scoping (403), and each named error code. The /validate and /submit suites additionally assert client/server engine agreement on all fixtures (P8 gate).
