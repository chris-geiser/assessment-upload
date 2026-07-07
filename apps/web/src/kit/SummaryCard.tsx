import { cx } from "./cx.js";
import type { BadgeTone } from "./Badge.js";

const TONE_TEXT: Record<BadgeTone, string> = {
  success: "text-green-800",
  warning: "text-yellow-800",
  error: "text-red-800",
  processing: "text-blue-800",
  superseded: "text-gray-700",
  neutral: "text-gray-800",
};

const TONE_BORDER: Record<BadgeTone, string> = {
  success: "border-green-300",
  warning: "border-yellow-300",
  error: "border-red-300",
  processing: "border-blue-300",
  superseded: "border-gray-300",
  neutral: "border-gray-200",
};

export function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  tone?: BadgeTone;
}) {
  return (
    <div className={cx("rounded-lg border bg-white p-4", TONE_BORDER[tone])}>
      <div className={cx("text-2xl font-bold tabular-nums", TONE_TEXT[tone])}>{value}</div>
      <div className="mt-1 text-sm text-gray-600">{label}</div>
    </div>
  );
}
