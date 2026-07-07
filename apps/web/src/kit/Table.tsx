import type { ReactNode } from "react";
import { cx, focusRing } from "./cx.js";

export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (row: T, rowIndex: number) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, rowIndex: number) => string;
  caption?: string;
  onRowClick?: (row: T, rowIndex: number) => void;
  rowClassName?: (row: T, rowIndex: number) => string | undefined;
  emptyState?: ReactNode;
}

// Semantic, non-virtualized table for modest lists (upload history). The editable,
// virtualized grid is DataGrid.
export function Table<T>({
  columns,
  rows,
  getRowKey,
  caption,
  onRowClick,
  rowClassName,
  emptyState,
}: TableProps<T>) {
  if (rows.length === 0 && emptyState) {
    return <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">{emptyState}</div>;
  }
  return (
    <table className="w-full border-collapse text-left text-sm">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
          {columns.map((c) => (
            <th key={c.key} scope="col" className={cx("px-3 py-2 font-semibold", c.className)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => {
          const clickable = Boolean(onRowClick);
          return (
            <tr
              key={getRowKey(row, rowIndex)}
              className={cx(
                "border-b border-gray-100",
                clickable && cx("cursor-pointer hover:bg-gray-50", focusRing),
                rowClassName?.(row, rowIndex),
              )}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onRowClick!(row, rowIndex) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick!(row, rowIndex);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((c) => (
                <td key={c.key} className={cx("px-3 py-2", c.className)}>
                  {c.render ? c.render(row, rowIndex) : (row as Record<string, ReactNode>)[c.key]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
