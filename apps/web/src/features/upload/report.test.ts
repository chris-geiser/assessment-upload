import { describe, expect, it } from "vitest";
import type { ValidationIssue } from "@assessment/shared";
import { buildValidationReportCsv } from "./report.js";

const issues: ValidationIssue[] = [
  { rowIndex: 1, field: "ORF", fieldLabel: "ORF", value: "999", severity: "error", message: "Row 2: ORF too high, fix it.", ruleId: "range-max" },
  { rowIndex: 0, field: "student_id", fieldLabel: "Student ID", value: "", severity: "error", message: "Row 1: Student ID is empty.", ruleId: "required" },
];

describe("buildValidationReportCsv", () => {
  it("emits the required columns sorted by row then field, with 1-based row numbers", () => {
    const lines = buildValidationReportCsv(issues).trim().split("\n");
    expect(lines[0]).toBe("row_number,field_name,value,severity,message");
    expect(lines[1].startsWith("1,Student ID,")).toBe(true);
    expect(lines[2].startsWith("2,ORF,")).toBe(true);
  });

  it("quotes values containing commas", () => {
    const csv = buildValidationReportCsv(issues);
    expect(csv).toContain('"Row 2: ORF too high, fix it."');
  });
});
