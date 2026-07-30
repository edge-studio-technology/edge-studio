import { X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/cx";
import { IconButton } from "./Button";

/**
 *  Dialog max-width 600, title + optional description / body / footer, close IconButton.
 */
export function Modal({
  title,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
  className,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (closeDisabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDisabled, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="bg-overlay-heavy px-margin-tight py-margin-tight fixed inset-0 z-50 grid place-items-center"
      role="presentation"
    >
      <div
        className={cx(
          "bg-surface-always-white gap-detail-near rounded-soft p-margin-relaxed relative flex max-h-[min(90vh,760px)] w-full max-w-[600px] flex-col overflow-hidden",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <IconButton
          variant="ghost"
          size="compact"
          aria-label="Close"
          disabled={closeDisabled}
          onClick={onClose}
          className="top-margin-close right-margin-close enabled:hover:border-stroke-primary absolute border-transparent"
        >
          <X aria-hidden />
        </IconButton>

        <div className="gap-detail-near flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          <div className="gap-detail-next flex flex-col pr-10">
            <h2 className="type-title text-text-primary m-0" id={titleId}>
              {title}
            </h2>
            {description ? (
              <div className="type-body text-text-primary m-0" id={descriptionId}>
                {description}
              </div>
            ) : null}
          </div>

          {children ? <div className="min-h-0 min-w-0">{children}</div> : null}

          {footer ? (
            <div className="gap-detail-next flex shrink-0 flex-wrap items-center justify-end">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
