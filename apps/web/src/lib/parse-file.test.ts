import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFile } from "./parse-file.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../fixtures");

function csvFile(name: string, content: string): File {
  return new File([content], name, { type: "text/csv" });
}

describe("parseFile", () => {
  it("parses a comma CSV into headers + row objects", async () => {
    const out = await parseFile(csvFile("d.csv", "Student ID,LNF\n1001,40\n1002,42\n"));
    expect(out.status).toBe("parsed");
    if (out.status !== "parsed") return;
    expect(out.parsed.headers).toEqual(["Student ID", "LNF"]);
    expect(out.parsed.rowCount).toBe(2);
    expect(out.parsed.rows[0]).toEqual({ "Student ID": "1001", LNF: "40" });
  });

  it("auto-detects a tab delimiter", async () => {
    const out = await parseFile(csvFile("t.csv", "Student ID\tLNF\n1001\t40\n"));
    expect(out.status).toBe("parsed");
    if (out.status !== "parsed") return;
    expect(out.parsed.delimiter).toBe("\t");
    expect(out.parsed.headers).toEqual(["Student ID", "LNF"]);
  });

  it("keeps interior empty rows but drops the trailing newline artifact", async () => {
    const out = await parseFile(csvFile("e.csv", "A,B\n1,2\n,\n3,4\n"));
    expect(out.status).toBe("parsed");
    if (out.status !== "parsed") return;
    expect(out.parsed.rowCount).toBe(3); // includes the interior blank row
  });

  it("treats a zero-byte file as empty", async () => {
    const out = await parseFile(new File([], "empty.csv"));
    expect(out.status).toBe("empty");
  });

  it("parses headers-only files with zero data rows", async () => {
    const out = await parseFile(csvFile("h.csv", "Student ID,LNF\n"));
    expect(out.status).toBe("parsed");
    if (out.status !== "parsed") return;
    expect(out.parsed.rowCount).toBe(0);
  });

  it("prompts for a sheet on a multi-sheet workbook, then parses the chosen sheet", async () => {
    const bytes = readFileSync(join(fixturesDir, "multi-sheet.xlsx"));
    const file = () => new File([bytes], "multi-sheet.xlsx");

    const needs = await parseFile(file());
    expect(needs.status).toBe("needs-sheet");
    if (needs.status !== "needs-sheet") return;
    expect(needs.sheetNames).toContain("DIBELS");

    const parsed = await parseFile(file(), { sheetName: "DIBELS" });
    expect(parsed.status).toBe("parsed");
    if (parsed.status !== "parsed") return;
    expect(parsed.parsed.headers).toContain("LNF");
    expect(parsed.parsed.rowCount).toBeGreaterThan(0);
  });

  it("returns a friendly error for a corrupted Excel file", async () => {
    const out = await parseFile(new File([new Uint8Array([1, 2, 3, 4, 5])], "bad.xlsx"));
    expect(out.status).toBe("error");
  });
});
