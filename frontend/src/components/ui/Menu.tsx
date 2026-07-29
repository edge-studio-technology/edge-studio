import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Plus } from "lucide-react";
import { cx } from "../../lib/cx";

const menuItemClass =
  "relative inline-flex w-full cursor-pointer items-center gap-detail-next border-0 bg-surface-always-white p-margin-tight type-body text-text-primary transition-colors duration-200 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-solid [&:not(:first-child)]:border-stroke-secondary enabled:hover:bg-surface-secondary focus-visible:z-10 focus-visible:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-stroke-active focus-visible:ring-inset focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-always-white disabled:text-text-disabled disabled:hover:bg-surface-always-white motion-reduce:transition-none";

type MenuItemConfig = {
  label: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
};

/**
 * ESDS Menu Item: Plus icon + label.
 * States: default (white) / hover (surface-secondary) / disabled.
 * Separators: top border on every item except the first.
 */
function MenuItem({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
}) {
  return (
    <button type={type} role="menuitem" className={cx(menuItemClass, className)} {...props}>
      <span className="inline-flex size-4 shrink-0 items-center justify-center text-current [&>svg]:size-full">
        <Plus aria-hidden />
      </span>
      {children}
    </button>
  );
}

export function Menu({ items, className }: { items: MenuItemConfig[]; className?: string }) {
  return (
    <div
      role="menu"
      className={cx("flex min-w-40 flex-col items-stretch overflow-clip", className)}
    >
      {items.map((item, index) => (
        <MenuItem
          key={`menu-item-${index}`}
          disabled={item.disabled}
          className={item.className}
          onClick={item.onClick}
        >
          {item.label}
        </MenuItem>
      ))}
    </div>
  );
}
