import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "../../../components/Button";
import { TableIconButton } from "../../../components/DataTable";
import { Card } from "../../../components/ui/Card";
import { Pill } from "../../../components/ui/Pill";
import { ScrollArea } from "../../../components/ui/ScrollArea";
import { cx } from "../../../lib/cx";
import type { AutomationValidationResult, AutomationWorkflow } from "../automationTypes";
import { groupValidationIssues } from "./workflowHelpers";
import { Text } from "../../../components/Text";

/** Workspace chrome for Automation page screens (list/create/edit/watch). Not the graph — that lives in `workflow/canvas/`. */
export const mutedText = "type-body text-text-secondary";
export const errorText = "type-body text-text-error";
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
    <Pill tone={status} indicator>
      {children}
    </Pill>
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
  const tone = workflow.archived
    ? "neutral"
    : workflow.lastError
      ? "warn"
      : workflow.enabled
        ? "good"
        : "neutral";
  return (
    <Pill tone={tone} indicator>
      {label}
    </Pill>
  );
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

const DEFAULT_VALIDATION_DESCRIPTION =
  "Fix errors before continuing. Warnings are allowed, but should be reviewed before enabling hardware or wallet actions.";

type ValidationPanelStatus = "checking" | "unavailable" | "passed" | "issues";

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function validationIssueKey(issue: AutomationValidationResult["errors"][number], count: number) {
  return `${issue.level}-${issue.code}-${issue.message}-${issue.blockType ?? "workflow"}-${count}`;
}

/** Shared validation summary for create/edit/watch rails and watch inspectors. */
export function WorkflowValidationPanel({
  validation,
  localErrors = [],
  fetchError = null,
  description = DEFAULT_VALIDATION_DESCRIPTION,
}: {
  validation: AutomationValidationResult | null;
  localErrors?: string[];
  fetchError?: string | null;
  description?: string;
}) {
  const localIssues = localErrors.map((message) => ({
    level: "error" as const,
    code: "local",
    message,
  }));
  const backendErrors = validation?.errors ?? [];
  const backendWarnings = validation?.warnings ?? [];
  const errors = [...localIssues, ...backendErrors];
  const warnings = backendWarnings;
  const groupedIssues = groupValidationIssues([...errors, ...warnings]);

  const status: ValidationPanelStatus = fetchError
    ? "unavailable"
    : !validation && localErrors.length === 0
      ? "checking"
      : errors.length === 0 && warnings.length === 0
        ? "passed"
        : "issues";

  // Summary Pill: red when any errors, yellow when warnings-only.
  const issuesTone = errors.length > 0 ? "error" : "warn";
  const issuesSummary =
    errors.length > 0 && warnings.length > 0
      ? `${countLabel(errors.length, "error", "errors")}, ${countLabel(warnings.length, "warning", "warnings")}`
      : errors.length > 0
        ? countLabel(errors.length, "error", "errors")
        : countLabel(warnings.length, "warning", "warnings");

  return (
    <Panel
      className={cx(
        "gap-detail-close grid",
        status === "issues" && "max-h-[320px] overflow-hidden",
      )}
    >
      <div className="gap-detail-tight grid">
        <div className="gap-detail-next flex flex-wrap items-center justify-between">
          <Text.Title>Validation</Text.Title>
          {status === "checking" && (
            <Pill tone="neutral" indicator>
              Checking
            </Pill>
          )}
          {status === "unavailable" && (
            <Pill tone="error" indicator>
              Unavailable
            </Pill>
          )}
          {status === "passed" && (
            <Pill tone="good" indicator>
              Passed
            </Pill>
          )}
          {status === "issues" && (
            <Pill tone={issuesTone} indicator>
              {issuesSummary}
            </Pill>
          )}
        </div>
        <p className={cx(mutedText, "m-0")}>{description}</p>
      </div>

      {status === "checking" && <p className={cx(mutedText, "m-0")}>Checking workflow…</p>}
      {status === "unavailable" && <p className={cx(errorText, "m-0")}>{fetchError}</p>}
      {status === "passed" && (
        <p className={cx(mutedText, "m-0")}>
          No blocking issues. Review the canvas, then continue.
        </p>
      )}
      {status === "issues" && (
        <div className="gap-detail-tight grid min-h-0 overflow-auto">
          {groupedIssues.map(({ issue, count }) => (
            <ValidationIssueRow
              key={validationIssueKey(issue, count)}
              issue={issue}
              count={count}
            />
          ))}
        </div>
      )}
    </Panel>
  );
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
        <div className="px-margin-tight pt-margin-tight pb-detail-close gap-detail-close flex items-start justify-between">
          <div className="gap-detail-tight grid">
            <h2 className="type-title text-text-primary m-0">{title}</h2>
            {description ? (
              <p className="type-meta text-text-secondary m-0">{description}</p>
            ) : null}
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
        <ScrollArea className="px-margin-tight py-detail-close min-h-0">{children}</ScrollArea>
        {footer && (
          <div className="px-margin-tight pt-detail-close pb-margin-tight flex justify-end">
            {footer}
          </div>
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
    <Card
      size="Compact"
      className={cx("border-stroke-secondary gap-detail-close grid border", className)}
    >
      <div className="gap-detail-tight grid">
        <h3 className="type-body-em text-text-primary m-0">{title}</h3>
        {description ? <p className="type-meta text-text-secondary m-0">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

export function RuntimeStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-stroke-secondary gap-detail-close py-detail-tight flex items-center justify-between border-b last:border-b-0">
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
    <div className="gap-detail-next border-stroke-secondary py-detail-close grid grid-cols-[5.5rem_minmax(0,1fr)] items-start border-b last:border-b-0">
      <Pill tone={issue.level === "error" ? "error" : "warn"} indicator>
        {issue.level}
      </Pill>
      <p className={cx(issue.level === "error" ? errorText : mutedText, "m-0 min-w-0")}>
        {issue.message}
        {issue.blockType ? ` (${issue.blockType})` : ""}
        {count > 1 ? ` · ${count} blocks` : ""}
      </p>
    </div>
  );
}

export function SaveState({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  if (dirty) {
    return (
      <p className={mutedText}>
        <Pill tone="warn" indicator>
          Unsaved changes
        </Pill>{" "}
        Use this block's save button to apply edits.
      </p>
    );
  }
  if (saved) {
    return (
      <p className={mutedText}>
        <Pill tone="good" indicator>
          Saved
        </Pill>
      </p>
    );
  }
  return (
    <p className={mutedText}>
      <Pill tone="neutral" indicator>
        No unsaved changes
      </Pill>
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
