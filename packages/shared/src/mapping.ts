import Fuse from "fuse.js";
import type {
  AssessmentConfig,
  CanonicalField,
  ColumnMapping,
  ConfidenceBand,
  FieldMapping,
  MappingResult,
  SourceRow,
} from "./types.js";
import { NOT_PRESENT } from "./types.js";
import { normalizeHeader } from "./detection.js";

export const FUZZY_SIMILARITY_THRESHOLD = 0.7; // below this → unmapped (US-2.1)
export const FUZZY_MEDIUM_THRESHOLD = 0.85; // ≥ this → Medium, else Low

function bandFor(strategy: FieldMapping["strategy"], similarity: number): ConfidenceBand {
  if (strategy === "exact" || strategy === "synonym") return "high";
  if (strategy === "fuzzy") {
    if (similarity >= FUZZY_MEDIUM_THRESHOLD) return "medium";
    if (similarity >= FUZZY_SIMILARITY_THRESHOLD) return "low";
  }
  return "none";
}

function fractionNumeric(sampleRows: SourceRow[], header: string): number {
  const values = sampleRows
    .map((r) => (r[header] ?? "").trim())
    .filter((v) => v !== "");
  if (values.length === 0) return 0;
  const numeric = values.filter((v) => !Number.isNaN(Number(v))).length;
  return numeric / values.length;
}

// Multi-strategy auto-mapper (FR-007, D8). Strategy order per canonical field:
// (1) exact, (2) synonym, (3) fuzzy (Fuse.js, similarity ≥ 0.70), (4) heuristics.
// Identity fields never fuzzy-auto-map; a fuzzy identity candidate is surfaced as a
// non-auto-selected suggestion instead.
export function mapColumns(
  headers: string[],
  config: AssessmentConfig,
  sampleRows: SourceRow[] = [],
): MappingResult {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const claimed = new Set<string>(); // source headers taken by exact/synonym

  const fuse = new Fuse(normalized, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.6,
    minMatchCharLength: 2,
    keys: ["norm"],
  });

  const result: MappingResult = {};

  // Pass 1: exact + synonym (deterministic, first-wins by header order).
  for (const field of config.canonicalFields) {
    result[field.name] = { sourceColumn: null, confidence: 0, band: "none", strategy: "none" };
    for (const h of normalized) {
      if (h.norm === field.name.toLowerCase() || h.norm === field.label.toLowerCase()) {
        result[field.name] = { sourceColumn: h.raw, confidence: 1, band: "high", strategy: "exact" };
        claimed.add(h.raw);
        break;
      }
    }
    if (result[field.name].sourceColumn) continue;
    for (const h of normalized) {
      if (config.synonymMap[h.norm] === field.name) {
        result[field.name] = { sourceColumn: h.raw, confidence: 0.95, band: "high", strategy: "synonym" };
        claimed.add(h.raw);
        break;
      }
    }
  }

  // Pass 2: fuzzy + heuristics for still-unmapped fields.
  for (const field of config.canonicalFields) {
    if (result[field.name].sourceColumn) continue;
    const candidate = bestFuzzy(fuse, field, claimed, sampleRows);
    if (!candidate) continue;

    const isIdentity = field.category === "student";
    if (isIdentity) {
      // D8: surface as a low-confidence suggestion, never auto-select.
      result[field.name] = {
        sourceColumn: null,
        confidence: candidate.similarity,
        band: "none",
        strategy: "none",
        suggestion: candidate.header,
      };
      continue;
    }

    const band = bandFor("fuzzy", candidate.similarity);
    if (band === "none") continue;
    result[field.name] = {
      sourceColumn: candidate.header,
      confidence: candidate.similarity,
      band,
      strategy: "fuzzy",
    };
    claimed.add(candidate.header);
  }

  return result;
}

function bestFuzzy(
  fuse: Fuse<{ raw: string; norm: string }>,
  field: CanonicalField,
  claimed: Set<string>,
  sampleRows: SourceRow[],
): { header: string; similarity: number } | null {
  const hits = [
    ...fuse.search(field.label.toLowerCase()),
    ...fuse.search(field.name.toLowerCase().replace(/_/g, " ")),
  ]
    .map((h) => ({ header: h.item.raw, similarity: 1 - (h.score ?? 1) }))
    .filter((h) => !claimed.has(h.header))
    .sort((a, b) => b.similarity - a.similarity);

  for (const hit of hits) {
    if (hit.similarity < FUZZY_SIMILARITY_THRESHOLD) return null;
    // Heuristic (numeric ratio): don't fuzzy-map a numeric measure to a column that
    // is mostly non-numeric in the sample.
    if (field.type === "number" && sampleRows.length > 0) {
      if (fractionNumeric(sampleRows, hit.header) < 0.5) continue;
    }
    return hit;
  }
  return null;
}

/** Flatten a MappingResult to the wire/engine shape (canonical → source header). */
export function toColumnMapping(result: MappingResult): ColumnMapping {
  const out: ColumnMapping = {};
  for (const [field, m] of Object.entries(result)) {
    out[field] = m.sourceColumn;
  }
  return out;
}

/** Canonical field names whose mapping is still missing (null or "Not Present"). */
export function unmappedRequiredFields(
  config: AssessmentConfig,
  mapping: ColumnMapping,
): string[] {
  return config.canonicalFields
    .filter((f) => f.required)
    .filter((f) => {
      const src = mapping[f.name];
      return !src || src === NOT_PRESENT;
    })
    .map((f) => f.name);
}
