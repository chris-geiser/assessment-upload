export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Shared focus ring (P6: visible focus indicator on every interactive element).
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

// P6: 44x44px minimum touch target.
export const touchTarget = "min-h-[44px] min-w-[44px]";
