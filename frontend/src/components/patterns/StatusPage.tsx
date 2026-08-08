import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Centered icon + title + description + action, for whole-page states (not found, coming soon, etc). */
export function StatusPage({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="p-pad-distant grid h-full place-items-center text-center">
      <div className="gap-detail-near grid max-w-sm justify-items-center">
        <Icon size={44} className="text-icon-secondary" aria-hidden />
        <div className="gap-detail-tight my-4 grid">
          <h1 className="type-title text-text-primary m-0">{title}</h1>
          {description ? <p className="type-body text-text-secondary m-0">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
