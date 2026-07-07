import type { ReactNode } from "react";
import { cx } from "./cx.js";

export type BadgeTone =
  | "success"
  | "warning"
  | "error"
  | "processing"
  | "superseded"
  | "neutral";

// Text colors chosen for ≥4.5:1 contrast on their tinted backgrounds (P6).
const TONES: Record<BadgeTone, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  processing: "bg-blue-100 text-blue-800",
  superseded: "bg-gray-200 text-gray-700",
  neutral: "bg-gray-100 text-gray-800",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
