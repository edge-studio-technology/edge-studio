import { ChevronLeft } from "lucide-react";
import { cx } from "../../lib/cx";
import { IconButton } from "./Button";
import { Pill } from "./Pill";

export function ProgressBar({
  backLabel = "Back",
  className,
  current,
  progressLabel = "Progress",
  onBack,
  showBack = true,
  total,
}: {
  backLabel?: string;
  className?: string;
  current: number;
  progressLabel?: string;
  onBack?: () => void;
  showBack?: boolean;
  total: number;
}) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(0, current), safeTotal);
  const percent = (safeCurrent / safeTotal) * 100;

  return (
    <div className={cx("gap-detail-close flex w-full items-center", className)}>
      {showBack ? (
        <IconButton
          variant="ghost"
          size="compact"
          aria-label={backLabel}
          onClick={onBack}
          disabled={!onBack}
        >
          <ChevronLeft aria-hidden />
        </IconButton>
      ) : null}

      <div
        className="bg-surface-secondary min-w-px flex-1 overflow-clip"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCurrent}
        aria-valuetext={`${safeCurrent} / ${safeTotal}`}
      >
        <div
          className="bg-surface-accent h-1 transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>

      <Pill className="shrink-0">
        {safeCurrent} / {safeTotal}
      </Pill>
    </div>
  );
}
