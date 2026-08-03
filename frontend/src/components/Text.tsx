import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";

export { ErrorText } from "./ui/ErrorText";

export function MutedText({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className={cx("text-slate-500", className)} {...props}>
      {children}
    </p>
  );
}
