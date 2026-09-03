/// <reference types="vite/client" />
// Bundles a curated set of the repo's fixture CSVs at build time (via Vite ?raw)
// so the demo can offer one-click samples without drift from the real fixtures.
const raw = import.meta.glob("../../../../fixtures/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function get(filename: string): string {
  const key = Object.keys(raw).find((k) => k.endsWith(`/${filename}`));
  return key ? raw[key] : "";
}

export interface Sample {
  id: string;
  label: string;
  filename: string;
  content: string;
}

export const SAMPLES: Sample[] = [
  { id: "dibels-clean", label: "DIBELS — clean (happy path)", filename: "dibels-clean.csv", content: get("dibels-clean.csv") },
  { id: "dibels-dirty", label: "DIBELS — with errors to fix", filename: "dibels-dirty.csv", content: get("dibels-dirty.csv") },
  { id: "dibels-renamed", label: "DIBELS — renamed headers", filename: "dibels-renamed-headers.csv", content: get("dibels-renamed-headers.csv") },
  { id: "iready-clean", label: "i-Ready — clean", filename: "iready-clean.csv", content: get("iready-clean.csv") },
  { id: "ambiguous", label: "Ambiguous headers (manual pick)", filename: "ambiguous-headers.csv", content: get("ambiguous-headers.csv") },
].filter((s) => s.content !== "");

export function sampleToFile(sample: Sample): File {
  return new File([sample.content], sample.filename, { type: "text/csv" });
}
