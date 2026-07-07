import { useCallback, useEffect, useMemo, useState } from "react";
import { detectAssessmentType, type DetectionResult, type SourceRow } from "@assessment/shared";
import { apiPostForm } from "../../lib/api.js";
import { parseFile, type ParsedFile } from "../../lib/parse-file.js";
import type { Step } from "../../kit/index.js";

export type Stage = "upload" | "map" | "validate" | "submit";

export const UPLOAD_STEPS: Step[] = [
  { key: "upload", label: "Upload" },
  { key: "map", label: "Map" },
  { key: "validate", label: "Validate" },
  { key: "submit", label: "Submit" },
];

export type Period = "BOY" | "MOY" | "EOY";

export interface DuplicateMatch {
  existingUploadId: string;
  uploadedAt: string;
  rowCount: number | null;
  filename: string;
}

export interface PreviewData {
  fileName: string;
  headers: string[];
  sampleRows: SourceRow[];
  rowCount: number;
  columnCount: number;
}

interface PersistedState {
  stage: Stage;
  period: Period | null;
  assessmentType: string | null;
  uploadId: string | null;
  preview: PreviewData | null;
  detection: DetectionResult | null;
}

const STORAGE_KEY = "assessment-upload-flow";

function loadPersisted(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

const SUPPORTED_EXT = /\.(csv|xlsx|xls)$/i;
const MAX_BYTES = 50 * 1024 * 1024;

export function stageIndex(stage: Stage): number {
  return UPLOAD_STEPS.findIndex((s) => s.key === stage);
}

export interface UploadFlow {
  stage: Stage;
  stageIdx: number;
  period: Period | null;
  file: File | null;
  preview: PreviewData | null;
  rows: SourceRow[];
  detection: DetectionResult | null;
  assessmentType: string | null;
  uploadId: string | null;
  duplicate: DuplicateMatch | null;
  sheetPrompt: { file: File; sheetNames: string[] } | null;
  error: string | null;
  busy: boolean;
  setPeriod: (p: Period) => void;
  selectFile: (file: File) => Promise<void>;
  chooseSheet: (sheetName: string) => Promise<void>;
  setAssessmentType: (id: string) => void;
  removeFile: () => void;
  canContinueFromUpload: boolean;
  continueFromUpload: () => Promise<void>;
  goToStage: (stage: Stage) => void;
  reset: () => void;
}

export function useUploadFlow(opts: { schoolId?: string } = {}): UploadFlow {
  const persisted = useMemo(loadPersisted, []);
  const [stage, setStage] = useState<Stage>(persisted?.stage ?? "upload");
  const [period, setPeriodState] = useState<Period | null>(persisted?.period ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(persisted?.preview ?? null);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [detection, setDetection] = useState<DetectionResult | null>(persisted?.detection ?? null);
  const [assessmentType, setType] = useState<string | null>(persisted?.assessmentType ?? null);
  const [uploadId, setUploadId] = useState<string | null>(persisted?.uploadId ?? null);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [sheetPrompt, setSheetPrompt] = useState<{ file: File; sheetNames: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Persist the serializable slice so a reload resumes at the same stage (FR-024).
  useEffect(() => {
    const snapshot: PersistedState = { stage, period, assessmentType, uploadId, preview, detection };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage unavailable; in-memory only */
    }
  }, [stage, period, assessmentType, uploadId, preview, detection]);

  const applyParsed = useCallback((parsed: ParsedFile, selectedFile: File) => {
    const det = detectAssessmentType(parsed.headers);
    setPreview({
      fileName: selectedFile.name,
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 5),
      rowCount: parsed.rowCount,
      columnCount: parsed.columnCount,
    });
    setRows(parsed.rows);
    setDetection(det);
    setType(det.detected); // null when ambiguous → UI prompts for manual selection
    setFile(selectedFile);
    setSheetPrompt(null);
    setError(null);
  }, []);

  const selectFile = useCallback(
    async (selected: File) => {
      setError(null);
      if (!SUPPORTED_EXT.test(selected.name)) {
        setError("Unsupported file type. Upload a .csv, .xlsx, or .xls file.");
        return;
      }
      if (selected.size > MAX_BYTES) {
        setError("File too large. The maximum upload size is 50MB.");
        return;
      }
      const outcome = await parseFile(selected);
      if (outcome.status === "needs-sheet") {
        setSheetPrompt({ file: selected, sheetNames: outcome.sheetNames });
        return;
      }
      if (outcome.status === "empty") {
        setError("The file is empty or has no header row. Choose a file with data.");
        return;
      }
      if (outcome.status === "error") {
        setError(outcome.message);
        return;
      }
      applyParsed(outcome.parsed, selected);
    },
    [applyParsed],
  );

  const chooseSheet = useCallback(
    async (sheetName: string) => {
      if (!sheetPrompt) return;
      const outcome = await parseFile(sheetPrompt.file, { sheetName });
      if (outcome.status === "parsed") applyParsed(outcome.parsed, sheetPrompt.file);
      else setError("That sheet could not be read. Choose another sheet.");
    },
    [sheetPrompt, applyParsed],
  );

  const removeFile = useCallback(() => {
    setFile(null);
    setPreview(null);
    setRows([]);
    setDetection(null);
    setType(null);
    setUploadId(null);
    setDuplicate(null);
    setSheetPrompt(null);
    setError(null);
  }, []);

  const setPeriod = useCallback((p: Period) => setPeriodState(p), []);
  const setAssessmentType = useCallback((id: string) => setType(id), []);

  const canContinueFromUpload = Boolean(period && preview && assessmentType && file);

  const continueFromUpload = useCallback(async () => {
    if (!period || !preview || !assessmentType || !file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append(
        "meta",
        JSON.stringify({
          filename: file.name,
          fileSizeBytes: file.size,
          rowCount: preview.rowCount,
          columnCount: preview.columnCount,
          headers: preview.headers,
          assessmentWindow: period,
          schoolId: opts.schoolId,
          assessmentTypeOverride: assessmentType,
        }),
      );
      const res = await apiPostForm<{
        uploadId: string;
        detection: DetectionResult;
        duplicate: DuplicateMatch | null;
      }>("/api/uploads", form);
      setUploadId(res.uploadId);
      setDuplicate(res.duplicate);
      setStage("map");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [period, preview, assessmentType, file, opts.schoolId]);

  const goToStage = useCallback((next: Stage) => setStage(next), []);

  const reset = useCallback(() => {
    removeFile();
    setPeriodState(null);
    setStage("upload");
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [removeFile]);

  return {
    stage,
    stageIdx: stageIndex(stage),
    period,
    file,
    preview,
    rows,
    detection,
    assessmentType,
    uploadId,
    duplicate,
    sheetPrompt,
    error,
    busy,
    setPeriod,
    selectFile,
    chooseSheet,
    setAssessmentType,
    removeFile,
    canContinueFromUpload,
    continueFromUpload,
    goToStage,
    reset,
  };
}
