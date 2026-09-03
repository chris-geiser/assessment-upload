import { useState } from "react";
import type { ValidationSummary } from "@assessment/shared";
import { Btn, Modal, SecondaryBtn } from "../../kit/index.js";

// Adaptive submit control (FR-013). Warnings never block; only error rows do. A
// distinct bar with one-line status plus the button.
export function SubmitActionBar({
  summary,
  submittedCount,
  pendingSubmittableCount,
  totalRows,
  onSubmit,
}: {
  summary: ValidationSummary | null;
  submittedCount: number;
  pendingSubmittableCount: number;
  totalRows: number;
  onSubmit: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pending = pendingSubmittableCount;
  const remainingErrors = summary?.errorRows ?? 0;
  const warnings = summary?.warningRows ?? 0;

  let label: string;
  let disabled = false;
  let needsConfirm = false;
  let status: string;

  if (pending === 0) {
    disabled = true;
    if (totalRows > 0 && submittedCount >= totalRows) label = "All rows submitted";
    else if (remainingErrors > 0) label = "Fix errors to submit";
    else label = "Submit";
    status =
      submittedCount > 0
        ? `${submittedCount} of ${totalRows} rows submitted${remainingErrors > 0 ? `, ${remainingErrors} still need fixing` : ""}`
        : "No rows ready to submit";
  } else if (remainingErrors > 0) {
    label = `Submit Clean Rows Only (${pending})`;
    status = `${pending} of ${totalRows} rows ready to submit`;
  } else if (warnings > 0) {
    label = "Submit with Warnings";
    needsConfirm = true;
    status = `${pending} rows ready (${warnings} with warnings)`;
  } else {
    label = "Submit";
    status = `${pending} of ${totalRows} rows ready to submit`;
  }

  function handleClick() {
    if (needsConfirm) setConfirmOpen(true);
    else onSubmit();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-sm text-neutral-600" aria-live="polite">
        {status}
      </p>
      <Btn onClick={handleClick} disabled={disabled}>
        {label}
      </Btn>

      <Modal
        open={confirmOpen}
        title="Submit rows with warnings?"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <SecondaryBtn onClick={() => setConfirmOpen(false)}>Cancel</SecondaryBtn>
            <Btn
              onClick={() => {
                setConfirmOpen(false);
                onSubmit();
              }}
            >
              Submit with Warnings
            </Btn>
          </>
        }
      >
        <p>
          {warnings} row{warnings === 1 ? "" : "s"} {warnings === 1 ? "has" : "have"} warnings. Warnings do not block
          submission, but you should confirm the data is correct before sending it.
        </p>
      </Modal>
    </div>
  );
}
