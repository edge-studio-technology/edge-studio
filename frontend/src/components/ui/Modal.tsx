import { X } from "lucide-react";
import { useEffect, useId, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { closeModalOnOutsideClickSetting } from "../../lib/behaviourSettings";
import { cx } from "../../lib/cx";
import { IconButton } from "./Button";
import { ScrollArea } from "./ScrollArea";

// Nesting-safe body scroll lock (keeps overflow locked until the last open Modal unmounts).
let bodyScrollLockCount = 0;
let savedBodyOverflow: string | null = null;

function lockBodyScroll() {
  if (bodyScrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyScrollLockCount += 1;
}

function unlockBodyScroll() {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow ?? "";
    savedBodyOverflow = null;
  }
}

/**
 * Dialog: title + optional description, bordered scroll body, footer, close IconButton.
 * `width` picks the max-width track; default is 800px, "wide" is 960px.
 */
export function Modal({
  title,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
  className,
  bodyClassName,
  width = "default",
}: {
  title: string | ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  className?: string;
  bodyClassName?: string;
  width?: "default" | "wide";
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeOnOutsideClick = useSyncExternalStore(
    closeModalOnOutsideClickSetting.subscribe,
    closeModalOnOutsideClickSetting.get,
  );

  useEffect(() => {
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
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

  // Fires on press (mousedown), not click/release, so a text selection or drag that starts
  // inside the dialog and ends outside it can't be mistaken for an outside press. Only closes
  // when the press lands on the backdrop itself — the safety-zone wrapper's padding around the
  // dialog absorbs presses near the edge so they don't bubble up as a backdrop target.
  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (closeDisabled || !closeOnOutsideClick) return;
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div
      className="bg-overlay-heavy px-pad-tight py-pad-tight fixed inset-0 z-50 grid place-items-center"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className={cx("p-detail-close w-full", width === "wide" ? "max-w-240" : "max-w-200")}>
        <div
          className={cx(
            "bg-surface-always-white gap-detail-near rounded-soft p-pad-relaxed relative flex max-h-[min(90vh,760px)] w-full flex-col overflow-hidden",
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
            className="top-detail-next right-detail-next enabled:hover:border-stroke-primary absolute border-transparent"
          >
            <X aria-hidden />
          </IconButton>

          <div className="gap-detail-near flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="gap-detail-next flex shrink-0 flex-col pr-10">
              <h2 className="type-title text-text-primary m-0" id={titleId}>
                {title}
              </h2>
              {description ? (
                <div className="type-body text-text-primary m-0" id={descriptionId}>
                  {description}
                </div>
              ) : null}
            </div>

            {children ? (
              <ScrollArea
                className={
                  bodyClassName ??
                  "border-stroke-secondary bg-surface-primary rounded-soft p-pad-close min-h-0 flex-1 border"
                }
              >
                {children}
              </ScrollArea>
            ) : null}

            {footer ? (
              <div className="gap-detail-next flex shrink-0 flex-wrap items-center justify-end">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
