import { useLayoutEffect, useRef, useState } from "react";
import { cx, focusRing } from "./cx.js";

export interface DataGridColumn {
  key: string;
  header: string;
  editable?: boolean;
}

export interface DataGridProps {
  columns: DataGridColumn[];
  rowCount: number;
  getCell: (rowIndex: number, colKey: string) => string;
  onCommit: (rowIndex: number, colKey: string, value: string) => void;
  rowClassName?: (rowIndex: number) => string | undefined;
  cellClassName?: (rowIndex: number, colKey: string) => string | undefined;
  /** Message surfaced to screen readers (aria-describedby) and on hover (title). */
  cellMessage?: (rowIndex: number, colKey: string) => string | undefined;
  rowLabel?: (rowIndex: number) => string;
  rowHeight?: number;
  viewportHeight?: number;
  overscan?: number;
}

interface EditState {
  rowIndex: number;
  colKey: string;
  draft: string;
}

// Controlled, windowed, editable grid. It holds NO validation logic (the engine owns
// that, per plan). Only visible rows render, so 10K rows stay within budget.
export function DataGrid({
  columns,
  rowCount,
  getCell,
  onCommit,
  rowClassName,
  cellClassName,
  cellMessage,
  rowLabel,
  rowHeight = 40,
  viewportHeight = 480,
  overscan = 6,
}: DataGridProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [edit, setEdit] = useState<EditState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (edit) inputRef.current?.focus();
  }, [edit]);

  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(rowCount, startIndex + visibleCount + overscan * 2);
  const topPad = startIndex * rowHeight;
  const bottomPad = Math.max(0, (rowCount - endIndex) * rowHeight);

  function commit() {
    if (!edit) return;
    onCommit(edit.rowIndex, edit.colKey, edit.draft);
    setEdit(null);
  }

  const rows = [];
  for (let rowIndex = startIndex; rowIndex < endIndex; rowIndex++) {
    rows.push(
      <tr
        key={rowIndex}
        style={{ height: rowHeight }}
        className={cx("border-b border-gray-100", rowClassName?.(rowIndex))}
      >
        {columns.map((col) => {
          const value = getCell(rowIndex, col.key);
          const message = cellMessage?.(rowIndex, col.key);
          const editing = edit?.rowIndex === rowIndex && edit.colKey === col.key;
          const base = rowLabel ? `${rowLabel(rowIndex)}, ${col.header}` : `${col.header}, row ${rowIndex + 1}`;
          return (
            <td
              key={col.key}
              className={cx("px-2 py-1 align-middle", cellClassName?.(rowIndex, col.key))}
              title={message}
            >
              {editing ? (
                <input
                  ref={inputRef}
                  value={edit!.draft}
                  aria-label={`Edit ${base}`}
                  className={cx("w-full rounded border border-brand px-2 py-1 text-sm", focusRing)}
                  onChange={(e) => setEdit({ ...edit!, draft: e.target.value })}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEdit(null);
                    }
                  }}
                />
              ) : col.editable ? (
                <button
                  type="button"
                  aria-label={`${base}: ${value || "empty"}${message ? `. ${message}` : ""}`}
                  className={cx("w-full rounded px-2 py-1 text-left text-sm", focusRing)}
                  onClick={() => setEdit({ rowIndex, colKey: col.key, draft: value })}
                >
                  {value || " "}
                </button>
              ) : (
                <span className="block px-2 py-1 text-sm text-gray-800">{value || " "}</span>
              )}
            </td>
          );
        })}
      </tr>,
    );
  }

  return (
    <div
      className="overflow-auto rounded-lg border border-gray-200 bg-white"
      style={{ maxHeight: viewportHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr className="text-xs uppercase tracking-wide text-gray-500">
            {columns.map((c) => (
              <th key={c.key} scope="col" className="px-2 py-2 font-semibold">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topPad > 0 && (
            <tr aria-hidden="true" style={{ height: topPad }}>
              <td colSpan={columns.length} />
            </tr>
          )}
          {rows}
          {bottomPad > 0 && (
            <tr aria-hidden="true" style={{ height: bottomPad }}>
              <td colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
