import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Card } from "../ui/Card";

export function MetricCard({
  label,
  value,
  helper,
  icon,
  valueClassName,
  className,
  children,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  valueClassName?: string;
  className?: string;
  children?: ReactNode;
}) {
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
              "type-title text-text-primary min-w-0 truncate tracking-[-0.02em]",
              valueClassName,
            )}
          >
            {value}
          </div>
        </div>
        {helper ? <p className="type-meta text-text-tertiary m-0 w-full">{helper}</p> : null}
      </div>
      {children}
    </Card>
  );
}
