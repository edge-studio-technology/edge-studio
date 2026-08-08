import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "../../lib/cx";
import { IconButton } from "../ui/Button";

/**
 * Standalone call-to-action notice: white card, primary border, title, optional
 * body, optional action, optional dismiss. Prefer this outside page layout/toast
 * flow (e.g. sidebar chrome) where content needs to sit in fixed space rather
 * than push layout like ErrorAlert or float transiently like a toast.
 */
export function NoticeCard({
  title,
  children,
  action,
  onDismiss,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "bg-surface-always-white border-stroke-primary rounded-soft p-pad-tight gap-detail-close relative flex flex-col border",
        className,
      )}
      role="status"
    >
      {onDismiss ? (
        <IconButton
          variant="ghost"
          size="compact"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="top-detail-next right-detail-next enabled:hover:border-stroke-primary absolute border-transparent"
        >
          <X aria-hidden />
        </IconButton>
      ) : null}
      <div className="gap-detail-tight flex flex-col pr-8">
        <strong className="type-body-em text-text-primary">{title}</strong>
        {children ? <p className="type-body text-text-secondary m-0">{children}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
