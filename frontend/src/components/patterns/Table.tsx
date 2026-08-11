import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "border border-stroke-primary flex flex-col overflow-clip rounded-loose w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TableHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "bg-surface-secondary border-b border-stroke-primary flex items-center gap-detail-close p-margin-tight",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TableHeaderCell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-1 items-center min-w-0 type-body-em text-text-primary", className)}>
      {children}
    </div>
  );
}

export function TableRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "bg-surface-always-white border-b border-stroke-primary last:border-b-0 flex items-center gap-detail-close p-margin-tight",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TableCell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-1 items-center min-w-0 type-meta text-text-secondary", className)}>
      {children}
    </div>
  );
}
