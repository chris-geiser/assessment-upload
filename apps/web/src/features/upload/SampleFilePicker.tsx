import { Select } from "../../kit/index.js";
import { SAMPLES, sampleToFile } from "../../demo/samples.js";

// Demo convenience: load a bundled sample file with one click, so reviewers don't
// have to download fixtures from GitHub. Feeds the same path as a real upload.
export function SampleFilePicker({ onLoad }: { onLoad: (file: File) => void }) {
  if (SAMPLES.length === 0) return null;
  return (
    <div className="max-w-sm">
      <Select
        label="Or load a sample file"
        value=""
        options={[
          { value: "", label: "Choose a sample…" },
          ...SAMPLES.map((s) => ({ value: s.id, label: s.label })),
        ]}
        onChange={(e) => {
          const sample = SAMPLES.find((s) => s.id === e.target.value);
          if (sample) onLoad(sampleToFile(sample));
        }}
      />
      <p className="mt-1 text-xs text-neutral-500">Synthetic data for demonstration.</p>
    </div>
  );
}
