import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

export function SubSection({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={"pl-3 " + className}>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold tracking-wide text-slate-500">
        {icon} {title}
      </h4>
      {description ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>{description}</p>
      ) : null}
      <div className="mt-2 grid">{children}</div>
    </div>
  );
}
