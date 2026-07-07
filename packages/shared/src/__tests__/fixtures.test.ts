import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectAssessmentType,
  getAssessmentConfig,
  mapColumns,
  toColumnMapping,
  validateRows,
  type SourceRow,
} from "../index.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures",
);

// Minimal CSV reader — fixtures are generated with no embedded commas or quotes.
function readCsv(name: string): { header: string[]; rows: SourceRow[] } {
  const text = readFileSync(join(fixturesDir, name), "utf8").replace(/\n+$/, "");
  const lines = text.split("\n");
  const header = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const obj: SourceRow = {};
    header.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    return obj;
  });
  return { header, rows };
}

function readExpected(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, "expected", name), "utf8"));
}

const CENSUS_FIXTURES = [
  "dibels-clean",
  "dibels-dirty",
  "dibels-renamed-headers",
  "iready-clean",
  "iready-dirty",
  "star-clean",
  "star-dirty",
  "vallss-clean",
  "vallss-dirty",
  "amira-clean",
  "amira-dirty",
];

describe("engine reproduces every fixture census (T019)", () => {
  for (const base of CENSUS_FIXTURES) {
    it(`${base}: detect → map → validate matches expected`, () => {
      const expected = readExpected(`${base}.json`);
      const { header, rows } = readCsv(`${base}.csv`);

      // Detection should identify the authored type from the headers.
      const detection = detectAssessmentType(header);
      expect(detection.detected).toBe(expected.assessmentType);

      const config = getAssessmentConfig(expected.assessmentType)!;
      const mapping = toColumnMapping(mapColumns(header, config));
      const result = validateRows(rows, mapping, config);
      expect(result.summary).toEqual(expected.summary);
    });
  }
});

describe("independent sanity checks on the DIBELS dirty fixture", () => {
  const config = getAssessmentConfig("DIBELS_8")!;
  const { header, rows } = readCsv("dibels-dirty.csv");
  const mapping = toColumnMapping(mapColumns(header, config));
  const result = validateRows(rows, mapping, config);

  it("has 6 error rows, 4 warning rows, 5 clean rows over 15 total", () => {
    expect(result.summary).toEqual({ totalRows: 15, cleanRows: 5, errorRows: 6, warningRows: 4 });
  });

  it("covers each error rule kind at least once", () => {
    const rules = new Set(result.issues.filter((i) => i.severity === "error").map((i) => i.ruleId));
    for (const rule of ["required", "range-max", "negative-score", "type", "cross-field"]) {
      expect(rules.has(rule)).toBe(true);
    }
  });

  it("covers each warning rule kind at least once", () => {
    const rules = new Set(result.issues.filter((i) => i.severity === "warning").map((i) => i.ruleId));
    for (const rule of ["numeric-name", "empty-row", "grade-missing-measure", "grade-unexpected-measure"]) {
      expect(rules.has(rule)).toBe(true);
    }
  });
});

describe("ambiguous and empty fixtures", () => {
  it("ambiguous-headers.csv does not auto-detect (prompts manual selection, SC-002)", () => {
    const { header } = readCsv("ambiguous-headers.csv");
    const detection = detectAssessmentType(header);
    expect(detection.detected).toBeNull();
    expect(detection.ambiguous).toBe(true);
  });

  it("empty.csv has headers but zero data rows", () => {
    const { header, rows } = readCsv("empty.csv");
    expect(header.length).toBeGreaterThan(0);
    expect(rows).toHaveLength(0);
  });
});
