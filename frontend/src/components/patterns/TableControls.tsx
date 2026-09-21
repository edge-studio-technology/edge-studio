import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export function TableControls({
  children,
  utilities,
  className,
}: {
  children?: ReactNode;
  utilities?: ReactNode;
  className?: string;
}) {
  if (!children && !utilities) return null;

  return (
    <div
      className={cx("gap-detail-close flex w-full flex-col md:flex-row md:items-end", className)}
    >
      {children ? <div className="w-full min-w-0 flex-1">{children}</div> : null}
      {utilities ? (
        <div className="gap-detail-next flex w-full shrink-0 justify-end sm:w-auto sm:items-center">
          {utilities}
        </div>
      ) : null}
    </div>
  );
}
