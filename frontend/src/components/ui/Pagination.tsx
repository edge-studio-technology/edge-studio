import { cx } from "../../lib/cx";

export type PaginationNumberState = "Default" | "Current";

export type PaginationNumberProps = {
  number: number;
  state?: PaginationNumberState;
  className?: string;
  onClick?: () => void;
};

/**
 * Pagination Number
 * - Default: transparent square with type-meta label + hover/focus ring.
 * - Current: inverse filled square with inverse text.
 */
export function PaginationNumber({
  number,
  state = "Default",
  className,
  onClick,
}: PaginationNumberProps) {
  const isCurrent = state === "Current";

  const baseClass =
    "flex size-8 flex-col items-center justify-center rounded-loose p-detail-next type-meta whitespace-nowrap";

  if (isCurrent) {
    return (
      <div
        aria-current="page"
        className={cx(baseClass, "bg-surface-inverse text-text-inverse", className)}
      >
        {number}
      </div>
    );
  }

  const isDisabled = !onClick;

  return (
    <button
      type="button"
      aria-label={`Go to page ${number}`}
      disabled={isDisabled}
      onClick={onClick}
      className={cx(
        baseClass,
        "text-text-primary cursor-pointer bg-transparent transition-colors duration-200",
        "focus-visible:ring-stroke-active focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        "enabled:hover:bg-surface-secondary disabled:text-text-disabled disabled:cursor-not-allowed",
        className,
      )}
    >
      {number}
    </button>
  );
}

function getCondensedPageItems(current: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const safeCurrent = Math.min(Math.max(1, current), totalPages);

  const nums = new Set<number>();
  nums.add(1);
  nums.add(2);
  nums.add(3);
  nums.add(totalPages);
  nums.add(totalPages - 1);
  nums.add(safeCurrent);
  nums.add(safeCurrent - 1);
  nums.add(safeCurrent + 1);

  const sorted = Array.from(nums)
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    const prev = sorted[i - 1]!;
    if (i > 0 && n - prev > 1) items.push("ellipsis");
    items.push(n);
  }

  return items;
}

export type PaginationProps = {
  className?: string;
  page: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
};

export function Pagination({ className, page, totalPages, onPageChange }: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  const canPrev = safePage > 1 && Boolean(onPageChange);
  const canNext = safePage < safeTotalPages && Boolean(onPageChange);

  const items = getCondensedPageItems(safePage, safeTotalPages);

  return (
    <div className={cx("flex w-full items-center justify-between", className)}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={!canPrev}
        onClick={() => onPageChange?.(safePage - 1)}
        className={cx(
          "rounded-loose px-detail-close type-meta inline-flex h-8 flex-none cursor-pointer items-center justify-center overflow-clip transition-colors duration-200 disabled:cursor-not-allowed",
          "focus-visible:ring-stroke-active focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
          "enabled:hover:bg-surface-secondary",
          canPrev
            ? "border-stroke-primary text-text-primary border bg-transparent"
            : "bg-surface-secondary text-text-disabled border-transparent disabled:cursor-not-allowed",
        )}
      >
        Previous
      </button>

      <div className="gap-detail-next flex flex-1 items-center justify-center">
        {items.map((item, idx) => {
          if (item === "ellipsis") {
            return (
              <div
                key={`ellipsis-${idx}`}
                className="rounded-loose p-detail-next text-text-primary flex size-8 items-center justify-center"
              >
                <span className="type-body-em leading-[1.4]">...</span>
              </div>
            );
          }

          const isCurrent = item === safePage;
          return (
            <PaginationNumber
              key={item}
              number={item}
              state={isCurrent ? "Current" : "Default"}
              onClick={isCurrent ? undefined : () => onPageChange?.(item)}
            />
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Next page"
        disabled={!canNext}
        onClick={() => onPageChange?.(safePage + 1)}
        className={cx(
          "rounded-loose px-detail-close type-meta inline-flex h-8 flex-none cursor-pointer items-center justify-center overflow-clip transition-colors duration-200 disabled:cursor-not-allowed",
          "focus-visible:ring-stroke-active focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
          "enabled:hover:bg-surface-secondary",
          canNext
            ? "border-stroke-primary text-text-primary border bg-transparent"
            : "bg-surface-secondary text-text-disabled border-transparent disabled:cursor-not-allowed",
        )}
      >
        Next
      </button>
    </div>
  );
}
