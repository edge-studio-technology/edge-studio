import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { EllipsisVertical } from "lucide-react";
import { Card } from "../Card";
import { StatusRow } from "../StatusRow";
import { MutedText } from "../Text";
import { cx } from "../../lib/cx";
import { IconButton } from "../ui/Button";

/** Shared visual tokens — prefer `TableHead` / `TableRow` / `TableCell` components in new code. Remove this comment when migrated */
export const tableHeadRowClass = "bg-surface-secondary type-body-em text-text-primary";
export const tableHeaderCellClass = "px-margin-tight py-margin-tight text-left align-middle whitespace-nowrap";
export const tableRowClass = "border-t border-stroke-primary bg-surface-always-white";
export const tableCellClass =
  "px-margin-tight py-margin-tight type-body text-text-primary align-middle whitespace-nowrap";

/** Bordered scroll shell for list tables. Includes a modest min-height (~4 rows). */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-loose border-stroke-primary bg-surface-always-white min-h-[280px] overflow-x-auto border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DataTable({
  children,
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <table
      className={cx("type-meta w-full border-collapse text-left", className)}
      {...props}
    >
      {children}
    </table>
  );
}

/** Header section: one grey row; put `TableHeaderCell` children inside. */
export function TableHead({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }) {
  return (
    <thead className={className} {...props}>
      <tr className={tableHeadRowClass}>{children}</tr>
    </thead>
  );
}

export function TableBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
  return (
    <tr className={cx(tableRowClass, className)} {...props}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cx(tableHeaderCellClass, className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx(tableCellClass, className)} {...props}>
      {children}
    </td>
  );
}

export function TableCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx("gap-detail-close grid", className)}>
      <StatusRow className="sm:items-start">
        <div>
          <strong>{title}</strong>
          {description && <MutedText className="mt-detail-tight m-0">{description}</MutedText>}
        </div>
        {actions}
      </StatusRow>
      {children}
    </Card>
  );
}

export function EmptyTableState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <MutedText className={className}>{children}</MutedText>;
}

export function RowActions({
  children,
  className,
  wrap = false,
}: {
  children: ReactNode;
  className?: string;
  wrap?: boolean;
}) {
  return (
    <div
      className={cx(
        "gap-detail-next flex flex-row items-center",
        wrap ? "flex-wrap" : "flex-nowrap",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TableIconButton({
  children,
  className,
  danger,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <IconButton
      type={type}
      size="compact"
      variant="secondary"
      className={cx(
        danger && "text-icon-error hover:border-stroke-error hover:text-text-error",
        className,
      )}
      {...props}
    >
      {children}
    </IconButton>
  );
}
export type RowOverflowMenuItem = {
  label: ReactNode;
  title?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

/** Row-actions overflow: ⋮ opens a menu (portaled so table overflow doesn’t clip it). */
export function TableIconMenu({
  items,
  "aria-label": ariaLabel = "More actions",
}: {
  items: RowOverflowMenuItem[];
  "aria-label"?: string;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    function place() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (document.getElementById(menuId)?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuId]);

  return (
    <div className="relative" ref={rootRef}>
      <IconButton
        type="button"
        size="compact"
        variant="ghost"
        className="border-secondary hover:bg-surface-secondary bg-transparent"
        title={ariaLabel}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <EllipsisVertical aria-hidden />
      </IconButton>
      {open && coords
        ? createPortal(
            <div
              id={menuId}
              role="menu"
              className="border-stroke-primary bg-surface-always-white rounded-loose fixed z-50 min-w-40 overflow-clip border"
              style={{ top: coords.top, right: coords.right }}
            >
              {items.map((item, index) => (
                <button
                  key={`table-more-${index}`}
                  type="button"
                  role="menuitem"
                  title={item.title}
                  disabled={item.disabled}
                  className={cx(
                    "type-body enabled:hover:bg-surface-secondary focus-visible:bg-surface-secondary focus-visible:ring-stroke-active p-margin-tight disabled:text-text-disabled [&:not(:first-child)]:border-stroke-secondary w-full cursor-pointer border-0 bg-transparent text-left transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed [&:not(:first-child)]:border-t",
                    item.danger ? "text-text-error" : "text-text-primary",
                  )}
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
