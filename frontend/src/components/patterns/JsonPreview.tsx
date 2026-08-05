import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { cx } from "../../lib/cx";

export function JsonPreview({
  value,
  label = "View JSON",
  title = "JSON preview",
  variant = "link",
  icon,
  disabled = false,
  className,
}: {
  value: unknown;
  label?: string;
  title?: string;
  variant?: "link" | "button";
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "button" ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={className}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {icon}
          {label}
        </Button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          className={cx(
            "type-meta text-text-accent border-0 bg-transparent p-0 font-semibold underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-55",
            className,
          )}
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      )}
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <pre className="type-mono text-text-inverse bg-surface-inverse border-stroke-secondary rounded-soft border p-pad-tight m-0 overflow-x-auto leading-[1.5] whitespace-pre [tab-size:2]">
            {JSON.stringify(value, null, 2)}
          </pre>
        </Modal>
      )}
    </>
  );
}
