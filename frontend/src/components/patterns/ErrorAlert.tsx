import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cx } from "../../lib/cx";

export function ErrorAlert({
  title,
  children,
  action,
  className,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-soft border-stroke-error bg-surface-always-white relative flex max-w-xl items-start overflow-clip border",
        className,
      )}
      role="alert"
    >
      <div
        className="bg-feedback-error pointer-events-none absolute inset-0 opacity-20"
        aria-hidden
      />
      <div className="gap-detail-close p-margin-tight relative flex min-w-0 flex-1 items-start">
        <div className="grid size-5 shrink-0 place-items-center">
          <AlertCircle className="text-icon-error" size={20} aria-hidden="true" />
        </div>
        <div className="gap-detail-tight grid min-w-0 flex-1">
          {title ? <strong className="type-body-em text-text-primary">{title}</strong> : null}
          <div
            className={cx(
              "type-body m-0 break-words",
              title ? "text-text-secondary" : "text-text-primary",
            )}
          >
            {children}
          </div>
        </div>
        {action ? <div className="relative shrink-0 self-center">{action}</div> : null}
      </div>
    </div>
  );
}
