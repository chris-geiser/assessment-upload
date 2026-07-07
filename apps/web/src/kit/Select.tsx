import type { SelectHTMLAttributes } from "react";
import { useId } from "react";
import { cx, focusRing, touchTarget } from "./cx.js";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** Visually hide the label but keep it for assistive tech. */
  hideLabel?: boolean;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, hideLabel, options, className, id, ...rest }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className={cx("text-sm font-medium text-gray-700", hideLabel && "sr-only")}
      >
        {label}
      </label>
      <select
        id={selectId}
        className={cx(
          "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900",
          touchTarget,
          focusRing,
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
