import { cx, focusRing } from "./cx.js";

export interface Step {
  key: string;
  label: string;
}

type StepState = "complete" | "current" | "upcoming";

// Numbered-circle stepper mirroring the School Portal rostering wizard: filled brand
// circle for the current step, outlined circles joined by connector lines for the
// rest, completed steps clickable to jump back. aria-current marks the active step;
// completed/upcoming state is conveyed to assistive tech, not by color alone.
export function Stepper({
  steps,
  currentIndex,
  onStepClick,
  ariaLabel = "Upload progress",
}: {
  steps: Step[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  ariaLabel?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="w-full">
      <ol className="flex flex-wrap items-center gap-y-2">
        {steps.map((step, i) => {
          const state: StepState = i < currentIndex ? "complete" : i === currentIndex ? "current" : "upcoming";
          const clickable = state === "complete" && Boolean(onStepClick);

          const circle = (
            <span
              aria-hidden="true"
              className={cx(
                "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                state === "current" && "border-brand bg-brand text-white drop-shadow-sm",
                state === "complete" && "border-brand text-brand",
                state === "upcoming" && "border-neutral-400 text-neutral-500",
              )}
            >
              {i + 1}
            </span>
          );
          const label = (
            <span
              className={cx(
                "text-sm",
                state === "current" && "font-semibold text-brand-800",
                state === "complete" && "font-medium text-brand-800",
                state === "upcoming" && "text-neutral-500",
              )}
            >
              {step.label}
            </span>
          );

          return (
            <li
              key={step.key}
              aria-current={state === "current" ? "step" : undefined}
              className="flex items-center"
            >
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick!(i)}
                  className={cx("group flex items-center gap-2 rounded", focusRing)}
                >
                  {circle}
                  <span className="group-hover:underline">{label}</span>
                  <span className="sr-only"> (completed, go back to this step)</span>
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  {circle}
                  {label}
                  {state === "complete" && <span className="sr-only"> (completed)</span>}
                </span>
              )}
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="mx-3 hidden h-px w-8 bg-neutral-900/10 sm:block" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
