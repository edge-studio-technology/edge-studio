import type { ButtonHTMLAttributes, ReactNode, TableHTMLAttributes } from "react";
import { Card } from "../Card";
import { StatusRow } from "../StatusRow";
import { MutedText } from "../Text";
import { cx } from "../../lib/cx";

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
      className={cx("type-meta w-full min-w-190 border-collapse text-left", className)}
      {...props}
    >
      {children}
    </table>
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
    <Card className={cx("grid gap-4", className)}>
      <StatusRow className="sm:items-start">
        <div>
          <strong>{title}</strong>
          {description && <MutedText className="m-0 mt-1">{description}</MutedText>}
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
  wrap = true,
}: {
  children: ReactNode;
  className?: string;
  wrap?: boolean;
}) {
  return (
    <div className={cx("flex items-center gap-2", wrap ? "flex-wrap" : "flex-nowrap", className)}>
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
    <button
      type={type}
      className={cx(
        "border-stroke-primary bg-surface-always-white text-icon-primary hover:border-stroke-active hover:text-text-accent inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-45",
        danger && "text-icon-error hover:border-stroke-error hover:text-text-error",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const tableHeadRowClass = "bg-surface-secondary type-body-em text-text-primary";
export const tableHeaderCellClass = "px-margin-tight py-margin-tight text-left";
export const tableRowClass = "border-t border-stroke-primary bg-surface-always-white align-top";
export const tableCellClass =
  "px-margin-tight py-margin-tight type-meta text-text-secondary align-top";
