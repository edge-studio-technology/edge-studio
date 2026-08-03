import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

/** Inline error copy for non-field contexts (RPC lines, modal body, etc.). Prefer field `error` or `ErrorAlert` when those fit. */
export function ErrorText({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p
      role="alert"
      className={cx("type-meta text-text-error m-0 leading-none", className)}
      {...props}
    >
      {children}
    </p>
  );
}
