import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "../../components/Button";
import { TableIconButton } from "../../components/DataTable";
import { Card } from "../../components/ui/Card";
import { ScrollArea } from "../../components/ui/ScrollArea";
import { cx } from "../../lib/cx";
import type { AutomationValidationResult, AutomationWorkflow } from "./automationTypes";

/** Workspace chrome for Automation page screens (list/create/edit/watch). Not the graph — that lives in `workflow-canvas/`. */
export const mutedText = "type-body text-text-secondary";
export const errorText = "type-body-em text-text-error";
export const cardClass =
  "rounded-soft border border-stroke-secondary bg-surface-always-white p-margin-tight shadow-sm";
export const softCardClass =
  "rounded-soft border border-stroke-secondary bg-surface-always-white p-margin-tight shadow-[0_16px_40px_rgba(0,0,0,0.10)]";
export const statusRowClass = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
export const formGridClass =
  "grid gap-detail-close [&_label]:grid [&_label]:gap-detail-next [&_label]:type-meta [&_label]:text-text-primary";
export const inspectorClass =
  "grid content-start gap-detail-close overflow-visible xl:sticky xl:top-margin-tight";

export function StatusPill({
  status,
  children,
}: {
  status: "good" | "warn" | "neutral";
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide",
        status === "good"
          ? "bg-emerald-100 text-emerald-700"
          : status === "warn"
            ? "bg-amber-100 text-amber-700"
            : "bg-slate-100 text-slate-600",
      )}
    >
      {children}
    </span>
  );
}

export function WorkflowStatusPill({ workflow }: { workflow: AutomationWorkflow }) {
  const label = workflow.archived
    ? "Archived"
    : workflow.lastError
      ? "Error"
      : workflow.enabled
        ? "Enabled"
        : "Paused";
  const status = workflow.archived
    ? "neutral"
    : workflow.lastError
      ? "warn"
      : workflow.enabled
        ? "good"
        : "neutral";
  return <StatusPill status={status}>{label}</StatusPill>;
}

export function IconAction({
  children,
  title,
  label,
  disabled,
  danger,
  onClick,
}: {
  children: ReactNode;
  title: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <TableIconButton
      danger={danger}
      type="button"
      disabled={disabled}
      title={title}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </TableIconButton>
  );
}

export function Panel({
  children,
  soft = true,
  className,
}: {
  children: ReactNode;
  soft?: boolean;
  className?: string;
}) {
  return <section className={cx(soft ? softCardClass : cardClass, className)}>{children}</section>;
}

export function SelectedBlockSheet({
  title,
  description,
  children,
  onClose,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="bg-overlay-light min-h-0" />
      <aside className="bg-surface-always-white border-stroke-secondary grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-l shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="px-margin-tight pt-margin-tight pb-detail-close flex items-start justify-between gap-detail-close">
          <div className="grid gap-detail-tight">
            <h2 className="type-title text-text-primary m-0">{title}</h2>
            {description ? <p className="type-meta text-text-secondary m-0">{description}</p> : null}
          </div>
          <IconButton
            type="button"
            variant="ghost"
            size="compact"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={onClose}
          >
            <X aria-hidden />
          </IconButton>
        </div>
        <ScrollArea className="min-h-0 px-margin-tight py-detail-close">{children}</ScrollArea>
        {footer && (
          <div className="px-margin-tight pt-detail-close pb-margin-tight flex justify-end">{footer}</div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

export function InspectorSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card size="Compact" className={cx("border-stroke-secondary grid gap-detail-close border", className)}>
      <div className="grid gap-detail-tight">
        <h3 className="type-body-em text-text-primary m-0">{title}</h3>
        {description ? <p className="type-meta text-text-secondary m-0">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

export function RuntimeStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-stroke-secondary flex items-center justify-between gap-detail-close border-b py-detail-tight last:border-b-0">
      <span className="type-meta text-text-secondary">{label}</span>
      <strong className="type-meta text-text-primary text-right">{value}</strong>
    </div>
  );
}

export function ValidationIssueRow({
  issue,
  count = 1,
}: {
  issue: AutomationValidationResult["errors"][number];
  count?: number;
}) {
  return (
    <p className={issue.level === "error" ? errorText : mutedText}>
      <StatusPill status={issue.level === "error" ? "warn" : "neutral"}>{issue.level}</StatusPill>{" "}
      {issue.message}
      {issue.blockType ? ` (${issue.blockType})` : ""}
      {count > 1 ? ` · ${count} blocks` : ""}
    </p>
  );
}

export function SaveState({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  if (dirty) {
    return (
      <p className={mutedText}>
        <StatusPill status="warn">Unsaved changes</StatusPill> Use this block's save button to apply edits.
      </p>
    );
  }
  if (saved) {
    return (
      <p className={mutedText}>
        <StatusPill status="good">Saved</StatusPill>
      </p>
    );
  }
  return (
    <p className={mutedText}>
      <StatusPill status="neutral">No unsaved changes</StatusPill>
    </p>
  );
}

export function RulePart({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <span className={mutedText}>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
