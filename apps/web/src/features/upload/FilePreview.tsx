import { useState } from "react";
import { getAssessmentConfig, getAssessmentConfigs, type DetectionResult } from "@assessment/shared";
import { Badge, Btn, SecondaryBtn, Select } from "../../kit/index.js";
import type { PreviewData } from "./useUploadFlow.js";

function typeOptions(detection: DetectionResult | null) {
  const configs = getAssessmentConfigs();
  const rank = new Map(detection?.ranked.map((r, i) => [r.id, i]) ?? []);
  return [...configs]
    .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99))
    .map((c) => ({ value: c.id, label: c.displayName }));
}

export function FilePreview({
  preview,
  detection,
  assessmentType,
  onChangeType,
  onContinue,
  canContinue,
  onRemove,
  busy,
}: {
  preview: PreviewData;
  detection: DetectionResult | null;
  assessmentType: string | null;
  onChangeType: (id: string) => void;
  onContinue: () => void;
  canContinue: boolean;
  onRemove: () => void;
  busy?: boolean;
}) {
  const [choosing, setChoosing] = useState(false);
  const ambiguous = detection?.ambiguous && !assessmentType;
  const displayName = assessmentType ? getAssessmentConfig(assessmentType)?.displayName : null;
  const autoDetected = Boolean(detection?.detected) && assessmentType === detection?.detected;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4" aria-label="File preview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{preview.fileName}</h3>
          <p className="text-sm text-gray-600">
            {preview.rowCount} row{preview.rowCount === 1 ? "" : "s"} · {preview.columnCount} column
            {preview.columnCount === 1 ? "" : "s"}
          </p>
        </div>
        <SecondaryBtn onClick={onRemove}>Remove file</SecondaryBtn>
      </div>

      <div className="mt-3">
        {ambiguous ? (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3">
            <p className="mb-2 text-sm text-yellow-800">
              We could not confidently detect the assessment type. Select it from the list, ranked by best guess.
            </p>
            <Select
              label="Assessment type"
              value={assessmentType ?? ""}
              options={[{ value: "", label: "Select assessment type" }, ...typeOptions(detection)]}
              onChange={(e) => e.target.value && onChangeType(e.target.value)}
            />
          </div>
        ) : choosing ? (
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Assessment type"
              value={assessmentType ?? ""}
              options={typeOptions(detection)}
              onChange={(e) => {
                onChangeType(e.target.value);
                setChoosing(false);
              }}
            />
            <SecondaryBtn onClick={() => setChoosing(false)}>Cancel</SecondaryBtn>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="processing">
              {displayName}
              {autoDetected ? " (auto-detected)" : ""}
            </Badge>
            <button
              type="button"
              className="text-sm font-medium text-brand underline underline-offset-2 hover:text-brand-700"
              onClick={() => setChoosing(true)}
            >
              Not the right assessment? Change type
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">First {preview.sampleRows.length} rows of the uploaded file</caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              {preview.headers.map((h) => (
                <th key={h} scope="col" className="px-2 py-1 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.sampleRows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100">
                {preview.headers.map((h) => (
                  <td key={h} className="px-2 py-1 text-gray-800">
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <Btn onClick={onContinue} disabled={!canContinue || busy}>
          {busy ? "Uploading…" : "Continue to mapping"}
        </Btn>
      </div>
    </section>
  );
}
