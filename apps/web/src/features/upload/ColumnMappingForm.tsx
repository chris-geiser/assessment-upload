import {
  NOT_PRESENT,
  type AssessmentConfig,
  type ColumnMapping,
  type MappingResult,
} from "@assessment/shared";
import { Badge, Btn, SecondaryBtn, Select, type BadgeTone } from "../../kit/index.js";

function confidenceBadge(
  field: string,
  mappingResult: MappingResult | null,
  effective: ColumnMapping,
): { tone: BadgeTone; label: string } {
  const value = effective[field];
  if (!value || value === NOT_PRESENT) return { tone: "neutral", label: "Unmapped" };
  const auto = mappingResult?.[field];
  if (!auto || auto.sourceColumn !== value) return { tone: "neutral", label: "Manual" };
  switch (auto.band) {
    case "high":
      return { tone: "success", label: "High" };
    case "medium":
      return { tone: "processing", label: "Medium" };
    case "low":
      return { tone: "warning", label: "Low" };
    default:
      return { tone: "neutral", label: "Manual" };
  }
}

function FieldRow({
  config,
  field,
  headers,
  mappingResult,
  effective,
  onChange,
  isMissing,
}: {
  config: AssessmentConfig;
  field: AssessmentConfig["canonicalFields"][number];
  headers: string[];
  mappingResult: MappingResult | null;
  effective: ColumnMapping;
  onChange: (field: string, source: string) => void;
  isMissing: boolean;
}) {
  void config;
  const value = effective[field.name] ?? NOT_PRESENT;
  const badge = confidenceBadge(field.name, mappingResult, effective);
  const options = [
    { value: NOT_PRESENT, label: "Not Present" },
    ...headers.map((h) => ({ value: h, label: h })),
  ];
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 py-2">
      <div className="min-w-[220px] flex-1">
        <Select
          label={`${field.label}${field.required ? " *" : ""}`}
          value={value}
          options={options}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      </div>
      <div className="pb-2">
        <Badge tone={isMissing ? "error" : badge.tone}>{isMissing ? "Required" : badge.label}</Badge>
      </div>
    </div>
  );
}

export function ColumnMappingForm({
  config,
  headers,
  mappingResult,
  effectiveMapping,
  unmappedRequired,
  onChange,
  onReset,
  onContinue,
  onBack,
  canContinue,
  error,
}: {
  config: AssessmentConfig;
  headers: string[];
  mappingResult: MappingResult | null;
  effectiveMapping: ColumnMapping;
  unmappedRequired: string[];
  onChange: (field: string, source: string) => void;
  onReset: () => void;
  onContinue: () => void;
  onBack: () => void;
  canContinue: boolean;
  error?: string | null;
}) {
  const missing = new Set(unmappedRequired);
  // Hard two-group layout (US2 scenario 2): Student Info then Assessment Measures.
  const studentFields = config.canonicalFields.filter((f) => f.category === "student");
  const measureFields = config.canonicalFields.filter((f) => f.category === "measure");

  const renderGroup = (title: string, fields: typeof config.canonicalFields) => (
    <fieldset className="rounded-lg border border-gray-200 bg-white p-4">
      <legend className="px-2 text-sm font-semibold text-gray-900">{title}</legend>
      {fields.map((f) => (
        <FieldRow
          key={f.name}
          config={config}
          field={f}
          headers={headers}
          mappingResult={mappingResult}
          effective={effectiveMapping}
          onChange={onChange}
          isMissing={missing.has(f.name)}
        />
      ))}
    </fieldset>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Review column mapping</h2>
        <SecondaryBtn onClick={onReset}>Reset to Auto-Mapped</SecondaryBtn>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {renderGroup("Student Info", studentFields)}
      {renderGroup("Assessment Measures", measureFields)}

      {!canContinue && (
        <p className="text-sm text-gray-600">Map all required fields (marked *) to continue.</p>
      )}

      <div className="flex justify-between">
        <SecondaryBtn onClick={onBack}>Back</SecondaryBtn>
        {/* Always clickable: the gate blocks on click with a message naming the
            missing fields (US2 scenario 5), rather than silently disabling. */}
        <Btn onClick={onContinue}>Continue to validation</Btn>
      </div>
    </div>
  );
}
