import type {
  AssessmentConfig,
  CanonicalField,
  ColumnMapping,
  SourceRow,
  ValidationIssue,
} from "../types.js";
import { NOT_PRESENT } from "../types.js";
import { normalizeGrade } from "./normalize.js";

// One shared row context; messages use 1-based row numbers (rowIndex + 1) per the
// API contract, while rowIndex stays 0-based and stable from the parse.
export interface RowContext {
  row: SourceRow;
  rowIndex: number;
  mapping: ColumnMapping;
  config: AssessmentConfig;
}

function humanRow(rowIndex: number): number {
  return rowIndex + 1;
}

function mappedSource(mapping: ColumnMapping, field: string): string | null {
  const src = mapping[field];
  if (!src || src === NOT_PRESENT) return null;
  return src;
}

/** Raw cell value for a canonical field, or "" when unmapped/absent. */
export function cellValue(ctx: RowContext, field: string): string {
  const src = mappedSource(ctx.mapping, field);
  if (!src) return "";
  return ctx.row[src] ?? "";
}

function isEmpty(value: string): boolean {
  return value.trim() === ""; // whitespace-only counts as empty
}

function issue(
  ctx: RowContext,
  field: CanonicalField | { name: string; label: string },
  value: string,
  severity: ValidationIssue["severity"],
  ruleId: string,
  message: string,
): ValidationIssue {
  return {
    rowIndex: ctx.rowIndex,
    field: field.name,
    fieldLabel: field.label,
    value,
    severity,
    message,
    ruleId,
  };
}

/** True when every mapped canonical field in the row is empty (empty-row warning). */
export function isEmptyRow(ctx: RowContext): boolean {
  return ctx.config.canonicalFields.every((f) => isEmpty(cellValue(ctx, f.name)));
}

// ── Individual rules ─────────────────────────────────────────────────────────

function requiredRule(ctx: RowContext, field: CanonicalField): ValidationIssue | null {
  if (!field.required) return null;
  if (!mappedSource(ctx.mapping, field.name)) return null; // gate handles unmapped
  const value = cellValue(ctx, field.name);
  if (!isEmpty(value)) return null;
  return issue(
    ctx,
    field,
    "",
    "error",
    "required",
    `Row ${humanRow(ctx.rowIndex)}: ${field.label} is empty. Enter the ${field.label.toLowerCase()} or remove the row.`,
  );
}

function numericNameRule(ctx: RowContext, field: CanonicalField): ValidationIssue | null {
  const isName =
    field.name === "student_first_name" || field.name === "student_last_name";
  if (!isName) return null;
  const value = cellValue(ctx, field.name);
  if (isEmpty(value)) return null;
  if (Number.isNaN(Number(value.trim()))) return null; // not numeric → fine
  return issue(
    ctx,
    field,
    value,
    "warning",
    "numeric-name",
    `Row ${humanRow(ctx.rowIndex)}: ${field.label} "${value}" looks like a number. Confirm this is the student's ${field.label.toLowerCase()}.`,
  );
}

// type + negative + range, in that order; returns at most one issue per field.
function numericRule(ctx: RowContext, field: CanonicalField): ValidationIssue | null {
  if (field.type !== "number") return null;
  const value = cellValue(ctx, field.name);
  if (isEmpty(value)) return null;
  const num = Number(value.trim());
  if (Number.isNaN(num)) {
    return issue(
      ctx,
      field,
      value,
      "error",
      "type",
      `Row ${humanRow(ctx.rowIndex)}: ${field.label} value "${value}" is not a number. Enter a numeric score or clear the cell.`,
    );
  }
  if (num < 0) {
    return issue(
      ctx,
      field,
      value,
      "error",
      "negative-score",
      `Row ${humanRow(ctx.rowIndex)}: ${field.label} score ${num} cannot be negative. Enter a value of 0 or more.`,
    );
  }
  if (field.max != null && num > field.max) {
    return issue(
      ctx,
      field,
      value,
      "error",
      "range-max",
      `Row ${humanRow(ctx.rowIndex)}: ${field.label} score ${num} exceeds the maximum of ${field.max}. Check the value against the ${field.label} scale.`,
    );
  }
  if (field.min != null && field.min > 0 && num < field.min) {
    return issue(
      ctx,
      field,
      value,
      "error",
      "range-min",
      `Row ${humanRow(ctx.rowIndex)}: ${field.label} score ${num} is below the minimum of ${field.min}. Check the value against the ${field.label} scale.`,
    );
  }
  return null;
}

