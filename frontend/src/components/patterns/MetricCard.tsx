import type { ReactNode } from "react";
import type { Status } from "../../app/types";
import { cx } from "../../lib/cx";
import { LoadingDots } from "../LoadingDots";
import { Card } from "../ui/Card";

const statusValueClass: Record<Status, string> = {
  neutral: "text-text-primary",
  success: "text-text-success",
  warning: "text-text-warning",
  error: "text-text-error",
};

export function MetricCard({
  label,
  value,
  description,
  icon,
  loading = false,
  status = "neutral",
  className,
  children,
}: {
  label: string;
  value?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  status?: Status;
  className?: string;
  children?: ReactNode;
}) {
  const displayValue = loading ? <LoadingDots /> : value;

  return (
    <Card size="Compact" className={cx("gap-detail-close flex w-full flex-col", className)}>
      <div className="gap-detail-next flex w-full flex-col items-start">
        <p className="type-meta text-text-primary m-0">{label}</p>
        <div className="gap-detail-next flex w-full min-w-0 items-center">
          {icon ? (
            <span
              className="text-icon-secondary flex size-5 shrink-0 items-center justify-center overflow-clip"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}
          <div
            className={cx(
              "type-title min-w-0 truncate tracking-[-0.02em]",
              loading ? "text-text-tertiary" : statusValueClass[status],
            )}
          >
            {displayValue}
          </div>
        </div>
        {description ? (
          <p className="type-meta text-text-tertiary m-0 w-full">{description}</p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
