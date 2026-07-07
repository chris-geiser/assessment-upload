import { describe, expect, it } from "vitest";
import { getAssessmentConfig, getAssessmentConfigs } from "./index.js";

describe("assessment config registry", () => {
  const configs = getAssessmentConfigs();

  it("registers all 5 assessment types", () => {
    expect(configs).toHaveLength(5);
    expect(configs.map((c) => c.id).sort()).toEqual(
      ["AMIRA", "DIBELS_8", "IREADY", "STAR", "VALLSS"].sort(),
    );
  });

  it("uses versioned ids with display names carrying the edition (D9)", () => {
    const dibels = getAssessmentConfig("DIBELS_8")!;
    expect(dibels.id).toBe("DIBELS_8");
    expect(dibels.displayName).toBe("DIBELS 8th Edition");
  });

  it("gives every measure field a numeric max (except free-text classifications)", () => {
    for (const cfg of configs) {
      for (const field of cfg.canonicalFields) {
        if (field.category !== "measure") continue;
        if (field.type === "string") continue; // grade equivalent / classification
        expect(
          typeof field.max === "number",
          `${cfg.id}.${field.name} must define a max`,
        ).toBe(true);
      }
    }
  });

  it("requires the same 5 identity fields on every type", () => {
    for (const cfg of configs) {
      const required = cfg.canonicalFields
        .filter((f) => f.required)
        .map((f) => f.name)
        .sort();
      expect(required).toEqual(
        [
          "grade",
          "school_name",
          "student_first_name",
          "student_id",
          "student_last_name",
        ].sort(),
      );
    }
  });

  it("maps every native performance level to a normalized level", () => {
    const allowed = new Set([
      "Above Benchmark",
      "Near Benchmark",
      "Below Benchmark",
    ]);
    for (const cfg of configs) {
      for (const level of Object.values(cfg.performanceLevels)) {
        expect(allowed.has(level)).toBe(true);
      }
    }
  });
});
