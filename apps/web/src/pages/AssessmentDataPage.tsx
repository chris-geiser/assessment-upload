import { useState } from "react";
import { Modal, Select, Stepper } from "../kit/index.js";
import { RoleSwitcher } from "../auth/RoleSwitcher.js";
import { useSession } from "../auth/SessionContext.js";
import { getAssessmentConfig } from "@assessment/shared";
import { UploadZone } from "../features/upload/UploadZone.js";
import { PeriodSelector } from "../features/upload/PeriodSelector.js";
import { FilePreview } from "../features/upload/FilePreview.js";
import { ColumnMappingForm } from "../features/upload/ColumnMappingForm.js";
import { ValidationGrid } from "../features/upload/ValidationGrid.js";
import { UPLOAD_STEPS, useUploadFlow } from "../features/upload/useUploadFlow.js";

export function AssessmentDataPage() {
  const { session, loading } = useSession();
  const [activeSchoolId, setActiveSchoolId] = useState<string | undefined>(undefined);

  const schoolId = activeSchoolId ?? session?.schools[0]?.schoolId;
  const flow = useUploadFlow({ schoolId });

  if (loading) return <p className="p-8 text-gray-600">Loading…</p>;
  if (!session) return <p className="p-8 text-gray-600">Sign in to upload assessment data.</p>;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-brand">Assessment Data</h1>
        <p className="mt-1 text-gray-600">Upload, map, validate, and submit assessment files.</p>
      </header>

      <div className="mb-6">
        <RoleSwitcher />
      </div>

      {/* Adequate spacing below the header before the stepper (US1 scenario 7). */}
      <div className="mb-8">
        <Stepper steps={UPLOAD_STEPS} currentIndex={flow.stageIdx} />
      </div>

      {session.schools.length > 1 && (
        <div className="mb-6 max-w-xs">
          <Select
            label="School"
            value={schoolId ?? ""}
            options={session.schools.map((s) => ({ value: s.schoolId, label: s.schoolName }))}
            onChange={(e) => setActiveSchoolId(e.target.value)}
          />
        </div>
      )}

      {flow.stage === "upload" && (
        <div className="space-y-6">
          <div className="max-w-sm">
            <PeriodSelector value={flow.period} onChange={flow.setPeriod} />
          </div>

          {!flow.preview ? (
            <UploadZone onFile={(f) => void flow.selectFile(f)} error={flow.error} />
          ) : (
            <FilePreview
              preview={flow.preview}
              detection={flow.detection}
              assessmentType={flow.assessmentType}
              onChangeType={flow.setAssessmentType}
              onContinue={() => void flow.continueFromUpload()}
              canContinue={flow.canContinueFromUpload}
              onRemove={flow.removeFile}
              busy={flow.busy}
            />
          )}

          {!flow.period && flow.preview && (
            <p className="text-sm text-yellow-800">Select a benchmark period to continue.</p>
          )}
        </div>
      )}

      {flow.stage === "map" && flow.preview && flow.assessmentType && getAssessmentConfig(flow.assessmentType) && (
        <ColumnMappingForm
          config={getAssessmentConfig(flow.assessmentType)!}
          headers={flow.preview.headers}
          mappingResult={flow.mappingResult}
          effectiveMapping={flow.effectiveMapping}
          unmappedRequired={flow.unmappedRequired}
          onChange={flow.setFieldMapping}
          onReset={flow.resetMapping}
          onContinue={flow.continueFromMap}
          onBack={flow.goBack}
          canContinue={flow.canContinueFromMap}
          error={flow.error}
        />
      )}

      {flow.stage === "validate" && flow.assessmentType && getAssessmentConfig(flow.assessmentType) && (
        <ValidationGrid
          config={getAssessmentConfig(flow.assessmentType)!}
          mappedFields={flow.mappedFields}
          rowCount={flow.rows.length}
          summary={flow.validationSummary}
          allIssues={flow.allIssues}
          cellValueFor={flow.cellValueFor}
          editCell={flow.editCell}
          issuesForCell={flow.issuesForCell}
          rowSeverity={flow.rowSeverity}
          onBack={flow.goBack}
        />
      )}

      {flow.stage === "submit" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-600">
          The <strong>{UPLOAD_STEPS[flow.stageIdx].label}</strong> step is implemented in a later phase.
        </div>
      )}

      <Modal
        open={Boolean(flow.sheetPrompt)}
        title="Choose a sheet"
        onClose={flow.removeFile}
      >
        <p className="mb-3">This workbook has multiple sheets. Choose the one with the assessment data.</p>
        <div className="flex flex-col gap-2">
          {flow.sheetPrompt?.sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-left text-sm hover:bg-gray-50"
              onClick={() => void flow.chooseSheet(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </Modal>
    </main>
  );
}
