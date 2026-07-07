import type { ValidationIssue } from "@assessment/shared";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Validation report CSV (FR-012): row_number, field_name, value, severity, message,
// sorted by row then field.
export function buildValidationReportCsv(issues: ValidationIssue[]): string {
  const sorted = [...issues].sort(
    (a, b) => a.rowIndex - b.rowIndex || a.field.localeCompare(b.field),
  );
  const header = ["row_number", "field_name", "value", "severity", "message"];
  const lines = [header.join(",")];
  for (const issue of sorted) {
    lines.push(
      [
        String(issue.rowIndex + 1),
        csvCell(issue.fieldLabel),
        csvCell(issue.value),
        issue.severity,
        csvCell(issue.message),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function downloadValidationReport(issues: ValidationIssue[], filename = "validation-report.csv"): void {
  const blob = new Blob([buildValidationReportCsv(issues)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
