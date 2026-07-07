import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, focusRing, touchTarget } from "./cx.js";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

// Primary action. Brand purple (#632E93) meets 4.5:1 against white text.
export function Btn({ children, className, type = "button", ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white",
        "hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50",
        touchTarget,
        focusRing,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryBtn({ children, className, type = "button", ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand",
        "hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50",
        touchTarget,
        focusRing,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
