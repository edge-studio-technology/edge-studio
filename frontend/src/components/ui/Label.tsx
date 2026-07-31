import type { LabelHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

/** Shared ESDS form-field label. */
export function Label({
  children,
  className,
  disabled = false,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cx(
        "type-meta block leading-none",
        disabled ? "text-text-tertiary" : "text-text-primary",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}
