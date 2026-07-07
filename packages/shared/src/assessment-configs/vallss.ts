import type { AssessmentConfig } from "../types.js";

// VALLSS K-3 (Virginia Literacy Partnerships / UVA). Maxima follow tasks.md T011,
// authoritative over the prototype (Decodable ≤ 50, Passage Reading ≤ 8).
export const vallss: AssessmentConfig = {
  id: "VALLSS",
  displayName: "VALLSS K-3",
  vendor: "Virginia Literacy Partnerships / UVA",
  canonicalFields: [
    { name: "student_id", label: "Student SIS ID", type: "string", category: "student", required: true },
    { name: "student_first_name", label: "First Name", type: "string", category: "student", required: true },
    { name: "student_last_name", label: "Last Name", type: "string", category: "student", required: true },
    { name: "school_name", label: "School", type: "string", category: "student", required: true },
    { name: "grade", label: "Grade", type: "grade", category: "student", required: true },
    { name: "letter_sounds", label: "Letter Sounds", type: "number", category: "measure", min: 0, max: 28, measureType: "raw" },
    { name: "sight_words", label: "Sight Words", type: "number", category: "measure", min: 0, max: 50, measureType: "raw" },
    { name: "decodable_words", label: "Decodable Words", type: "number", category: "measure", min: 0, max: 50, measureType: "raw" },
    { name: "passage_reading", label: "Passage Reading", type: "number", category: "measure", min: 0, max: 8, measureType: "raw" },
    { name: "passage_retell", label: "Passage Retell", type: "number", category: "measure", min: 0, max: 12, measureType: "comprehension" },
  ],
  synonymMap: {
    "student sis id": "student_id", "sis id": "student_id", "student id": "student_id", "lasid": "student_id", "id": "student_id",
    "first name": "student_first_name", "fname": "student_first_name",
    "last name": "student_last_name", "lname": "student_last_name",
    "school": "school_name", "school name": "school_name",
    "grade": "grade", "grade level": "grade",
    "letter sounds": "letter_sounds", "letter sound fluency": "letter_sounds",
    "sight words": "sight_words",
    "decodable words": "decodable_words",
    "passage reading": "passage_reading",
    "passage retell": "passage_retell", "retell": "passage_retell",
  },
  requiredByGrade: {},
  performanceLevels: {
    "Low Risk": "Above Benchmark",
    "Moderate Risk": "Near Benchmark",
    "High Risk": "Below Benchmark",
  },
  crossFieldChecks: [],
};
