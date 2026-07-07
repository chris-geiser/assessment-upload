import { useCallback, useEffect, useMemo, useState } from "react";
import {
  detectAssessmentType,
  getAssessmentConfig,
  mapColumns,
  NOT_PRESENT,
  toColumnMapping,
  unmappedRequiredFields,
  validateRows,
  validateSingleRow,
  type ColumnMapping,
  type DetectionResult,
  type MappingResult,
  type SourceRow,
  type ValidationIssue,
  type ValidationSummary,
} from "@assessment/shared";
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
  overrides: Record<string, string>;
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
  // Mapping (US2)
  mappingResult: MappingResult | null;
  effectiveMapping: ColumnMapping;
  overrides: Record<string, string>;
  setFieldMapping: (field: string, sourceColumn: string) => void;
  resetMapping: () => void;
  unmappedRequired: string[];
  canContinueFromMap: boolean;
  continueFromMap: () => void;
  // Validation (US3)
  validationSummary: ValidationSummary | null;
  issuesForCell: (rowIndex: number, field: string) => ValidationIssue | undefined;
  rowSeverity: (rowIndex: number) => "error" | "warning" | null;
  allIssues: ValidationIssue[];
  mappedFields: string[];
  cellValueFor: (rowIndex: number, field: string) => string;
  editCell: (rowIndex: number, field: string, value: string) => void;
  goBack: () => void;
  goToStage: (stage: Stage) => void;
  reset: () => void;
}

interface ValidationState {
  issuesByRow: Record<number, ValidationIssue[]>;
  summary: ValidationSummary;
}

function summarize(total: number, issuesByRow: Record<number, ValidationIssue[]>): ValidationSummary {
  let errorRows = 0;
  let warningRows = 0;
  for (const key of Object.keys(issuesByRow)) {
    const arr = issuesByRow[Number(key)];
    if (!arr?.length) continue;
    if (arr.some((i) => i.severity === "error")) errorRows += 1;
    else warningRows += 1;
  }
  return { totalRows: total, errorRows, warningRows, cleanRows: total - errorRows - warningRows };
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
  const [overrides, setOverrides] = useState<Record<string, string>>(persisted?.overrides ?? {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Persist the serializable slice so a reload resumes at the same stage (FR-024).
  useEffect(() => {
    const snapshot: PersistedState = { stage, period, assessmentType, uploadId, preview, detection, overrides };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage unavailable; in-memory only */
    }
  }, [stage, period, assessmentType, uploadId, preview, detection, overrides]);

  // Auto-mapping (recomputed when the type or file changes); overrides layer on top.
  const config = assessmentType ? (getAssessmentConfig(assessmentType) ?? null) : null;
  const mappingResult = useMemo<MappingResult | null>(() => {
    if (!config || !preview) return null;
    return mapColumns(preview.headers, config, preview.sampleRows);
  }, [config, preview]);

  const effectiveMapping = useMemo<ColumnMapping>(() => {
    const base = mappingResult ? toColumnMapping(mappingResult) : {};
    return { ...base, ...overrides };
  }, [mappingResult, overrides]);

  const unmappedRequired = useMemo(
    () => (config ? unmappedRequiredFields(config, effectiveMapping) : []),
    [config, effectiveMapping],
  );

  const setFieldMapping = useCallback((field: string, sourceColumn: string) => {
    setOverrides((prev) => ({ ...prev, [field]: sourceColumn }));
  }, []);

  const resetMapping = useCallback(() => setOverrides({}), []);

  const canContinueFromMap = config != null && unmappedRequired.length === 0;

  const [validation, setValidation] = useState<ValidationState | null>(null);

  const mappedFields = useMemo(() => {
    if (!config) return [];
    return config.canonicalFields
      .filter((f) => {
        const src = effectiveMapping[f.name];
        return src && src !== NOT_PRESENT;
      })
      .map((f) => f.name);
  }, [config, effectiveMapping]);

  const continueFromMap = useCallback(() => {
    if (!config) return;
    if (unmappedRequired.length > 0) {
      const labels = unmappedRequired
        .map((f) => config.canonicalFields.find((c) => c.name === f)?.label ?? f)
        .join(", ");
      setError(`Map these required fields before continuing: ${labels}.`);
      return;
    }
    setError(null);
    // Full validation of every row (client-side, for speed — P8 server re-validates).
    const result = validateRows(rows, effectiveMapping, config);
    const byRow: Record<number, ValidationIssue[]> = {};
    for (const issue of result.issues) {
      (byRow[issue.rowIndex] ??= []).push(issue);
    }
    setValidation({ issuesByRow: byRow, summary: result.summary });
    setStage("validate");
  }, [config, unmappedRequired, rows, effectiveMapping]);

  const cellValueFor = useCallback(
    (rowIndex: number, field: string) => {
      const src = effectiveMapping[field];
      if (!src || src === NOT_PRESENT) return "";
      return rows[rowIndex]?.[src] ?? "";
    },
    [rows, effectiveMapping],
  );

  // Inline edit: patch one cell, re-validate only that row (≤1s), update counts.
  const editCell = useCallback(
    (rowIndex: number, field: string, value: string) => {
      if (!config) return;
      const src = effectiveMapping[field];
      if (!src || src === NOT_PRESENT) return;
      setRows((prev) => {
        const next = prev.slice();
        next[rowIndex] = { ...next[rowIndex], [src]: value };
        const rowIssues = validateSingleRow(next[rowIndex], rowIndex, effectiveMapping, config);
        setValidation((prevVal) => {
          const byRow = { ...(prevVal?.issuesByRow ?? {}) };
          if (rowIssues.length) byRow[rowIndex] = rowIssues;
          else delete byRow[rowIndex];
          return { issuesByRow: byRow, summary: summarize(next.length, byRow) };
        });
        return next;
      });
    },
    [config, effectiveMapping],
  );

  const issuesForCell = useCallback(
    (rowIndex: number, field: string): ValidationIssue | undefined =>
      validation?.issuesByRow[rowIndex]?.find((i) => i.field === field),
    [validation],
  );

  const rowSeverity = useCallback(
    (rowIndex: number): "error" | "warning" | null => {
      const arr = validation?.issuesByRow[rowIndex];
      if (!arr?.length) return null;
      return arr.some((i) => i.severity === "error") ? "error" : "warning";
    },
    [validation],
  );

  const allIssues = useMemo(() => {
    if (!validation) return [];
    return Object.values(validation.issuesByRow)
      .flat()
      .sort((a, b) => a.rowIndex - b.rowIndex || a.field.localeCompare(b.field));
  }, [validation]);

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
    setOverrides({});
    setValidation(null);
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

  const goBack = useCallback(() => {
    setError(null);
    setStage((s) => {
      const idx = stageIndex(s);
      return idx > 0 ? UPLOAD_STEPS[idx - 1].key as Stage : s;
    });
  }, []);

  const reset = useCallback(() => {
    removeFile();
    setOverrides({});
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
    mappingResult,
    effectiveMapping,
    overrides,
    setFieldMapping,
    resetMapping,
    unmappedRequired,
    canContinueFromMap,
    continueFromMap,
    validationSummary: validation?.summary ?? null,
    issuesForCell,
    rowSeverity,
    allIssues,
    mappedFields,
    cellValueFor,
    editCell,
    goBack,
    goToStage,
    reset,
  };
}
