import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DataGrid, type DataGridColumn } from "./DataGrid.js";

const columns: DataGridColumn[] = [
  { key: "student_id", header: "Student ID" },
  { key: "ORF", header: "ORF", editable: true },
];

function Harness({ onCommit }: { onCommit: (r: number, c: string, v: string) => void }) {
  const [data, setData] = useState<string[]>(["412", "50", "60"]);
  return (
    <DataGrid
      columns={columns}
      rowCount={data.length}
      getCell={(r, c) => (c === "ORF" ? data[r] : `100${r}`)}
      onCommit={(r, c, v) => {
        setData((d) => d.map((x, i) => (i === r ? v : x)));
        onCommit(r, c, v);
      }}
      cellMessage={(r, c) => (c === "ORF" && data[r] === "412" ? "Row 1: ORF exceeds maximum" : undefined)}
    />
  );
}

describe("DataGrid", () => {
  it("commits an inline edit on Enter and surfaces cell messages to assistive tech", async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    // The editable cell exposes its value + message in the accessible name.
    const cell = screen.getByRole("button", { name: /ORF, row 1: 412\. Row 1: ORF exceeds maximum/ });
    await userEvent.click(cell);

    const input = screen.getByRole("textbox", { name: /Edit ORF, row 1/ });
    await userEvent.clear(input);
    await userEvent.type(input, "300{Enter}");

    expect(onCommit).toHaveBeenCalledWith(0, "ORF", "300");
    expect(screen.getByRole("button", { name: /ORF, row 1: 300/ })).toBeInTheDocument();
  });

  it("cancels an edit on Escape without committing", async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await userEvent.click(screen.getByRole("button", { name: /ORF, row 2: 50/ }));
    const input = screen.getByRole("textbox", { name: /Edit ORF, row 2/ });
    await userEvent.clear(input);
    await userEvent.type(input, "999{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /ORF, row 2: 50/ })).toBeInTheDocument();
  });

  it("windows large row counts (only a slice of 10,000 rows is in the DOM)", () => {
    render(
      <DataGrid
        columns={columns}
        rowCount={10000}
        getCell={(r, c) => `${c}-${r}`}
        onCommit={() => {}}
        viewportHeight={480}
        rowHeight={40}
      />,
    );
    // Non-editable cells render as text; far fewer than 10,000 are present.
    const cells = screen.getAllByText(/^student_id-\d+$/);
    expect(cells.length).toBeLessThan(60);
    expect(cells.length).toBeGreaterThan(0);
  });
});
