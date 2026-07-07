import { useRef, useState } from "react";
import { cx, focusRing } from "../../kit/cx.js";
import { Toast } from "../../kit/index.js";

// Drag-drop + browse (FR-002). Type/size are re-checked in useUploadFlow and again
// on the server; this surfaces immediate feedback.
export function UploadZone({
  onFile,
  error,
}: {
  onFile: (file: File) => void;
  error?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a file: drag and drop, or activate to browse"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cx(
          "flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center",
          dragOver ? "border-brand bg-brand-50" : "border-gray-300 bg-white",
          focusRing,
        )}
      >
        <p className="text-sm font-medium text-gray-700">
          Drag a file here, or click to browse
        </p>
        <p className="text-xs text-gray-500">CSV or Excel (.csv, .xlsx, .xls), up to 50MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && (
        <div className="mt-3">
          <Toast tone="error">{error}</Toast>
        </div>
      )}
    </div>
  );
}
