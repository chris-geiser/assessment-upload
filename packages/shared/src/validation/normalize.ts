import type { AssessmentConfig, NormalizedLevel } from "../types.js";

// Grade normalization: "1st" → "1", "Kindergarten" → "K", "K"/"0" → "K".
// Returns the normalized grade, or null when the value is empty/unrecognized.
export function normalizeGrade(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (s === "") return null;
  if (s === "k" || s === "kindergarten" || s === "kg" || s === "0") return "K";
  if (s === "pk" || s === "pre-k" || s === "prek" || s === "pre-kindergarten") return "PK";
  const direct = Number(s);
  if (Number.isInteger(direct) && direct >= 1 && direct <= 12) return String(direct);
  // "1st", "2nd", "grade 3", "3rd grade" → first embedded 1–12.
  const match = s.match(/(\d{1,2})/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 12) return String(n);
  }
  return null;
}

// Native performance level → normalized level, case-insensitive. null if unmapped.
export function normalizePerformanceLevel(
  config: AssessmentConfig,
  native: string | null | undefined,
): NormalizedLevel | null {
  if (native == null) return null;
  const raw = String(native).trim();
  if (raw === "") return null;
  if (config.performanceLevels[raw]) return config.performanceLevels[raw];
  const lower = raw.toLowerCase();
  for (const [key, level] of Object.entries(config.performanceLevels)) {
    if (key.toLowerCase() === lower) return level;
  }
  return null;
}
