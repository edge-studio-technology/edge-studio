import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

export type ToggleTabOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type ToggleTabsSize = "md" | "sm";

const trackSizeClass: Record<ToggleTabsSize, string> = {
  md: "gap-detail-next p-detail-tight",
  sm: "gap-detail-tight p-detail-fine",
};

const itemSizeClass: Record<ToggleTabsSize, string> = {
  md: "h-[44px] px-detail-close type-body",
  sm: "h-8 px-detail-next type-meta",
};

const toggleTabItemBaseClass =
  "inline-flex min-w-px flex-1 cursor-pointer items-center justify-center overflow-clip rounded-loose border whitespace-nowrap transition-colors duration-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-stroke-active focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed motion-reduce:transition-none";

const toggleTabItemSelectedClass = "border-transparent bg-surface-inverse text-text-inverse";

const toggleTabItemIdleClass =
  "border-stroke-secondary bg-transparent text-text-primary enabled:hover:bg-surface-always-white disabled:border-transparent disabled:text-text-disabled";

/**
 * Toggle Tab segment: inverse when selected, ghost when idle.
 */
function ToggleTabItem({
  children,
  className,
  selected,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  selected?: boolean;
}) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={selected}
      className={cx(
        toggleTabItemBaseClass,
        selected ? toggleTabItemSelectedClass : toggleTabItemIdleClass,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Toggle Tabs: equal-width segments on a surface-secondary track.
 * `ToggleTabItem` is not exported — pass segments through `options`.
 */
export function ToggleTabs<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  label: string;
  value: T;
  options: readonly ToggleTabOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: ToggleTabsSize;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx(
        "rounded-loose bg-surface-secondary inline-flex items-center",
        trackSizeClass[size],
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <ToggleTabItem
            key={option.value}
            selected={selected}
            disabled={option.disabled}
            className={itemSizeClass[size]}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </ToggleTabItem>
        );
      })}
    </div>
  );
}
