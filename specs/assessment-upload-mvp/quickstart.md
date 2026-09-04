# Quickstart: Assessment Data Upload MVP

**Date**: 2026-07-07

## Run

```bash
docker compose up -d          # Postgres 16 on :5432
npm install
npm run migrate --workspace apps/api
npm run seed --workspace apps/api      # mock users, schools, districts
npm run dev                            # api on :3001, web on :5173 (concurrently)
npm test                               # all workspaces
```

## Validation Scenarios (manual smoke, mirrors checkpoint tests)

1. **Clean upload end to end**: As SCHOOL_ADMIN, select MOY, upload `fixtures/dibels-clean.csv`. Expect "DIBELS 8th Edition (auto-detected)" badge, all mappings High confidence, 0 errors, "Submit" enabled, modal reaching Complete with "[N] rows loaded successfully", history row "Loaded".
2. **Dirty file with inline fix**: Upload `fixtures/dibels-dirty.csv`. Expect the exact error/warning counts in `fixtures/expected/dibels-dirty.json`. Click an error cell, fix the value, watch counts drop within 1 second. Use "Submit Clean Rows Only (N)", then "Continue Editing", fix remaining rows, "Resubmit Fixed Rows", finish with "Done".
3. **Renamed headers**: Upload `fixtures/dibels-renamed-headers.csv` ("LNF - Fall Score", "LASID"). Expect synonym auto-mapping with High confidence.
4. **Ambiguous detection**: Upload `fixtures/ambiguous-headers.csv`. Expect a manual type selection prompt, not a guess.
5. **Duplicate replacement**: Upload `dibels-clean.csv` twice for the same school/period. Expect the replacement dialog quoting the prior upload's date and row count. Replace, then verify history shows the old row dimmed with "Replaced" and warehouse default queries return only new records.
6. **Role scoping**: Switch to DISTRICT_ADMIN via the dev role switcher: history shows all district schools. SCHOOL_ADMIN of school A cannot fetch school B uploads (403 in network tab).
7. **All five types**: Upload each remaining clean fixture (iready, star, vallss, amira); each detects, maps, validates, and loads.
8. **Config-only extension (SC-005)**: `npm test -- config-extension` runs the test that registers a synthetic sixth assessment config and drives a fixture through detect → map → validate → load with no app code changes.
