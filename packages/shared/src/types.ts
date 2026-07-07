// Canonical, config-driven types shared by client and server (constitution P1/P8).
// Nothing here branches on a specific assessment type; all type-specific behavior
// lives in the assessment configs consumed through these shapes.

export type NormalizedLevel =
  | "Above Benchmark"
  | "Near Benchmark"
  | "Below Benchmark";

export type CanonicalFieldType = "string" | "number" | "grade";

export type FieldCategory = "student" | "measure";

export type MeasureType =
  | "raw"
  | "scaled"
  | "percentile"
  | "fluency"
  | "accuracy"
  | "composite"
  | "comprehension"
  | "classification";

export interface CanonicalField {
  /** Canonical key used everywhere downstream, e.g. "student_id", "LNF". */
  name: string;
  /** Human-facing label used in UI and validation messages. */
  label: string;
  type: CanonicalFieldType;
  category: FieldCategory;
  /** Globally required identity field (blocks progression if unmapped, FR-009). */
  required?: boolean;
  min?: number;
  max?: number;
  measureType?: MeasureType;
  /**
   * Helper/measure fields that should not count toward auto-detection scoring
   * (e.g. supporting inputs for a cross-field check). Still mappable + validatable.
   */
  excludeFromDetection?: boolean;
}

export type CrossFieldCheckKind = "orf_accuracy_consistency";

export interface CrossFieldCheck {
  id: string;
  kind: CrossFieldCheckKind;
  /** Canonical field names this check reads. Re-run together on inline edits. */
  fields: string[];
  description: string;
  /** Tolerance in percentage points for consistency checks. */
  tolerancePct?: number;
}

export interface AssessmentConfig {
  /** Versioned id, e.g. "DIBELS_8" (D9). */
  id: string;
  displayName: string;
  vendor: string;
  canonicalFields: CanonicalField[];
  /** Normalized (lowercased, trimmed) source header → canonical field name. */
  synonymMap: Record<string, string>;
  /** Grade (normalized, "K"|"1"..) → canonical measure names expected at that grade. */
  requiredByGrade: Record<string, string[]>;
  /** Native performance level string → normalized level. */
  performanceLevels: Record<string, NormalizedLevel>;
  crossFieldChecks: CrossFieldCheck[];
}

// ── Detection ──────────────────────────────────────────────────────────────

export interface DetectionResult {
  /** Config id, or null when ambiguous / below threshold. */
  detected: string | null;
  confidence: number;
  ambiguous: boolean;
  /** Raw match score (0–1) per config id. */
  scores: Record<string, number>;
  /** Config ids ordered by score, best first (for manual selection prompts). */
  ranked: Array<{ id: string; score: number }>;
}

// ── Mapping ──────────────────────────────────────────────────────────────

export type ConfidenceBand = "high" | "medium" | "low" | "none";

export type MappingStrategy =
  | "exact"
  | "synonym"
  | "fuzzy"
  | "heuristic"
  | "none";

export interface FieldMapping {
  /** Source column header, or null when unmapped / "Not Present". */
  sourceColumn: string | null;
  confidence: number;
  band: ConfidenceBand;
  strategy: MappingStrategy;
  /**
   * A candidate the mapper found but did NOT auto-select. Used for identity fields
   * with only a fuzzy match (D8: never auto-map identity via fuzzy, but surface the
   * low-confidence suggestion so the user can accept it).
   */
  suggestion?: string;
}

/** Full mapping result keyed by canonical field name. */
export type MappingResult = Record<string, FieldMapping>;

/** Flattened mapping used on the wire and by the engine: canonical → source header. */
export type ColumnMapping = Record<string, string | null>;

export const NOT_PRESENT = "__NONE__" as const;

// ── Validation ──────────────────────────────────────────────────────────────

export type Severity = "error" | "warning";

export interface ValidationIssue {
  /** 0-based, stable from the original parse. Messages use 1-based numbers. */
  rowIndex: number;
  /** Canonical field name, or "__row__" for whole-row issues. */
  field: string;
  fieldLabel: string;
  value: string;
  severity: Severity;
  /** Human message, P4 format: "Row N: <field> ... . <what to do>." */
  message: string;
  ruleId: string;
}

export interface ValidationSummary {
  totalRows: number;
  cleanRows: number;
  errorRows: number;
  warningRows: number;
}

export interface ValidationResult {
  summary: ValidationSummary;
  issues: ValidationIssue[];
}

/** A parsed source row: source-header → cell value (string or empty). */
export type SourceRow = Record<string, string>;
