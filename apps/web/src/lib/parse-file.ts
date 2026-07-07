import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { SourceRow } from "@assessment/shared";

export interface ParsedFile {
  headers: string[];
  rows: SourceRow[];
  rowCount: number;
  columnCount: number;
  delimiter?: string;
  sheetName?: string;
}

export type ParseOutcome =
  | { status: "parsed"; parsed: ParsedFile }
  | { status: "needs-sheet"; sheetNames: string[] } // multi-sheet xlsx, no sheet chosen
  | { status: "empty" } // no headers at all (empty file)
  | { status: "error"; message: string };

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

const CSV_EXT = /\.csv$/i;
const EXCEL_EXT = /\.(xlsx|xls)$/i;

function decodeText(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // CSV in non-UTF-8 encoding: fall back to ISO-8859-1 (edge case).
    return new TextDecoder("iso-8859-1").decode(bytes);
  }
}

// Drop a trailing run of fully-empty rows (artifact of a terminal newline) while
// keeping interior empty rows, which the engine flags as empty-row warnings.
function trimTrailingEmpty(rows: string[][]): string[][] {
  let end = rows.length;
  while (end > 0 && rows[end - 1].every((c) => (c ?? "").trim() === "")) end -= 1;
  return rows.slice(0, end);
}

function buildParsed(matrix: string[][], extra: Partial<ParsedFile>): ParseOutcome {
  if (matrix.length === 0 || matrix[0].every((c) => (c ?? "").trim() === "")) {
    return { status: "empty" };
  }
  const headers = matrix[0].map((h) => (h ?? "").trim());
  const dataRows = trimTrailingEmpty(matrix.slice(1));
  const rows: SourceRow[] = dataRows.map((cells) => {
    const obj: SourceRow = {};
    headers.forEach((h, i) => (obj[h] = (cells[i] ?? "").toString()));
    return obj;
  });
  return {
    status: "parsed",
    parsed: {
      headers,
      rows,
      rowCount: rows.length,
      columnCount: headers.length,
      ...extra,
    },
  };
}

// Deterministic delimiter detection from the header line (comma, tab, pipe, semicolon).
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", "\t", "|", ";"];
  let best = ",";
  let bestCount = 0;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

async function parseCsv(buf: ArrayBuffer): Promise<ParseOutcome> {
  const text = decodeText(buf);
  if (text.trim() === "") return { status: "empty" };
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
    delimiter: detectDelimiter(text),
  });
  if (result.errors.some((e) => e.type === "Quotes" || e.code === "UndetectableDelimiter")) {
    // Non-fatal; PapaParse is forgiving. Only hard-fail below.
  }
  const matrix = result.data.filter((r) => Array.isArray(r)) as string[][];
  return buildParsed(matrix, { delimiter: result.meta.delimiter });
}

// OOXML (.xlsx) files are ZIP archives ("PK\x03\x04"); legacy .xls (BIFF) begins
// with the OLE compound-file magic (0xD0 0xCF 0x11 0xE0). Anything else under an
// Excel extension is corrupted (spec edge case).
function looksLikeExcel(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf);
  if (b.length < 4) return false;
  const isZip = b[0] === 0x50 && b[1] === 0x4b;
  const isOle = b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  return isZip || isOle;
}

function parseExcel(buf: ArrayBuffer, sheetName?: string): ParseOutcome {
  if (!looksLikeExcel(buf)) {
    return { status: "error", message: "This does not look like a valid Excel file. Re-export it and try again." };
  }
  const wb = XLSX.read(buf, { type: "array" });
  if (wb.SheetNames.length === 0) return { status: "empty" };
  if (!sheetName && wb.SheetNames.length > 1) {
    return { status: "needs-sheet", sheetNames: wb.SheetNames };
  }
  const chosen = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[chosen];
  if (!ws) return { status: "error", message: `Sheet "${chosen}" was not found in the file.` };
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
  return buildParsed(matrix, { sheetName: chosen });
}

// Prefer Blob.arrayBuffer (browsers, Node); fall back to FileReader (jsdom).
async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseFile(
  file: File,
  opts: { sheetName?: string } = {},
): Promise<ParseOutcome> {
  if (file.size === 0) return { status: "empty" };
  let buf: ArrayBuffer;
  try {
    buf = await readArrayBuffer(file);
  } catch (err) {
    return { status: "error", message: `The file could not be read: ${(err as Error).message}` };
  }
  try {
    if (EXCEL_EXT.test(file.name)) return parseExcel(buf, opts.sheetName);
    if (CSV_EXT.test(file.name) || file.type === "text/csv") return await parseCsv(buf);
    // Unknown extension: try CSV as a best effort.
    return await parseCsv(buf);
  } catch (err) {
    return {
      status: "error",
      message: `The file could not be parsed. Confirm it is a valid CSV or Excel file. (${(err as Error).message})`,
    };
  }
}
