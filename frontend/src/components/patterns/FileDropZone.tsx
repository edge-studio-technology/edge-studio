import { Upload } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "../../lib/cx";

/**
 * Compact drag-and-drop file picker row. For a large result-preview drop
 * target, see features/integritas/FileDropBox.tsx instead.
 */
export function FileDropZone({
  file,
  onFile,
  onClear,
  accept,
  placeholder,
  icon = <Upload size={14} />,
}: {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  accept?: string;
  placeholder: string;
  icon?: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="truncate text-sm text-slate-800">{file.name}</span>
        <button type="button" onClick={onClear} className="text-xs font-bold text-slate-500">
          Remove
        </button>
      </div>
    );
  }

  return (
    <label
      className={cx(
        "flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 cursor-pointer",
        dragging && "border-slate-950 bg-slate-100"
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files.item(0);
        if (dropped) onFile(dropped);
      }}
    >
      <span className="flex items-center gap-2 text-sm text-slate-600">
        {icon} {placeholder}
      </span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.item(0);
          if (selected) onFile(selected);
        }}
      />
    </label>
  );
}