function crossFieldRules(ctx: RowContext): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const check of ctx.config.crossFieldChecks) {
    if (check.kind === "orf_accuracy_consistency") {
      const orf = Number(cellValue(ctx, "ORF").trim());
      const acc = Number(cellValue(ctx, "ORF_ACC").trim());
      const attempted = Number(cellValue(ctx, "ORF_WORDS_ATTEMPTED").trim());
      const present =
        cellValue(ctx, "ORF").trim() !== "" &&
        cellValue(ctx, "ORF_ACC").trim() !== "" &&
        cellValue(ctx, "ORF_WORDS_ATTEMPTED").trim() !== "";
      if (!present) continue;
      if ([orf, acc, attempted].some(Number.isNaN) || attempted <= 0) continue;
      const expected = (orf / attempted) * 100;
      const tol = check.tolerancePct ?? 10;
      if (Math.abs(acc - expected) > tol) {
        const field =
          ctx.config.canonicalFields.find((f) => f.name === "ORF_ACC")!;
        out.push(
          issue(
            ctx,
            field,
            String(acc),
            "error",
            "cross-field",
            `Row ${humanRow(ctx.rowIndex)}: ${field.label} ${acc}% is inconsistent with ${orf} of ${attempted} words correct (about ${expected.toFixed(0)}%). Recheck the accuracy or the word counts.`,
          ),
        );
      }
    }
  }
  return out;
}

function gradeMeasureRules(ctx: RowContext): ValidationIssue[] {
  const grade = normalizeGrade(cellValue(ctx, "grade"));
  if (!grade) return [];
  const expected = ctx.config.requiredByGrade[grade];
  if (!expected) return [];
  const expectedSet = new Set(expected);
  const out: ValidationIssue[] = [];

  // Missing required-by-grade measure (mapped but empty) → warning.
  for (const name of expected) {
    if (!mappedSource(ctx.mapping, name)) continue;
    const field = ctx.config.canonicalFields.find((f) => f.name === name);
    if (!field) continue;
    if (isEmpty(cellValue(ctx, name))) {
      out.push(
        issue(
          ctx,
          field,
          "",
          "warning",
          "grade-missing-measure",
          `Row ${humanRow(ctx.rowIndex)}: ${field.label} is expected for grade ${grade} but is empty. Enter the score or confirm it was not administered.`,
        ),
      );
    }
  }

  // Unexpected measure for grade (present with a value) → warning (e.g. MAZE, grade 1).
  for (const field of ctx.config.canonicalFields) {
    if (field.category !== "measure" || field.excludeFromDetection) continue;
    if (expectedSet.has(field.name)) continue;
    if (!mappedSource(ctx.mapping, field.name)) continue;
    if (isEmpty(cellValue(ctx, field.name))) continue;
    out.push(
      issue(
        ctx,
        field,
        cellValue(ctx, field.name),
        "warning",
        "grade-unexpected-measure",
        `Row ${humanRow(ctx.rowIndex)}: ${field.label} is not expected for grade ${grade}. Confirm the grade or remove the score.`,
      ),
    );
  }

  return out;
}

/** Run every rule against a single row; used for both full and inline validation. */
export function validateRow(ctx: RowContext): ValidationIssue[] {
  if (isEmptyRow(ctx)) {
    return [
      issue(
        ctx,
        { name: "__row__", label: "Row" },
        "",
        "warning",
        "empty-row",
        `Row ${humanRow(ctx.rowIndex)}: this row is empty. Add data or remove the row.`,
      ),
    ];
  }

  const issues: ValidationIssue[] = [];
  for (const field of ctx.config.canonicalFields) {
    const required = requiredRule(ctx, field);
    if (required) {
      issues.push(required);
      continue; // no point checking type/range on an empty required cell
    }
    const numericName = numericNameRule(ctx, field);
    if (numericName) issues.push(numericName);
    const numeric = numericRule(ctx, field);
    if (numeric) issues.push(numeric);
  }
  issues.push(...crossFieldRules(ctx));
  issues.push(...gradeMeasureRules(ctx));
  return issues;
}
