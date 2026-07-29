import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

export type TabOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
};

const tabItemBaseClass =
  "inline-flex cursor-pointer items-center justify-center gap-detail-next overflow-clip border-b border-solid p-detail-next type-body transition-colors duration-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-stroke-active focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed motion-reduce:transition-none";

const tabItemSelectedClass = "border-stroke-active text-text-primary";

const tabItemIdleClass =
  "border-stroke-secondary text-text-tertiary enabled:hover:border-stroke-primary enabled:hover:text-text-primary disabled:border-transparent disabled:text-text-disabled";

const iconSlotClass =
  "inline-flex size-4 shrink-0 items-center justify-center text-current [&>svg]:size-full";

/**
 * ESDS Tab: underline segment.
 * States: active (stroke-active) / hover (stroke-primary) / inactive (stroke-secondary + text-tertiary).
 */
function TabItem({
  children,
  className,
  iconEnd,
  iconStart,
  selected,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  iconEnd?: ReactNode;
  iconStart?: ReactNode;
  selected?: boolean;
}) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={selected}
      className={cx(
        tabItemBaseClass,
        selected ? tabItemSelectedClass : tabItemIdleClass,
        className,
      )}
      {...props}
    >
      {iconStart ? <span className={iconSlotClass}>{iconStart}</span> : null}
      {children}
      {iconEnd ? <span className={iconSlotClass}>{iconEnd}</span> : null}
    </button>
  );
}

/**
 * ESDS Tab list: underline tabs in a horizontal row.
 * `TabItem` is not exported — pass rows through `options`.
 */
export function TabList<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly TabOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cx("inline-flex items-center", className)}>
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <TabItem
            key={option.value}
            selected={selected}
            disabled={option.disabled}
            iconStart={option.iconStart}
            iconEnd={option.iconEnd}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </TabItem>
        );
      })}
    </div>
  );
}
