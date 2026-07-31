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
}: Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "className" | "children"> & {
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
      className={cx("group grid gap-detail-next", className)}
      open={open}
      onToggle={(event) => {
        if (controlledOpen === undefined) setUncontrolledOpen(event.currentTarget.open);
        onToggle?.(event);
      }}
    >
      <summary
        className={cx(
          "type-body-em text-text-primary flex cursor-pointer list-none items-center justify-between gap-detail-close rounded-loose focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        <span>{title}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className={cx("grid gap-detail-next", contentClassName)}>{children}</div>
    </details>
  );
}
