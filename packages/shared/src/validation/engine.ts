import type {
  AssessmentConfig,
  ColumnMapping,
  SourceRow,
  ValidationIssue,
  ValidationResult,
  ValidationSummary,
} from "../types.js";
import { validateRow, type RowContext } from "./rules.js";

// The single validation engine (constitution P8). It runs identically on the client
// (speed) and the server (truth); any client/server disagreement on a fixture is a
// failed checkpoint (enforced by the engine-agreement test).

export function validateSingleRow(
  row: SourceRow,
  rowIndex: number,
  mapping: ColumnMapping,
  config: AssessmentConfig,
): ValidationIssue[] {
  const ctx: RowContext = { row, rowIndex, mapping, config };
  return validateRow(ctx);
}

export function validateRows(
  rows: SourceRow[],
  mapping: ColumnMapping,
  config: AssessmentConfig,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let errorRows = 0;
  let warningRows = 0;

  rows.forEach((row, rowIndex) => {
    const rowIssues = validateSingleRow(row, rowIndex, mapping, config);
    if (rowIssues.length > 0) issues.push(...rowIssues);
    const hasError = rowIssues.some((i) => i.severity === "error");
    const hasWarning = rowIssues.some((i) => i.severity === "warning");
    if (hasError) errorRows += 1;
    else if (hasWarning) warningRows += 1;
  });

  const summary: ValidationSummary = {
    totalRows: rows.length,
    cleanRows: rows.length - errorRows - warningRows,
    errorRows,
    warningRows,
  };

  // Deterministic ordering: by row, then by field, so client and server agree and
  // the downloadable report is stable.
  issues.sort(
    (a, b) => a.rowIndex - b.rowIndex || a.field.localeCompare(b.field),
  );

  return { summary, issues };
}

export type { ValidationResult, ValidationSummary, ValidationIssue };
