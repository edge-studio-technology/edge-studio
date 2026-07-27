import type { InputHTMLAttributes } from "react";
import { cx } from "../lib/cx";

const inputClass =
  "h-[44px] min-w-[120px] w-full rounded-loose border border-stroke-primary bg-surface-always-white px-detail-close type-body text-text-primary placeholder:text-text-disabled outline-none transition-[border-color] duration-200 focus-visible:border-stroke-active disabled:cursor-not-allowed disabled:bg-surface-primary disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-stroke-error motion-reduce:transition-none";

/** ESDS text control. Prefer `InputField` when you need a label / description / error. */
export function Input({
  className,
  type = "text",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type={type} className={cx(inputClass, className)} />;
}
