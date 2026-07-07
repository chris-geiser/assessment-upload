import { describe, expect, it } from "vitest";
import { mapColumns, toColumnMapping, unmappedRequiredFields } from "./mapping.js";
import { dibels8 } from "./assessment-configs/index.js";

describe("mapColumns", () => {
  it("exact-matches canonical labels at High confidence", () => {
    const r = mapColumns(["Student ID", "First Name", "Last Name", "School", "Grade", "LNF"], dibels8);
    expect(r.LNF.band).toBe("high");
    expect(r.LNF.sourceColumn).toBe("LNF");
    expect(r.student_id.sourceColumn).toBe("Student ID");
  });

  it("synonym-maps renamed headers at High confidence (LNF - Fall Score, LASID)", () => {
    const r = mapColumns(["LASID", "First Name", "Last Name", "School", "Grade", "LNF - Fall Score"], dibels8);
    expect(r.student_id.sourceColumn).toBe("LASID");
    expect(r.student_id.band).toBe("high");
    expect(r.student_id.strategy).toBe("synonym");
    expect(r.LNF.sourceColumn).toBe("LNF - Fall Score");
    expect(r.LNF.band).toBe("high");
  });

  it("never fuzzy-auto-maps an identity field; surfaces a suggestion instead (D8)", () => {
    // "Studnt Identifer" is a typo of student id with no synonym/exact match.
    const r = mapColumns(["Studnt Identifer", "First Name", "Last Name", "School", "Grade", "LNF"], dibels8);
    expect(r.student_id.sourceColumn).toBeNull();
  });

  it("flattens to a wire mapping and reports unmapped required fields", () => {
    const r = mapColumns(["First Name", "Last Name", "School", "Grade", "LNF"], dibels8);
    const mapping = toColumnMapping(r);
    expect(unmappedRequiredFields(dibels8, mapping)).toContain("student_id");
  });

  it("reports all required identity fields mapped for a complete header set", () => {
    const r = mapColumns(
      ["Student ID", "First Name", "Last Name", "School", "Grade", "LNF", "PSF"],
      dibels8,
    );
    expect(unmappedRequiredFields(dibels8, toColumnMapping(r))).toEqual([]);
  });
});
