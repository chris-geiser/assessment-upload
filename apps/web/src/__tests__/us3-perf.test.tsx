import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  getAssessmentConfig,
  validateRows,
  type ColumnMapping,
  type SourceRow,
} from "@assessment/shared";
import { DataGrid } from "../kit/DataGrid.js";

const config = getAssessmentConfig("DIBELS_8")!;
const mapping: ColumnMapping = {
  student_id: "student_id", student_first_name: "student_first_name", student_last_name: "student_last_name",
  school_name: "school_name", grade: "grade",
  LNF: "LNF", PSF: "PSF", NWF_CLS: "NWF_CLS", NWF_WRC: "NWF_WRC", WRF: "WRF", ORF: "ORF", ORF_ACC: "ORF_ACC",
};

function makeRows(n: number): SourceRow[] {
  const rows: SourceRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      student_id: String(1000 + i), student_first_name: "First", student_last_name: "Last",
      school_name: "Lincoln", grade: "1",
      LNF: "40", PSF: "35", NWF_CLS: "30", NWF_WRC: "12", WRF: "25",
      ORF: i % 100 === 0 ? "999" : "50", ORF_ACC: "95",
    });
  }
  return rows;
}

describe("US3 performance (T042)", () => {
  it("validates 10,000 rows well within the 10s budget", () => {
    const rows = makeRows(10_000);
    const start = performance.now();
    const result = validateRows(rows, mapping, config);
    const elapsedMs = performance.now() - start;
    expect(result.summary.totalRows).toBe(10_000);
    expect(result.summary.errorRows).toBe(100); // every 100th row has ORF 999
    expect(elapsedMs).toBeLessThan(10_000);
  });

  it("windows 10,000 rows so only a small slice is in the DOM", () => {
    render(
      <DataGrid
        columns={[{ key: "student_id", header: "Student ID" }]}
        rowCount={10_000}
        getCell={(r) => `S${r}`}
        onCommit={() => {}}
        viewportHeight={480}
        rowHeight={40}
      />,
    );
    expect(screen.getAllByText(/^S\d+$/).length).toBeLessThan(60);
  });
});
