import { cx } from "../../lib/cx";

type SpinnerSize = "sm" | "md" | "lg";
type SpinnerTone = "primary" | "secondary";

const sizeClass: Record<SpinnerSize, string> = {
  sm: "size-5 border-2",
  md: "size-9 border-[3px]",
  lg: "size-16 border-4",
};

const toneClass: Record<SpinnerTone, string> = {
  primary: "border-t-icon-primary",
  secondary: "border-t-icon-secondary",
};

/**
 * @deprecated Use `SpinnerAlt` (radial dash, `components/ui/SpinnerAlt.tsx`) instead.
 * Kept until remaining call sites migrate.
 *
 * Decorative by design — always pair with adjacent text describing what's loading.
 */
export function Spinner({
  className,
  size = "md",
  tone = "primary",
}: {
  className?: string;
  size?: SpinnerSize;
  tone?: SpinnerTone;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "border-stroke-secondary animate-[spin_0.8s_linear_infinite] rounded-full motion-reduce:animate-none",
        sizeClass[size],
        toneClass[tone],
        className,
      )}
    />
  );
}
