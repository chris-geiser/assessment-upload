import type { ReactNode } from "react";
import { cx, focusRing, touchTarget } from "./cx.js";

type ToastTone = "error" | "success" | "info";

const TONES: Record<ToastTone, string> = {
  error: "border-red-300 bg-red-50 text-red-800",
  success: "border-green-300 bg-green-50 text-green-800",
  info: "border-blue-300 bg-blue-50 text-blue-800",
};

export function Toast({
  tone = "info",
  children,
  onDismiss,
}: {
  tone?: ToastTone;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      // Errors interrupt (alert); others are polite status updates.
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex items-start justify-between gap-4 rounded-md border px-4 py-3 text-sm", TONES[tone])}
    >
      <div>{children}</div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className={cx("shrink-0 font-semibold", touchTarget, focusRing)}
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  );
}
