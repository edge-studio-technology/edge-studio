import type { ReactNode } from "react";
import { AlertCircle, TriangleAlert } from "lucide-react";
import { cx } from "../../lib/cx";

export type ErrorAlertStatus = "error" | "warning";

const statusShellClass: Record<ErrorAlertStatus, string> = {
  error: "border-stroke-error",
  warning: "border-stroke-warning",
};

const statusTintClass: Record<ErrorAlertStatus, string> = {
  error: "bg-feedback-error",
  warning: "bg-feedback-warning",
};

const statusIconClass: Record<ErrorAlertStatus, string> = {
  error: "text-icon-error",
  warning: "text-icon-warning",
};

export function ErrorAlert({
  title,
  children,
  action,
  className,
  status = "error",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  status?: ErrorAlertStatus;
}) {
  const Icon = status === "warning" ? TriangleAlert : AlertCircle;

  return (
    <div
      className={cx(
        "rounded-soft bg-surface-always-white relative flex max-w-xl items-start overflow-clip border",
        statusShellClass[status],
        className,
      )}
      role={status === "warning" ? "status" : "alert"}
    >
      <div
        className={cx("pointer-events-none absolute inset-0 opacity-20", statusTintClass[status])}
        aria-hidden
      />
      <div className="gap-detail-close p-margin-tight relative flex min-w-0 flex-1 items-start">
        <div className="grid size-5 shrink-0 place-items-center">
          <Icon className={statusIconClass[status]} size={20} aria-hidden="true" />
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
