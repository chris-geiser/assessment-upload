import { describe, expect, it } from "vitest";
import { normalizeGrade, normalizePerformanceLevel } from "./normalize.js";
import { dibels8, iready, star } from "../assessment-configs/index.js";

describe("normalizeGrade", () => {
  it("normalizes kindergarten forms to K", () => {
    for (const v of ["K", "k", "Kindergarten", "0", "KG"]) {
      expect(normalizeGrade(v)).toBe("K");
    }
  });
  it("normalizes ordinal and prefixed grades to the digit", () => {
    expect(normalizeGrade("1st")).toBe("1");
    expect(normalizeGrade("2nd")).toBe("2");
    expect(normalizeGrade("Grade 3")).toBe("3");
    expect(normalizeGrade("3")).toBe("3");
  });
  it("returns null for empty or unrecognized values", () => {
    expect(normalizeGrade("")).toBeNull();
    expect(normalizeGrade(null)).toBeNull();
    expect(normalizeGrade("adult")).toBeNull();
  });
});

describe("normalizePerformanceLevel", () => {
  it("maps native levels to the common set per config", () => {
    expect(normalizePerformanceLevel(dibels8, "Core")).toBe("Above Benchmark");
    expect(normalizePerformanceLevel(dibels8, "Strategic")).toBe("Near Benchmark");
    expect(normalizePerformanceLevel(dibels8, "Intensive")).toBe("Below Benchmark");
    expect(normalizePerformanceLevel(iready, "One Grade Level Below")).toBe("Near Benchmark");
    expect(normalizePerformanceLevel(star, "Urgent Intervention")).toBe("Below Benchmark");
  });
  it("is case-insensitive and returns null for unknown levels", () => {
    expect(normalizePerformanceLevel(dibels8, "core")).toBe("Above Benchmark");
    expect(normalizePerformanceLevel(dibels8, "Mystery")).toBeNull();
  });
});
