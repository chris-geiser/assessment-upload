import type { AssessmentConfig } from "../types.js";

// DIBELS 8th Edition (Amplify / mCLASS). Maxima follow tasks.md T008, which is
// authoritative over the reference prototype where they differ (e.g. PSF ≤ 100,
// NWF-CLS ≤ 95, NWF-WRC ≤ 95, WRF ≤ 180).
//
// ORF_WORDS_ATTEMPTED is a supporting input for the ORF-Accuracy ±10% cross-field
// check (US-3.2). It is flagged excludeFromDetection so it never shifts detection
// scores, and is not required, so it never affects the required-field gate.
export const dibels8: AssessmentConfig = {
  id: "DIBELS_8",
  displayName: "DIBELS 8th Edition",
  vendor: "Amplify / mCLASS",
  canonicalFields: [
    { name: "student_id", label: "Student ID", type: "string", category: "student", required: true },
    { name: "student_first_name", label: "First Name", type: "string", category: "student", required: true },
    { name: "student_last_name", label: "Last Name", type: "string", category: "student", required: true },
    { name: "school_name", label: "School", type: "string", category: "student", required: true },
    { name: "grade", label: "Grade", type: "grade", category: "student", required: true },
    { name: "LNF", label: "LNF", type: "number", category: "measure", min: 0, max: 200, measureType: "fluency" },
    { name: "PSF", label: "PSF", type: "number", category: "measure", min: 0, max: 100, measureType: "fluency" },
    { name: "NWF_CLS", label: "NWF-CLS", type: "number", category: "measure", min: 0, max: 95, measureType: "fluency" },
    { name: "NWF_WRC", label: "NWF-WRC", type: "number", category: "measure", min: 0, max: 95, measureType: "fluency" },
    { name: "WRF", label: "WRF", type: "number", category: "measure", min: 0, max: 180, measureType: "fluency" },
    { name: "ORF", label: "ORF", type: "number", category: "measure", min: 0, max: 350, measureType: "fluency" },
    { name: "ORF_ACC", label: "ORF-Accuracy", type: "number", category: "measure", min: 0, max: 100, measureType: "accuracy" },
    { name: "MAZE", label: "MAZE", type: "number", category: "measure", min: 0, max: 80, measureType: "comprehension" },
    { name: "ORF_WORDS_ATTEMPTED", label: "ORF Words Attempted", type: "number", category: "measure", min: 0, max: 400, measureType: "raw", excludeFromDetection: true },
  ],
  synonymMap: {
    "sis id": "student_id", "student sis id": "student_id", "lasid": "student_id", "student id": "student_id", "id": "student_id",
    "first name": "student_first_name", "student first name": "student_first_name", "fname": "student_first_name",
    "last name": "student_last_name", "student last name": "student_last_name", "lname": "student_last_name",
    "school": "school_name", "school name": "school_name",
    "grade": "grade", "grade level": "grade",
    "lnf": "LNF", "lnf score": "LNF", "boy lnf score": "LNF", "moy lnf score": "LNF", "eoy lnf score": "LNF",
    "lnf - fall score": "LNF", "lnf - winter score": "LNF",
    "psf": "PSF", "psf score": "PSF", "boy psf score": "PSF", "moy psf score": "PSF",
    "psf - fall score": "PSF", "psf - winter score": "PSF",
    "nwf-cls": "NWF_CLS", "nwf cls": "NWF_CLS", "boy nwf-cls score": "NWF_CLS", "moy nwf-cls score": "NWF_CLS",
    "nwf-cls - fall score": "NWF_CLS", "nwf-cls - winter score": "NWF_CLS",
    "nwf-wrc": "NWF_WRC", "nwf wrc": "NWF_WRC", "nwf-wwr": "NWF_WRC", "nwf wwr": "NWF_WRC",
    "boy nwf-wrc score": "NWF_WRC", "moy nwf-wrc score": "NWF_WRC",
    "nwf-wwr - fall score": "NWF_WRC", "nwf-wwr - winter score": "NWF_WRC",
    "wrf": "WRF", "wrf score": "WRF", "boy wrf score": "WRF", "moy wrf score": "WRF",
    "wrf - fall score": "WRF", "wrf - winter score": "WRF",
    "orf": "ORF", "orf-wc": "ORF", "orf wc": "ORF", "boy orf-wc score": "ORF", "moy orf-wc score": "ORF",
    "orf - fall score": "ORF", "orf - winter score": "ORF",
    "orf-acc": "ORF_ACC", "orf acc": "ORF_ACC", "orf-accuracy": "ORF_ACC", "orf accuracy": "ORF_ACC",
    "boy orf-acc score": "ORF_ACC", "moy orf-acc score": "ORF_ACC",
    "orf - fall accuracy": "ORF_ACC", "orf - winter accuracy": "ORF_ACC",
    "maze": "MAZE", "maze score": "MAZE", "boy maze score": "MAZE", "moy maze score": "MAZE",
    "maze - fall raw score": "MAZE", "maze - winter raw score": "MAZE",
    "orf words attempted": "ORF_WORDS_ATTEMPTED", "orf-wa": "ORF_WORDS_ATTEMPTED", "orf words read": "ORF_WORDS_ATTEMPTED",
  },
  requiredByGrade: {
    K: ["LNF", "PSF", "NWF_CLS", "NWF_WRC", "WRF"],
    "1": ["LNF", "PSF", "NWF_CLS", "NWF_WRC", "WRF", "ORF", "ORF_ACC"],
    "2": ["NWF_CLS", "NWF_WRC", "WRF", "ORF", "ORF_ACC", "MAZE"],
    "3": ["ORF", "ORF_ACC", "MAZE"],
  },
  performanceLevels: {
    Core: "Above Benchmark",
    Strategic: "Near Benchmark",
    Intensive: "Below Benchmark",
  },
  crossFieldChecks: [
    {
      id: "orf_accuracy_consistency",
      kind: "orf_accuracy_consistency",
      fields: ["ORF", "ORF_ACC", "ORF_WORDS_ATTEMPTED"],
      description:
        "ORF-Accuracy must be within ±10 points of the accuracy implied by words correct / words attempted.",
      tolerancePct: 10,
    },
  ],
};
