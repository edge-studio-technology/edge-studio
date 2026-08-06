import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { cx } from "../../lib/cx";
import { JsonBlock } from "./JsonBlock";

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
            "type-link text-text-accent hover:text-text-accent-hover transition-colors duration-200",
            "cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-55",
            className,
          )}
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      )}
      {open ? (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className="px-detail-next py-pad-close">
            <JsonBlock value={value} />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
