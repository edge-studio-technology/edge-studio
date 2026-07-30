import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

/**
 * App-only: danger | onDark (keep until those surfaces are redesigned).
 */
type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "onDark";
/**
 * Default → md (44px), Compact → sm (32px).
 * TODO(migrate): `xs` is an alias of `sm` — replace call sites with `sm`, then remove `xs`.
 */
type ButtonSize = "md" | "sm" | "xs";
type IconButtonVariant = "primary" | "secondary" | "ghost";
type IconButtonSize = "default" | "compact";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-surface-inverse text-text-inverse enabled:hover:bg-grey-06 disabled:bg-surface-secondary disabled:text-text-disabled",
  secondary:
    "border-transparent bg-surface-secondary text-text-primary enabled:hover:border-stroke-primary disabled:bg-surface-secondary disabled:text-text-disabled",
  ghost:
    "border-stroke-secondary bg-transparent text-text-primary enabled:hover:border-stroke-primary disabled:border-transparent disabled:bg-surface-secondary disabled:text-text-disabled",
  accent:
    "border-transparent bg-surface-accent text-text-inverse enabled:hover:bg-surface-accent-hover disabled:bg-surface-secondary disabled:text-text-disabled",
  danger:
    "border-transparent bg-feedback-error text-text-inverse disabled:bg-surface-secondary disabled:text-text-disabled",
  onDark:
    "border-stroke-always-white bg-overlay-light text-text-inverse enabled:hover:bg-overlay-heavy disabled:bg-overlay-light disabled:text-text-disabled",
};

const iconButtonVariantClass: Record<IconButtonVariant, string> = {
  primary:
    "border-transparent bg-surface-inverse text-text-inverse enabled:hover:bg-grey-06 disabled:bg-surface-secondary disabled:text-text-disabled",
  secondary:
    "border-transparent bg-surface-secondary text-text-primary hover:border-stroke-primary disabled:bg-surface-secondary disabled:text-text-disabled disabled:hover:border-transparent",
  ghost:
    "border-stroke-secondary bg-transparent text-text-primary hover:border-stroke-primary disabled:border-transparent disabled:bg-surface-secondary disabled:text-text-disabled disabled:hover:border-transparent disabled:hover:bg-surface-secondary",
};

const sizeClass: Record<ButtonSize, string> = {
  md: "h-[44px] px-detail-close type-body",
  sm: "h-8 px-detail-close type-meta",
  xs: "h-8 px-detail-close type-meta",
};

/** Circle control size + inner glyph size (Icon Button). */
const iconButtonSizeClass: Record<IconButtonSize, string> = {
  default: "size-10",
  compact: "size-8",
};

const iconGlyphSizeClass: Record<IconButtonSize, string> = {
  default: "size-5",
  compact: "size-4",
};

/**
 * TODO(migrate): drop local button class constants and className style overrides; use variant + size.
 */
export function Button({
  children,
  className,
  iconEnd,
  iconStart,
  size = "md",
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  iconEnd?: ReactNode;
  iconStart?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button
      type={type}
      className={cx(
        "gap-detail-next rounded-loose focus-visible:ring-stroke-active inline-flex w-fit cursor-pointer items-center justify-center overflow-clip border transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {iconStart ? (
        <span className="inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-full">
          {iconStart}
        </span>
      ) : null}
      {children}
      {iconEnd ? (
        <span className="inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-full">
          {iconEnd}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Circular Icon Button. Callers must pass `aria-label` (or `aria-labelledby`).
 * Pass the glyph as `children` (sized by the component — omit lucide `size` props).
 * Size: `default` (40px) or `compact` (32px) only.
 * TODO(migrate): audit IconButton call sites for missing aria-label (e.g. Integritas page config).
 */
export function IconButton({
  children,
  className,
  size = "default",
  variant = "secondary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
}) {
  return (
    <button
      type={type}
      className={cx(
        "focus-visible:ring-stroke-active inline-grid shrink-0 cursor-pointer place-items-center overflow-clip rounded-full border transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100",
        iconButtonVariantClass[variant],
        iconButtonSizeClass[size],
        className,
      )}
      {...props}
    >
      <span
        className={cx(
          "inline-flex items-center justify-center [&>svg]:size-full",
          iconGlyphSizeClass[size],
        )}
      >
        {children}
      </span>
    </button>
  );
}
