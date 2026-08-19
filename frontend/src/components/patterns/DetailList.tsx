import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cx("m-0 divide-y divide-slate-200 rounded-soft border border-slate-200 bg-white", className)}>
      {children}
    </dl>
  );
}

export function DetailRow({
  label,
  value,
  mono = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("grid gap-1 px-3 py-2 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center sm:gap-3", className)}>
      <dt className="m-0 text-sm font-medium text-slate-500">{label}</dt>
      <dd className={cx("m-0 min-w-0 text-sm break-all text-slate-800", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
