import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx, focusRing, touchTarget } from "./cx.js";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

// Primary action (ignite-button-primary): filled purple-500 (#573988), 2px border,
// radius-md, semibold. White text on #573988 clears 4.5:1.
export function Btn({ children, className, type = "button", ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border-2 border-brand bg-brand px-5 py-2 text-base font-semibold text-white",
        "hover:border-brand-700 hover:bg-brand-700 disabled:cursor-not-allowed disabled:border-neutral-500 disabled:bg-neutral-500",
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

// Tertiary action (ignite-button-tertiary): white fill, purple-500 border + text.
export function SecondaryBtn({ children, className, type = "button", ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border-2 border-brand bg-white px-5 py-2 text-base font-semibold text-brand",
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
