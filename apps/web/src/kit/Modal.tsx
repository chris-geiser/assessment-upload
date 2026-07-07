import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx, focusRing, touchTarget } from "./cx.js";

interface ModalProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  /** When false, hides the ✕ and ignores Escape/backdrop (e.g. a required decision). */
  dismissable?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

// Accessible dialog (P6): role=dialog, aria-modal, labelled by the title, Escape to
// close when dismissable, and a focus trap that keeps Tab within the dialog.
export function Modal({ open, title, onClose, dismissable = true, children, footer }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissable) {
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx("w-full max-w-lg rounded-lg bg-white p-6 shadow-xl", focusRing)}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          {dismissable && onClose && (
            <button
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              className={cx("rounded-md text-gray-500 hover:text-gray-800", touchTarget, focusRing)}
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>
        <div className="text-sm text-gray-700">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
