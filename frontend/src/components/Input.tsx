import type { InputHTMLAttributes } from "react";
import { cx } from "../lib/cx";

const inputClass =
  "w-full rounded border-0 bg-surface-always-white px-3 py-2.5 text-left text-sm font-bold text-text-primary shadow-[0_1px_2px_rgb(26_26_24_/_0.08)] ring-1 ring-stroke-primary/80 outline-none transition-[box-shadow,ring-color] duration-150 focus-visible:ring-2 focus-visible:ring-text-primary/25 focus-visible:ring-offset-2 motion-reduce:transition-none";

/** Shared text field matching the onboarding / ESDS form look. */
export function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type={type} className={cx(inputClass, className)} />;
}
