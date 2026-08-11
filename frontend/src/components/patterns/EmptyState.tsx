import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

/** Icon + title + description empty state, for panels/sections with nothing to show yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("gap-detail-close flex items-start", className)}>
      <div className="gap-detail-tight flex flex-col pt-1">
        <p className="type-body-em text-text-secondary m-0">{title}</p>
        {description ? <p className="type-body text-text-secondary m-0">{description}</p> : null}
      </div>
    </div>
  );
}
