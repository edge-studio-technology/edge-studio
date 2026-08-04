import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

const scrollbarClass =
  "[scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:var(--color-stroke-primary)_transparent] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-4 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-stroke-primary [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-thumb:hover]:bg-grey-04";

export function ScrollArea({ children, className, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div {...props} className={cx("min-h-0 overflow-auto", scrollbarClass, className)}>
      {children}
    </div>
  );
}
