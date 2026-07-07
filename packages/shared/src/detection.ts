import type { AssessmentConfig, DetectionResult } from "./types.js";
import { getAssessmentConfigs } from "./assessment-configs/index.js";

export const DETECTION_MATCH_THRESHOLD = 0.3; // ≥30% of measure fields match
export const DETECTION_LEAD_THRESHOLD = 0.15; // best leads 2nd by ≥15 points

export function normalizeHeader(header: string): string {
  return header.toLowerCase().trim();
}

// A measure field "matches" a header set if a synonym maps a header to it, or a
// header contains the canonical name (with "_" rendered as space or hyphen).
// Identity fields are excluded from scoring: they map identically across all types,
// so counting them would erase the 15-point lead that distinguishes types.
function measureMatched(
  field: AssessmentConfig["canonicalFields"][number],
  normalizedHeaders: string[],
  synonymMap: Record<string, string>,
): boolean {
  const spaced = field.name.toLowerCase().replace(/_/g, " ");
  const hyphened = field.name.toLowerCase().replace(/_/g, "-");
  return normalizedHeaders.some(
    (h) => synonymMap[h] === field.name || h.includes(spaced) || h.includes(hyphened),
  );
}

function scoreConfig(config: AssessmentConfig, normalizedHeaders: string[]): number {
  const measureFields = config.canonicalFields.filter(
    (f) => f.category === "measure" && !f.excludeFromDetection,
  );
  if (measureFields.length === 0) return 0;
  const matched = measureFields.filter((f) =>
    measureMatched(f, normalizedHeaders, config.synonymMap),
  ).length;
  return matched / measureFields.length;
}

export function detectAssessmentType(
  headers: string[],
  configs: AssessmentConfig[] = getAssessmentConfigs(),
): DetectionResult {
  const normalizedHeaders = headers.map(normalizeHeader);

  const scores: Record<string, number> = {};
  for (const cfg of configs) {
    scores[cfg.id] = scoreConfig(cfg, normalizedHeaders);
  }

  const ranked = Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    // Stable, deterministic ordering: score desc, then id asc for ties.
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const best = ranked[0];
  const second = ranked[1];
  const lead = best.score - (second?.score ?? 0);

  const detected =
    best.score >= DETECTION_MATCH_THRESHOLD && lead >= DETECTION_LEAD_THRESHOLD
      ? best.id
      : null;

  return {
    detected,
    confidence: detected ? best.score : 0,
    ambiguous: detected === null,
    scores,
    ranked,
  };
}
