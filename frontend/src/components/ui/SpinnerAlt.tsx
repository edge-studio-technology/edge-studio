import { cx } from "../../lib/cx";

type SpinnerAltSize = "sm" | "md" | "lg";
type SpinnerAltTone = "primary" | "secondary";

const sizeClass: Record<SpinnerAltSize, string> = {
  sm: "size-5",
  md: "size-8",
  lg: "size-16",
};

const toneClass: Record<SpinnerAltTone, string> = {
  primary: "text-icon-primary",
  secondary: "text-icon-secondary",
};

/** Pins clockwise from 12 o'clock; index drives the stagger so the lit pin travels round. */
const PINS = [
  "M12 2v4",
  "m16.2 7.8 2.9-2.9",
  "M18 12h4",
  "m16.2 16.2 2.9 2.9",
  "M12 18v4",
  "m4.9 19.1 2.9-2.9",
  "M2 12h4",
  "m4.9 4.9 2.9 2.9",
];

const CYCLE_SECONDS = 0.8;

/** Decorative by design — always pair with adjacent text describing what's loading. */
export function SpinnerAlt({
  className,
  size = "md",
  tone = "primary",
}: {
  className?: string;
  size?: SpinnerAltSize;
  tone?: SpinnerAltTone;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("shrink-0", sizeClass[size], toneClass[tone], className)}
    >
      {PINS.map((d, index) => (
        <path
          key={d}
          d={d}
          className="animate-[spinner-pin_0.8s_linear_infinite] motion-reduce:animate-none"
          style={{
            animationDelay: `${-(CYCLE_SECONDS / PINS.length) * (PINS.length - 1 - index)}s`,
          }}
        />
      ))}
    </svg>
  );
}
