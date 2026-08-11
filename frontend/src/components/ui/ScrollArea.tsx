import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

const scrollbarClass =
  "[scrollbar-width:thin] [scrollbar-color:var(--color-stroke-primary)_transparent] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-4 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-stroke-primary [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-thumb:hover]:bg-grey-04";

/** `stableGutter` reserves scrollbar space up front so content doesn't shift once it starts overflowing — turn it off for content that rarely/never overflows, where the reserved gap reads as unwanted empty space instead. */
export function ScrollArea({
  children,
  className,
  stableGutter = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; stableGutter?: boolean }) {
  return (
    <div
      {...props}
      className={cx(
        "min-h-0 overflow-auto",
        stableGutter && "scrollbar-gutter-stable",
        scrollbarClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
