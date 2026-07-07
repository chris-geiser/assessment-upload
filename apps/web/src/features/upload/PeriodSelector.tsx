import { Select } from "../../kit/index.js";
import type { Period } from "./useUploadFlow.js";

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Select a benchmark period" },
  { value: "BOY", label: "Beginning of Year (BOY)" },
  { value: "MOY", label: "Middle of Year (MOY)" },
  { value: "EOY", label: "End of Year (EOY)" },
];

// Benchmark period is required before a file can advance (FR-004).
export function PeriodSelector({
  value,
  onChange,
}: {
  value: Period | null;
  onChange: (p: Period) => void;
}) {
  return (
    <Select
      label="Benchmark period"
      value={value ?? ""}
      options={OPTIONS}
      onChange={(e) => {
        if (e.target.value) onChange(e.target.value as Period);
      }}
    />
  );
}
