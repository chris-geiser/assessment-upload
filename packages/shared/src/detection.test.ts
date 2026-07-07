import { describe, expect, it } from "vitest";
import { detectAssessmentType } from "./detection.js";

describe("detectAssessmentType", () => {
  it("auto-detects DIBELS from its measure headers", () => {
    const r = detectAssessmentType([
      "Student ID", "First Name", "Last Name", "School", "Grade",
      "LNF", "PSF", "NWF-CLS", "NWF-WRC", "WRF", "ORF", "ORF-Accuracy", "MAZE",
    ]);
    expect(r.detected).toBe("DIBELS_8");
    expect(r.ambiguous).toBe(false);
    expect(r.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it("auto-detects via synonym headers (renamed columns)", () => {
    const r = detectAssessmentType([
      "LASID", "First Name", "Last Name", "School", "Grade",
      "LNF - Fall Score", "PSF - Fall Score", "NWF-CLS - Fall Score",
      "NWF-WWR - Fall Score", "WRF - Fall Score", "ORF - Fall Score",
      "ORF - Fall Accuracy", "MAZE - Fall Raw Score",
    ]);
    expect(r.detected).toBe("DIBELS_8");
  });

  it("detects i-Ready, STAR, VALLSS, and Amira from their own headers", () => {
    expect(
      detectAssessmentType(["Overall Scale Score", "Phonics", "Vocabulary", "Reading Comprehension"]).detected,
    ).toBe("IREADY");
    expect(
      detectAssessmentType(["Scaled Score", "Percentile Rank", "Alphabetic Decoding", "Structural Analysis"]).detected,
    ).toBe("STAR");
    expect(
      detectAssessmentType(["Letter Sounds", "Sight Words", "Decodable Words", "Passage Reading", "Passage Retell"]).detected,
    ).toBe("VALLSS");
    expect(
      detectAssessmentType(["Oral Reading Fluency", "ISIP Reading", "Phonics Screener", "Overall Ability"]).detected,
    ).toBe("AMIRA");
  });

  it("returns ambiguous when headers do not clear the threshold/lead", () => {
    const r = detectAssessmentType(["Student ID", "First Name", "Last Name", "Notes"]);
    expect(r.detected).toBeNull();
    expect(r.ambiguous).toBe(true);
  });

  it("ranks configs by score for a manual-selection prompt", () => {
    const r = detectAssessmentType(["LNF", "PSF", "ORF"]);
    expect(r.ranked[0].id).toBe("DIBELS_8");
    expect(r.ranked[0].score).toBeGreaterThan(0);
  });
});
