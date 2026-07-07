import type { AssessmentConfig } from "../types.js";
import { dibels8 } from "./dibels-8.js";
import { iready } from "./iready.js";
import { star } from "./star.js";
import { vallss } from "./vallss.js";
import { amira } from "./amira.js";

// The registry is the single source of assessment types. Adding a sixth type is a
// new entry here plus a new config file, with zero engine/service/schema changes
// (constitution P1; enforced by the SC-005 config-extension test).
const builtinConfigs: AssessmentConfig[] = [dibels8, iready, star, vallss, amira];

const registry = new Map<string, AssessmentConfig>(
  builtinConfigs.map((c) => [c.id, c]),
);

export function getAssessmentConfigs(): AssessmentConfig[] {
  return [...registry.values()];
}

export function getAssessmentConfig(id: string): AssessmentConfig | undefined {
  return registry.get(id);
}

export function requireAssessmentConfig(id: string): AssessmentConfig {
  const cfg = registry.get(id);
  if (!cfg) throw new Error(`Unknown assessment type: ${id}`);
  return cfg;
}

/**
 * Register an additional config at runtime. Used by the SC-005 extension test to
 * prove a new type flows end-to-end with no application code changes. Production
 * code registers types by adding files to builtinConfigs above.
 */
export function registerAssessmentConfig(config: AssessmentConfig): void {
  if (registry.has(config.id)) {
    throw new Error(`Assessment config already registered: ${config.id}`);
  }
  registry.set(config.id, config);
}

export function unregisterAssessmentConfig(id: string): void {
  registry.delete(id);
}

export { dibels8, iready, star, vallss, amira };
