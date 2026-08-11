import { cx } from "../../lib/cx";

export function LoadingDots({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1", className)}
      role="status"
      aria-label="Loading"
    >
      <span className="bg-icon-tertiary size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
      <span className="bg-icon-tertiary size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
      <span className="bg-icon-tertiary size-1.5 animate-bounce rounded-full" />
    </span>
  );
}
