import type { InputHTMLAttributes } from "react";
import { cx } from "../lib/cx";

export type InputSize = "md" | "sm";

const inputClassBySize: Record<InputSize, string> = {
  md: "h-[44px] min-w-[120px] w-full rounded-loose border border-stroke-primary bg-surface-always-white px-detail-close type-body text-text-primary placeholder:text-text-disabled outline-none transition-[border-color] duration-200 focus-visible:border-stroke-active disabled:cursor-not-allowed disabled:bg-surface-primary disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-stroke-error motion-reduce:transition-none",
  sm: "h-8 min-w-0 w-full rounded-loose border border-stroke-primary bg-surface-always-white px-detail-close type-meta text-text-primary placeholder:text-text-disabled outline-none transition-[border-color] duration-200 focus-visible:border-stroke-active disabled:cursor-not-allowed disabled:bg-surface-primary disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-stroke-error motion-reduce:transition-none",
};

export function Input({
  className,
  type = "text",
  size = "md",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: InputSize }) {
  return <input {...props} type={type} className={cx(inputClassBySize[size], className)} />;
}
