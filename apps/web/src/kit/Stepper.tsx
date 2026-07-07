import { cx } from "./cx.js";

export interface Step {
  key: string;
  label: string;
}

// Persistent flow progress (FR-024). Uses an ordered list with aria-current on the
// active step; completed steps are marked for assistive tech, not color alone.
export function Stepper({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <nav aria-label="Upload progress">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, i) => {
          const state = i < currentIndex ? "complete" : i === currentIndex ? "current" : "upcoming";
          return (
            <li
              key={step.key}
              aria-current={state === "current" ? "step" : undefined}
              className={cx(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                state === "current" && "bg-brand text-white",
                state === "complete" && "bg-brand-100 text-brand-800",
                state === "upcoming" && "bg-gray-100 text-gray-500",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  state === "current" && "bg-white text-brand",
                  state === "complete" && "bg-brand text-white",
                  state === "upcoming" && "bg-gray-300 text-gray-600",
                )}
              >
                {state === "complete" ? "✓" : i + 1}
              </span>
              <span>{step.label}</span>
              <span className="sr-only">
                {state === "complete" ? " (completed)" : state === "current" ? " (current step)" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
