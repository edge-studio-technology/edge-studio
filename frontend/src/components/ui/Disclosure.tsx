import { ChevronDown } from "lucide-react";
import type { DetailsHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { cx } from "../../lib/cx";

export function Disclosure({
  title,
  children,
  className,
  summaryClassName,
  contentClassName,
  defaultOpen = true,
  onToggle,
  open: controlledOpen,
  ...props
}: Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "className" | "children" | "title"> & {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  return (
    <details
      {...props}
      className={cx("group gap-detail-next grid", className)}
      open={open}
      onToggle={(event) => {
        if (controlledOpen === undefined) setUncontrolledOpen(event.currentTarget.open);
        onToggle?.(event);
      }}
    >
      <summary
        className={cx(
          "type-body-em text-text-primary gap-detail-close rounded-loose focus-visible:ring-stroke-active flex cursor-pointer list-none items-center justify-between focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        <span>{title}</span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className={cx("gap-detail-next grid", contentClassName)}>{children}</div>
    </details>
  );
}
