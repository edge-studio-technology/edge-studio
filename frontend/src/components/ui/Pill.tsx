import type { Tone } from "../../app/types";
import { cx } from "../../lib/cx";

const toneShellClass: Record<Tone, string> = {
  neutral: "border-transparent bg-surface-secondary",
  good: "border-stroke-success bg-surface-always-white",
  warn: "border-stroke-warning bg-surface-always-white",
  error: "border-stroke-error bg-surface-always-white",
};

const toneTintClass: Partial<Record<Tone, string>> = {
  good: "bg-feedback-positive/20",
  warn: "bg-feedback-warning/20",
  error: "bg-feedback-error/20",
};

const toneIndicatorClass: Record<Tone, string> = {
  neutral: "bg-text-primary",
  good: "bg-feedback-positive",
  warn: "bg-feedback-warning",
  error: "bg-feedback-error",
};

export function Pill({
  children,
  className,
  indicator = false,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  indicator?: boolean;
  tone?: Tone;
}) {
  const tintClass = toneTintClass[tone];

  return (
    <span
      className={cx(
        "gap-detail-tight px-detail-next type-meta text-text-primary relative inline-flex h-6 w-fit items-center justify-center overflow-clip rounded-full border leading-none",
        toneShellClass[tone],
        className,
      )}
    >
      {tintClass ? <span aria-hidden className={cx("absolute inset-[-1px]", tintClass)} /> : null}
      {indicator ? (
        <span
          aria-hidden
          className={cx("relative size-1 shrink-0 rounded-full", toneIndicatorClass[tone])}
        />
      ) : null}
      <span className="relative">{children}</span>
    </span>
  );
}
