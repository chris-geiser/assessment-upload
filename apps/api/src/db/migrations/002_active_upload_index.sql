-- Reconciliation of a spec conflict (flagged to the team):
-- data-model.md specifies the one-active-upload-per-window index as
--   WHERE replacement_status = 'active' AND status <> 'failed'
-- but FR-005 (create the upload record BEFORE processing) plus FR-020 (hold a
-- duplicate upload pending a replace/cancel decision) require two in_progress
-- records for the same window to coexist transiently. Under the literal predicate
-- those two drafts collide and the flow is impossible.
--
-- Excluding 'in_progress' preserves the real intent — one COMMITTED active upload
-- per window (processing/validated/loaded/partially_loaded) — while letting drafts
-- and held duplicates coexist. On replace, the old record is superseded before the
-- new one advances; on cancel, the new record becomes 'failed'. Either way at most
-- one non-draft active upload per window ever exists.
DROP INDEX IF EXISTS uq_active_upload_per_window;

CREATE UNIQUE INDEX uq_active_upload_per_window
  ON upload_records (assessment_type, school_id, assessment_window)
  WHERE replacement_status = 'active' AND status NOT IN ('failed', 'in_progress');
