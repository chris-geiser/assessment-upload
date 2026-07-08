import { useMemo, useState } from "react";
import type { AssessmentConfig, ValidationIssue, ValidationSummary } from "@assessment/shared";
import { Btn, DataGrid, SecondaryBtn, SummaryCard, cx, type DataGridColumn } from "../../kit/index.js";
import { focusRing } from "../../kit/cx.js";
import { downloadValidationReport } from "./report.js";

type Filter = "all" | "issues";

export function ValidationGrid({
  config,
  mappedFields,
  rowCount,
  summary,
  submittedCount,
  allIssues,
  cellValueFor,
  editCell,
  issuesForCell,
  rowSeverity,
  onBack,
  actionBar,
}: {
  config: AssessmentConfig;
  mappedFields: string[];
  rowCount: number;
  summary: ValidationSummary | null;
  submittedCount?: number;
  allIssues: ValidationIssue[];
  cellValueFor: (rowIndex: number, field: string) => string;
  editCell: (rowIndex: number, field: string, value: string) => void;
  issuesForCell: (rowIndex: number, field: string) => ValidationIssue | undefined;
  rowSeverity: (rowIndex: number) => "error" | "warning" | null;
  onBack: () => void;
  actionBar?: React.ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [legendOpen, setLegendOpen] = useState(false);

  const columns: DataGridColumn[] = useMemo(
    () =>
      mappedFields.map((name) => ({
        key: name,
        header: config.canonicalFields.find((f) => f.name === name)?.label ?? name,
        editable: true,
      })),
    [mappedFields, config],
  );

  // Filtering maps a visible index → the stable original row index so edits and
  // messages stay correct (partial-submit bookkeeping depends on stable indexes).
  const visibleRows = useMemo(() => {
    if (filter === "all") return Array.from({ length: rowCount }, (_, i) => i);
    const withIssues: number[] = [];
    for (let i = 0; i < rowCount; i++) if (rowSeverity(i)) withIssues.push(i);
    return withIssues;
  }, [filter, rowCount, rowSeverity]);

  const actual = (visibleIndex: number) => visibleRows[visibleIndex];

  return (
    <section aria-label="Validation results" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Errors" value={summary?.errorRows ?? 0} tone="error" />
        {/* Warning card is always yellow, even at zero (US3 scenario 2). */}
        <SummaryCard label="Warnings" value={summary?.warningRows ?? 0} tone="warning" />
        <SummaryCard label="Clean" value={summary?.cleanRows ?? 0} tone="success" />
        {submittedCount !== undefined && (
          <SummaryCard label="Submitted" value={submittedCount} tone="processing" />
        )}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={legendOpen}
          onClick={() => setLegendOpen((v) => !v)}
          className={cx("text-sm font-medium text-brand underline underline-offset-2", focusRing)}
        >
          {legendOpen ? "Hide legend" : "Open legend"}
        </button>
        {legendOpen && (
          <div className="mt-2 flex flex-wrap gap-4 rounded-md border border-neutral-200 bg-white p-3 text-sm">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-4 w-4 rounded border-2 border-red-400 bg-red-50" />
              Error — must be fixed before this row can submit
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-4 w-4 rounded border-2 border-yellow-400 bg-yellow-50" />
              Warning — review, but can still submit
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-4 w-4 rounded border border-neutral-300 bg-white" />
              Clean — no issues
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Row filter" className="flex gap-2">
          <SecondaryBtn onClick={() => setFilter("all")} aria-pressed={filter === "all"}>
            All Rows
          </SecondaryBtn>
          <SecondaryBtn onClick={() => setFilter("issues")} aria-pressed={filter === "issues"}>
            Rows with Issues
          </SecondaryBtn>
        </div>
        <SecondaryBtn onClick={() => downloadValidationReport(allIssues)} disabled={allIssues.length === 0}>
          Download validation report
        </SecondaryBtn>
      </div>

      {visibleRows.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600">
          {filter === "issues" ? "No rows with issues. Everything looks clean." : "No rows to show."}
        </p>
      ) : (
        <DataGrid
          columns={columns}
          rowCount={visibleRows.length}
          getCell={(vi, col) => cellValueFor(actual(vi), col)}
          onCommit={(vi, col, value) => editCell(actual(vi), col, value)}
          cellMessage={(vi, col) => issuesForCell(actual(vi), col)?.message}
          rowLabel={(vi) => `Row ${actual(vi) + 1}`}
          rowClassName={(vi) => {
            const sev = rowSeverity(actual(vi));
            return sev === "error" ? "bg-red-50" : sev === "warning" ? "bg-yellow-50" : undefined;
          }}
          cellClassName={(vi, col) => {
            const issue = issuesForCell(actual(vi), col);
            if (!issue) return undefined;
            return cx(
              "border-2",
              issue.severity === "error" ? "border-red-400" : "border-yellow-400",
            );
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <SecondaryBtn onClick={onBack}>Back</SecondaryBtn>
        <div className="flex items-center gap-3">{actionBar ?? <Btn disabled>Submit (next phase)</Btn>}</div>
      </div>
    </section>
  );
}
