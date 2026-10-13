import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cx } from "../../lib/cx";

export type ErrorAlertStatus = "error" | "warning" | "attention" | "success";

const statusShellClass: Record<ErrorAlertStatus, string> = {
  error: "border-stroke-error",
  warning: "border-stroke-warning",
  attention: "border-stroke-info",
  success: "border-stroke-success",
};

const statusTintClass: Record<ErrorAlertStatus, string> = {
  error: "bg-feedback-error",
  warning: "bg-feedback-warning",
  attention: "bg-feedback-info",
  success: "bg-feedback-positive",
};

const statusIconClass: Record<ErrorAlertStatus, string> = {
  error: "text-icon-error",
  warning: "text-icon-warning",
  attention: "text-icon-info",
  success: "text-icon-success",
};

const statusLabel: Record<ErrorAlertStatus, string> = {
  error: "Error",
  warning: "Warning",
  attention: "Attention",
  success: "Success",
};

const statusIcon = {
  error: AlertCircle,
  warning: TriangleAlert,
  attention: Info,
  success: CheckCircle2,
} as const;

export function ErrorAlert({
  title,
  children,
  action,
  className,
  status = "error",
  variant = "full",
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  status?: ErrorAlertStatus;
  variant?: "full" | "compact";
}) {
  const Icon = statusIcon[status];

  return (
    <div
      className={cx(
        "rounded-soft bg-surface-always-white relative flex max-w-xl items-start overflow-clip border",
        statusShellClass[status],
        className,
      )}
      role={status === "error" ? "alert" : "status"}
    >
      <div
        className={cx("pointer-events-none absolute inset-0 opacity-20", statusTintClass[status])}
        aria-hidden
      />
      <div className={cx("gap-detail-close p-margin-tight relative flex min-w-0 flex-1 items-start", variant === "compact" && "py-pad-close")}>
        <div className="grid size-5 shrink-0 place-items-center">
          <Icon className={statusIconClass[status]} size={20} aria-hidden="true" />
        </div>
        <div className="gap-detail-tight grid min-w-0 flex-1">
          <div className="gap-detail-tight flex items-center">
            <span className={cx("type-meta border-r pr-detail-tight font-emphasis", statusIconClass[status], statusShellClass[status])}>
              {statusLabel[status]}
            </span>
            {title ? <strong className="type-body-em text-text-primary">{title}</strong> : null}
          </div>
          {variant === "full" && children ? (
            <div className={cx("type-body m-0 break-normal", title ? "text-text-secondary" : "text-text-primary")}>
              {children}
            </div>
          ) : null}
        </div>
        {variant === "full" && action ? <div className="relative shrink-0 self-center">{action}</div> : null}
      </div>
    </div>
  );
}
