import { describe, expect, it } from "vitest";
import { validateRows, validateSingleRow } from "./engine.js";
import { dibels8 } from "../assessment-configs/index.js";
import type { ColumnMapping, SourceRow } from "../types.js";

// Identity mapping (canonical name === source header) for terse test rows.
const mapping: ColumnMapping = {
  student_id: "student_id",
  student_first_name: "student_first_name",
  student_last_name: "student_last_name",
  school_name: "school_name",
  grade: "grade",
  LNF: "LNF",
  PSF: "PSF",
  NWF_CLS: "NWF_CLS",
  NWF_WRC: "NWF_WRC",
  WRF: "WRF",
  ORF: "ORF",
  ORF_ACC: "ORF_ACC",
  MAZE: "MAZE",
  ORF_WORDS_ATTEMPTED: "ORF_WORDS_ATTEMPTED",
};

function row(over: Partial<SourceRow> = {}): SourceRow {
  return {
    student_id: "1001",
    student_first_name: "Ada",
    student_last_name: "Lovelace",
    school_name: "Lincoln Elementary",
    grade: "1",
    LNF: "40",
    PSF: "35",
    NWF_CLS: "30",
    NWF_WRC: "12",
    WRF: "25",
    ORF: "50",
    ORF_ACC: "95",
    ...over,
  };
}

describe("validation engine", () => {
  it("passes a clean row with zero issues", () => {
    const r = validateRows([row()], mapping, dibels8);
    expect(r.summary).toEqual({ totalRows: 1, cleanRows: 1, errorRows: 0, warningRows: 0 });
  });

  it("flags a missing required field as an error (P4 format)", () => {
    const r = validateRows([row({ student_id: "" })], mapping, dibels8);
    expect(r.summary.errorRows).toBe(1);
    const iss = r.issues.find((i) => i.field === "student_id")!;
    expect(iss.severity).toBe("error");
    expect(iss.message).toBe(
      "Row 1: Student ID is empty. Enter the student id or remove the row.",
    );
  });

  it("treats whitespace-only cells as empty", () => {
    const r = validateRows([row({ student_id: "   " })], mapping, dibels8);
    expect(r.summary.errorRows).toBe(1);
  });

  it("flags an out-of-range score with the value and maximum named", () => {
    const r = validateRows([row({ ORF: "412" })], mapping, dibels8);
    const iss = r.issues.find((i) => i.field === "ORF")!;
    expect(iss.severity).toBe("error");
    expect(iss.message).toContain("412");
    expect(iss.message).toContain("350");
  });

  it("flags negative scores and non-numeric scores as errors", () => {
    expect(validateRows([row({ LNF: "-5" })], mapping, dibels8).issues[0].ruleId).toBe("negative-score");
    expect(validateRows([row({ LNF: "abc" })], mapping, dibels8).issues[0].ruleId).toBe("type");
  });

  it("warns (not errors) on a numeric name", () => {
    const r = validateRows([row({ student_first_name: "123" })], mapping, dibels8);
    expect(r.summary.errorRows).toBe(0);
    expect(r.summary.warningRows).toBe(1);
    expect(r.issues[0].ruleId).toBe("numeric-name");
  });

  it("warns on a fully empty row", () => {
    const empty: SourceRow = Object.fromEntries(
      Object.keys(mapping).map((k) => [k, ""]),
    );
    const r = validateRows([empty], mapping, dibels8);
    expect(r.summary.warningRows).toBe(1);
    expect(r.issues[0].ruleId).toBe("empty-row");
  });

  it("warns when an expected grade-1 measure is empty and when MAZE appears for grade 1", () => {
    const missing = validateRows([row({ ORF_ACC: "" })], mapping, dibels8);
    expect(missing.issues.some((i) => i.ruleId === "grade-missing-measure")).toBe(true);

    const unexpected = validateRows(
      [row({ MAZE: "8" })],
      { ...mapping },
      dibels8,
    );
    expect(unexpected.issues.some((i) => i.ruleId === "grade-unexpected-measure")).toBe(true);
  });

  it("flags ORF-Accuracy inconsistent with words correct/attempted (±10% cross-field)", () => {
    // 50 of 60 words correct → ~83% expected; reported 99% is inconsistent.
    const r = validateRows(
      [row({ ORF: "50", ORF_WORDS_ATTEMPTED: "60", ORF_ACC: "99" })],
      mapping,
      dibels8,
    );
    const iss = r.issues.find((i) => i.ruleId === "cross-field");
    expect(iss?.severity).toBe("error");
  });

  it("accepts a consistent ORF-Accuracy within tolerance", () => {
    // 55 of 60 → ~92%; reported 90% is within ±10 points.
    const r = validateRows(
      [row({ ORF: "55", ORF_WORDS_ATTEMPTED: "60", ORF_ACC: "90" })],
      mapping,
      dibels8,
    );
    expect(r.issues.some((i) => i.ruleId === "cross-field")).toBe(false);
  });

  it("re-validates a single row for inline edits", () => {
    const before = validateSingleRow(row({ ORF: "412" }), 0, mapping, dibels8);
    expect(before.some((i) => i.field === "ORF")).toBe(true);
    const after = validateSingleRow(row({ ORF: "300" }), 0, mapping, dibels8);
    expect(after.some((i) => i.field === "ORF")).toBe(false);
  });

  it("every message starts with the 1-based row and names a field (SC-006/P4)", () => {
    const r = validateRows(
      [row({ student_id: "", ORF: "999", student_first_name: "5" })],
      mapping,
      dibels8,
    );
    for (const iss of r.issues) {
      expect(iss.message).toMatch(/^Row \d+:/);
      expect(iss.message.length).toBeGreaterThan(20);
    }
  });
});
