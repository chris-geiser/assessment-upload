/**
 * Fixture generator (T018). Produces clean/dirty/renamed CSVs for all 5 assessment
 * types plus ambiguous, empty, and multi-sheet fixtures, and writes an expected
 * validation census per census-bearing file to fixtures/expected/.
 *
 * Each dirty file is built so every dirty row injects exactly ONE defect, which
 * makes the row-level census hand-countable. The generator runs the shared engine
 * over each file and asserts the engine reproduces the hand-authored census before
 * writing it — so a committed expected/*.json is trustworthy, and the fixtures test
 * (T019) then locks the engine to it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as XLSX from "xlsx";
import {
  getAssessmentConfig,
  mapColumns,
  toColumnMapping,
  validateRows,
  type SourceRow,
  type ValidationSummary,
} from "@assessment/shared";

const here = dirname(fileURLToPath(import.meta.url));
const expectedDir = join(here, "expected");
mkdirSync(expectedDir, { recursive: true });

type Grid = string[][]; // [header, ...rows]

function toCsv(grid: Grid): string {
  return grid.map((r) => r.join(",")).join("\n") + "\n";
}

function toRows(grid: Grid): SourceRow[] {
  const [header, ...rows] = grid;
  return rows.map((cells) => {
    const obj: SourceRow = {};
    header.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    return obj;
  });
}

function censusOf(configId: string, grid: Grid): ValidationSummary {
  const config = getAssessmentConfig(configId)!;
  const header = grid[0];
  const mapping = toColumnMapping(mapColumns(header, config));
  return validateRows(toRows(grid), mapping, config).summary;
}

function writeCsvFixture(name: string, configId: string, grid: Grid): void {
  writeFileSync(join(here, name), toCsv(grid), "utf8");
  const summary = censusOf(configId, grid);
  writeFileSync(
    join(expectedDir, name.replace(/\.csv$/, ".json")),
    JSON.stringify({ file: name, assessmentType: configId, summary }, null, 2) + "\n",
    "utf8",
  );
  return;
}

function assertSummary(name: string, got: ValidationSummary, want: ValidationSummary): void {
  const same =
    got.totalRows === want.totalRows &&
    got.cleanRows === want.cleanRows &&
    got.errorRows === want.errorRows &&
    got.warningRows === want.warningRows;
  if (!same) {
    throw new Error(
      `Census mismatch for ${name}: engine=${JSON.stringify(got)} authored=${JSON.stringify(want)}`,
    );
  }
}

// ── DIBELS ───────────────────────────────────────────────────────────────────

const DIBELS_HEADER = [
  "Student ID", "First Name", "Last Name", "School", "Grade",
  "LNF", "PSF", "NWF-CLS", "NWF-WRC", "WRF", "ORF", "ORF-Accuracy", "MAZE", "ORF Words Attempted",
];

// grade-1 clean row template; overrides by column index.
function dibelsRow(id: string, first: string, last: string, over: Record<number, string> = {}): string[] {
  const base = [id, first, last, "Lincoln Elementary", "1", "40", "35", "30", "12", "25", "50", "95", "", ""];
  for (const [i, v] of Object.entries(over)) base[Number(i)] = v;
  return base;
}

const dibelsClean: Grid = [
  DIBELS_HEADER,
  dibelsRow("1001", "Ada", "Lovelace"),
  dibelsRow("1002", "Grace", "Hopper"),
  dibelsRow("1003", "Alan", "Turing"),
  dibelsRow("1004", "Katherine", "Johnson"),
  dibelsRow("1005", "Dorothy", "Vaughan"),
];

const dibelsDirty: Grid = [
  DIBELS_HEADER,
  // 5 clean
  dibelsRow("2001", "Ada", "Lovelace"),
  dibelsRow("2002", "Grace", "Hopper"),
  dibelsRow("2003", "Alan", "Turing"),
  dibelsRow("2004", "Katherine", "Johnson"),
  dibelsRow("2005", "Dorothy", "Vaughan"),
  // 6 errors, one defect each
  dibelsRow("", "Missing", "Id"), // E1 required student_id empty
  dibelsRow("2007", "Over", "Max", { 10: "412" }), // E2 ORF > 350
  dibelsRow("2008", "Neg", "Score", { 5: "-5" }), // E3 negative LNF
  dibelsRow("2009", "Not", "Numeric", { 6: "abc" }), // E4 non-numeric PSF
  dibelsRow("2010", "Cls", "Over", { 7: "999" }), // E5 NWF-CLS > 95
  dibelsRow("2011", "Cross", "Field", { 10: "50", 12: "", 13: "60", 11: "99" }), // E6 acc 99 vs ~83 expected
  // 4 warnings, one each
  dibelsRow("2012", "404", "Numeric-Name"), // W1 numeric first name
  ["", "", "", "", "", "", "", "", "", "", "", "", "", ""], // W2 empty row
  dibelsRow("2014", "Missing", "OrfAcc", { 11: "" }), // W3 grade-1 expects ORF-Accuracy, empty
  dibelsRow("2015", "Maze", "Unexpected", { 12: "8" }), // W4 MAZE unexpected for grade 1
];

const DIBELS_RENAMED_HEADER = [
  "LASID", "Student First Name", "Student Last Name", "School Name", "Grade Level",
  "LNF - Fall Score", "PSF - Fall Score", "NWF-CLS - Fall Score", "NWF-WWR - Fall Score",
  "WRF - Fall Score", "ORF - Fall Score", "ORF - Fall Accuracy", "MAZE - Fall Raw Score",
];
const dibelsRenamed: Grid = [
  DIBELS_RENAMED_HEADER,
  ["3001", "Ada", "Lovelace", "Lincoln Elementary", "1", "40", "35", "30", "12", "25", "50", "95", ""],
  ["3002", "Grace", "Hopper", "Lincoln Elementary", "1", "42", "38", "33", "15", "28", "60", "97", ""],
  ["3003", "Alan", "Turing", "Lincoln Elementary", "1", "45", "40", "35", "18", "30", "70", "98", ""],
];

// ── Generic helpers for the flat (no grade requirement) types ─────────────────

interface FlatSpec {
  configId: string;
  header: string[];
  clean: string[]; // one clean row template (5 identity + measures)
  overMax: [number, string]; // [col index, value that exceeds max]
  negative: [number, string];
  nonNumeric: [number, string];
}

function flatFixtures(spec: FlatSpec): { clean: Grid; dirty: Grid } {
  const mk = (id: string, first: string, last: string, over: Record<number, string> = {}) => {
    const row = [...spec.clean];
    row[0] = id;
    row[1] = first;
    row[2] = last;
    for (const [i, v] of Object.entries(over)) row[Number(i)] = v;
    return row;
  };
  const emptyRow = spec.header.map(() => "");
  const clean: Grid = [
    spec.header,
    mk("C1", "Ada", "Lovelace"),
    mk("C2", "Grace", "Hopper"),
    mk("C3", "Alan", "Turing"),
    mk("C4", "Katherine", "Johnson"),
  ];
  const dirty: Grid = [
    spec.header,
    mk("D1", "Ada", "Lovelace"),
    mk("D2", "Grace", "Hopper"),
    mk("D3", "Alan", "Turing"),
    mk("", "Missing", "Id"), // E1 required id empty
    mk("D5", "Over", "Max", { [spec.overMax[0]]: spec.overMax[1] }), // E2
    mk("D6", "Neg", "Score", { [spec.negative[0]]: spec.negative[1] }), // E3
    mk("D7", "Not", "Numeric", { [spec.nonNumeric[0]]: spec.nonNumeric[1] }), // E4
    mk("D8", "77", "Numeric-Name"), // W1 numeric first name
    emptyRow, // W2 empty row
  ];
  return { clean, dirty };
}

const iready = flatFixtures({
  configId: "IREADY",
  header: ["Student ID", "First Name", "Last Name", "School", "Grade",
    "Overall Scale Score", "Phonological Awareness", "Phonics", "High-Frequency Words", "Vocabulary", "Reading Comprehension"],
  clean: ["C", "F", "L", "Lincoln Elementary", "1", "540", "520", "530", "510", "545", "500"],
  overMax: [5, "900"], negative: [7, "-3"], nonNumeric: [9, "xyz"],
});

const star = flatFixtures({
  configId: "STAR",
  header: ["Student ID", "First Name", "Last Name", "School", "Grade",
    "Scaled Score", "Unified Score", "Percentile Rank", "Alphabetic Decoding",
    "Structural Analysis", "Sentence-Level Comprehension"],
  clean: ["C", "F", "L", "Lincoln Elementary", "1", "850", "860", "55", "620", "610", "600"],
  overMax: [5, "1500"], negative: [6, "-10"], nonNumeric: [7, "high"],
});

const vallss = flatFixtures({
  configId: "VALLSS",
  header: ["Student SIS ID", "First Name", "Last Name", "School", "Grade",
    "Letter Sounds", "Sight Words", "Decodable Words", "Passage Reading", "Passage Retell"],
  clean: ["C", "F", "L", "Lincoln Elementary", "1", "24", "40", "35", "6", "9"],
  overMax: [5, "40"], negative: [6, "-2"], nonNumeric: [8, "x"],
});

const amira = flatFixtures({
  configId: "AMIRA",
  header: ["Student ID", "First Name", "Last Name", "School", "Grade",
    "Oral Reading Fluency", "Accuracy", "Comprehension", "Phonics Screener", "ISIP Reading", "Overall Ability"],
  clean: ["C", "F", "L", "Lincoln Elementary", "1", "120", "95", "80", "70", "180", "190"],
  overMax: [5, "500"], negative: [6, "-5"], nonNumeric: [7, "n/a"],
});

// ── Write everything ──────────────────────────────────────────────────────────

writeCsvFixture("dibels-clean.csv", "DIBELS_8", dibelsClean);
writeCsvFixture("dibels-dirty.csv", "DIBELS_8", dibelsDirty);
writeCsvFixture("dibels-renamed-headers.csv", "DIBELS_8", dibelsRenamed);
writeCsvFixture("iready-clean.csv", "IREADY", iready.clean);
writeCsvFixture("iready-dirty.csv", "IREADY", iready.dirty);
writeCsvFixture("star-clean.csv", "STAR", star.clean);
writeCsvFixture("star-dirty.csv", "STAR", star.dirty);
writeCsvFixture("vallss-clean.csv", "VALLSS", vallss.clean);
writeCsvFixture("vallss-dirty.csv", "VALLSS", vallss.dirty);
writeCsvFixture("amira-clean.csv", "AMIRA", amira.clean);
writeCsvFixture("amira-dirty.csv", "AMIRA", amira.dirty);

// Ambiguous headers: shared measure names put i-Ready and Amira within 15 points.
const ambiguous: Grid = [
  ["Student ID", "First Name", "Last Name", "School", "Grade", "Phonics", "Vocabulary", "Comprehension"],
  ["A1", "Sam", "Reed", "Lincoln Elementary", "1", "12", "14", "10"],
  ["A2", "Pat", "Lee", "Lincoln Elementary", "2", "13", "15", "11"],
];
writeFileSync(join(here, "ambiguous-headers.csv"), toCsv(ambiguous), "utf8");

// Empty: headers only, zero data rows.
writeFileSync(join(here, "empty.csv"), DIBELS_HEADER.join(",") + "\n", "utf8");

// Multi-sheet workbook: a notes sheet plus a DIBELS data sheet (for sheet selection).
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([["District export"], ["Generated for fixtures"]]),
  "ReadMe",
);
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dibelsClean), "DIBELS");
XLSX.writeFile(wb, join(here, "multi-sheet.xlsx"));

// ── Self-check the authored censuses ──────────────────────────────────────────

assertSummary("dibels-clean.csv", censusOf("DIBELS_8", dibelsClean), { totalRows: 5, cleanRows: 5, errorRows: 0, warningRows: 0 });
assertSummary("dibels-dirty.csv", censusOf("DIBELS_8", dibelsDirty), { totalRows: 15, cleanRows: 5, errorRows: 6, warningRows: 4 });
assertSummary("dibels-renamed-headers.csv", censusOf("DIBELS_8", dibelsRenamed), { totalRows: 3, cleanRows: 3, errorRows: 0, warningRows: 0 });
for (const [name, id, g] of [
  ["iready-dirty.csv", "IREADY", iready.dirty],
  ["star-dirty.csv", "STAR", star.dirty],
  ["vallss-dirty.csv", "VALLSS", vallss.dirty],
  ["amira-dirty.csv", "AMIRA", amira.dirty],
] as const) {
  assertSummary(name, censusOf(id, g), { totalRows: 9, cleanRows: 3, errorRows: 4, warningRows: 2 });
}

console.log("Fixtures generated and censuses verified.");
