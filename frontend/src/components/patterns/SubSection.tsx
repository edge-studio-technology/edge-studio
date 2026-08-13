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
    <div className={"pl-4 " + className}>
      <h4 className="type-body-em type-subtitle text-text-primary mb-2 flex items-center gap-1.5 tracking-wide">
        {icon} {title}
      </h4>
      {description ? <p className="type-body text-text-secondary m-0">{description}</p> : null}
      <div className="mt-4 grid">{children}</div>
    </div>
  );
}
