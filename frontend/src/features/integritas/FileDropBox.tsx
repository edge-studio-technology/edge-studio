import { SquareX, Upload } from "lucide-react";
import { useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { IconButton } from "../../components/ui/Button";
import { ErrorText } from "../../components/ui/ErrorText";
import { cx } from "../../lib/cx";

export function FileDropBox({
  title,
  file,
  onFile,
  accept,
  busy = false,
}: {
  title: string;
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string;
  busy?: boolean;
}) {
  const { showToast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const disabled = file !== null;

  function isAccepted(selected: File) {
    if (!accept) return true;
    const patterns = accept.split(",").map((part) => part.trim().toLowerCase());
    const name = selected.name.toLowerCase();
    const type = selected.type.toLowerCase();
    return patterns.some((pattern) => {
      if (pattern.startsWith(".")) return name.endsWith(pattern);
      if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
      return type === pattern;
    });
  }

  function rejectMessage() {
    if (accept?.toLowerCase().includes("json")) {
      return "Only JSON files are accepted.";
    }
    return "This file type is not accepted.";
  }

  function takeOneFile(list: FileList | null) {
    const selected = list?.item(0) ?? null;
    if (!selected) return;
    if (!isAccepted(selected)) {
      const message = rejectMessage();
      setRejectError(message);
      showToast({ tone: "error", title: "File not accepted", message });
      return;
    }
    setRejectError(null);
    onFile(selected);
  }

  const DropSurface = disabled ? "div" : "label";

  return (
    <div className="gap-detail-close flex w-full flex-col">
      <DropSurface
        className={cx(
          "bg-surface-primary border-stroke-secondary rounded-soft gap-detail-close p-margin-close relative flex w-full items-start border transition-[border-color,box-shadow,background-color] duration-150",
          "has-[:focus-visible]:ring-stroke-active has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2",
          !disabled && "hover:border-stroke-primary hover:bg-surface-always-white cursor-pointer",
          dragging &&
            !disabled &&
            "border-stroke-active bg-surface-always-white shadow-[0_0_0_1px_var(--color-stroke-active)]",
          disabled && "pointer-events-none",
        )}
        data-dragging={dragging && !disabled ? "true" : undefined}
        onDragEnter={(event) => {
          event.preventDefault();
          if (disabled) return;
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (disabled) return;
          event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          takeOneFile(event.dataTransfer.files);
        }}
      >
        <div className="gap-detail-near px-detail-next py-margin-close flex min-w-px flex-1 flex-col items-center">
          <Upload
            className={cx("size-6 shrink-0", disabled ? "text-icon-tertiary" : "text-icon-primary")}
            aria-hidden
          />
          <div
            className={cx(
              "gap-detail-tight type-body flex w-full flex-col text-center",
              disabled ? "text-text-tertiary" : "text-text-primary",
            )}
          >
            <span className="type-body-em m-0 w-full">{title}</span>
            <span className="type-body m-0 w-full">
              {disabled ? (
                "Drag and drop files, or click to upload."
              ) : (
                <>
                  Drag and drop files, or <span className="underline">click to upload</span>.
                </>
              )}
            </span>
          </div>
          {!disabled && (
            <input
              className="sr-only"
              type="file"
              accept={accept}
              onChange={(event) => {
                takeOneFile(event.target.files);
                event.target.value = "";
              }}
            />
          )}
        </div>
      </DropSurface>

      {rejectError && !file ? <ErrorText>{rejectError}</ErrorText> : null}

      {file && (
        <div className="gap-detail-close flex w-full items-center justify-between">
          <p className="type-body text-text-primary m-0 min-w-0 truncate">{file.name}</p>
          <IconButton
            variant="ghost"
            size="compact"
            aria-label={`Remove ${file.name}`}
            disabled={busy}
            onClick={() => {
              setRejectError(null);
              onFile(null);
            }}
            className="border-transparent disabled:bg-transparent disabled:hover:bg-transparent"
          >
            <SquareX className={busy ? "text-icon-tertiary" : "text-icon-error"} aria-hidden />
          </IconButton>
        </div>
      )}
    </div>
  );
}
