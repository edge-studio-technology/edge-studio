import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export function ButtonRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("gap-detail-next flex flex-wrap items-center", className)}>{children}</div>
  );
}
