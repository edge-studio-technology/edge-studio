import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, X } from "lucide-react";
import { IconButton } from "../../../components/Button";
import { TableIconButton } from "../../../components/DataTable";
import { Card } from "../../../components/ui/Card";
import { Disclosure } from "../../../components/ui/Disclosure";
import { Pill } from "../../../components/ui/Pill";
import { ScrollArea } from "../../../components/ui/ScrollArea";
import { Tooltip } from "../../../components/ui/Tooltip";
import { cx } from "../../../lib/cx";
import type {
  AutomationBlockType,
  AutomationValidationResult,
  AutomationWorkflow,
} from "../automationTypes";
import { groupValidationIssues } from "./workflowHelpers";
import { Text } from "../../../components/ui/Text";
import { blockHelp, type WorkflowBlockHelpField } from "./workflowBlockHelp";

/** Workspace chrome for Automation page screens (list/create/edit/watch). Not the graph — that lives in `workflow/canvas/`. */
export const mutedText = "type-body text-text-secondary";
export const errorText = "type-body text-text-error";
export const cardClass =
  "rounded-soft border border-stroke-secondary bg-surface-always-white p-margin-tight shadow-sm";
export const softCardClass =
  "rounded-soft border border-stroke-secondary bg-surface-always-white p-margin-tight shadow-[0_16px_40px_rgba(0,0,0,0.10)]";
export const statusRowClass = "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";
export const formGridClass = "grid gap-detail-close";
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

/** Status pills under the workspace top bar. */
export function WorkflowStatusStrip({ children }: { children: ReactNode }) {
  return (
    <div className="gap-detail-next flex flex-wrap items-center" role="status">
      {children}
    </div>
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

/** True when the validation card should render (hidden when fully passed). */
export function isWorkflowValidationVisible(
  validation: AutomationValidationResult | null,
  localErrors: string[] = [],
  fetchError: string | null = null,
): boolean {
  if (fetchError) return true;
  if (!validation && localErrors.length === 0) return true;
  const errorCount = localErrors.length + (validation?.errors.length ?? 0);
  const warningCount = validation?.warnings.length ?? 0;
  return errorCount > 0 || warningCount > 0;
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

  // Quiet when OK — block cards and the primary CTA already signal success.
  if (status === "passed") return null;

  const statusPill =
    status === "checking" ? (
      <Pill tone="neutral" indicator>
        Checking
      </Pill>
    ) : status === "unavailable" ? (
      <Pill tone="error" indicator>
        Unavailable
      </Pill>
    ) : (
      <Pill tone={issuesTone} indicator>
        {issuesSummary}
      </Pill>
    );

  return (
    <Panel className={cx("relative grid", status === "issues" && "max-h-[320px] overflow-hidden")}>
      <Disclosure
        title={
          <span className="gap-detail-next flex min-w-0 flex-wrap items-center">
            <span className="type-title text-text-primary">Validation</span>
            {statusPill}
          </span>
        }
        defaultOpen={false}
        summaryClassName="items-center"
        contentClassName={cx(
          "gap-detail-close grid min-h-0",
          status === "issues" && "overflow-auto",
        )}
      >
        <p className={cx(mutedText, "m-0")}>{description}</p>
        {status === "checking" && <p className={cx(mutedText, "m-0")}>Checking workflow…</p>}
        {status === "unavailable" && <p className={cx(errorText, "m-0")}>{fetchError}</p>}
        {status === "issues" && (
          <div className="gap-detail-tight grid min-h-0">
            {groupedIssues.map(({ issue, count }) => (
              <ValidationIssueRow
                key={validationIssueKey(issue, count)}
                issue={issue}
                count={count}
              />
            ))}
          </div>
        )}
      </Disclosure>
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
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div
        className="bg-overlay-light absolute inset-0"
        aria-hidden
        onPointerDown={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <aside
        className="bg-surface-always-white border-stroke-secondary absolute inset-y-0 right-0 grid h-full min-h-0 w-full max-w-[400px] grid-rows-[auto_minmax(0,1fr)_auto] border-l shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="px-margin-tight pt-margin-tight pb-detail-close gap-detail-close flex items-start justify-between">
          <div className="gap-detail-tight grid">
            <Text.Title>{title}</Text.Title>
            {description ? <Text.Body>{description}</Text.Body> : null}
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
          <div className="px-margin-tight pt-detail-close pb-margin-tight flex items-center justify-end">
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
        <Text.Subtitle>{title}</Text.Subtitle>
        {description ? <Text.Body className="text-text-secondary">{description}</Text.Body> : null}
      </div>
      {children}
    </Card>
  );
}

export function BlockHelpDisclosure({ type }: { type: AutomationBlockType }) {
  const help = blockHelp(type);
  return (
    <Card size="Compact" className="border-stroke-secondary bg-surface-primary border">
      <Disclosure title="About this block" summaryClassName="type-callout" defaultOpen={false}>
        <div className="gap-detail-close grid">
          <div className="border-stroke-secondary bg-surface-always-white gap-detail-tight rounded-soft p-margin-close grid border">
            <Text.Body className="text-text-secondary">{help.tooltip}</Text.Body>
          </div>
          <div className="gap-detail-next grid">
            <BlockHelpPanel title="What it does">{help.whatItDoes}</BlockHelpPanel>
            <BlockHelpPanel title="When to use it">{help.whenToUse}</BlockHelpPanel>
          </div>
          {help.fields.length > 0 ? <BlockFieldReference fields={help.fields} /> : null}
          <BlockHelpList title="Outputs" items={help.outputs} />
          <Text.Link to={`/workflows/help#${type}`} target="_blank" rel="noopener noreferrer">
            Open full guide
          </Text.Link>
        </div>
      </Disclosure>
    </Card>
  );
}

function BlockHelpPanel({ title, children }: { title: string; children: string }) {
  return (
    <section className="border-stroke-secondary bg-surface-always-white gap-detail-tight rounded-soft p-margin-close grid border">
      <h4 className="type-meta text-text-secondary m-0 uppercase">{title}</h4>
      <Text.Body className="text-text-secondary">{children}</Text.Body>
    </section>
  );
}

function BlockFieldReference({ fields }: { fields: WorkflowBlockHelpField[] }) {
  return (
    <section className="gap-detail-tight grid">
      <h4 className="type-meta text-text-secondary m-0 uppercase">Fields</h4>
      <div className="gap-detail-tight grid">
        {fields.map((field) => (
          <div
            key={field.label}
            className="border-stroke-secondary bg-surface-always-white gap-detail-tight rounded-soft p-margin-close grid border"
          >
            <div className="gap-detail-tight flex flex-wrap items-center">
              <Text.BodyEm>{field.label}</Text.BodyEm>
              {field.required ? <Pill tone="warn">Required</Pill> : null}
            </div>
            <Text.Body className="text-text-secondary">{field.description}</Text.Body>
            {field.shownWhen ? <Text.Muted>Shown when: {field.shownWhen}.</Text.Muted> : null}
            {field.example ? (
              <Text.Muted>
                Example: <code>{field.example}</code>
              </Text.Muted>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function BlockHelpList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="gap-detail-tight grid">
      <h4 className="type-meta text-text-secondary m-0 uppercase">{title}</h4>
      <ul className="gap-detail-tight m-0 grid list-none p-0">
        {items.map((item) => (
          <li key={item} className="gap-detail-tight flex items-start">
            <CheckCircle2 aria-hidden className="text-icon-success mt-[2px] size-4 shrink-0" />
            <Text.Body className="text-text-secondary">{item}</Text.Body>
          </li>
        ))}
      </ul>
    </section>
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

/** Shared clickable card component for selecting block types (used in toolkit and inspector). */
export function BlockTypeCard({
  type,
  selected,
  disabled,
  disabledReason,
  onClick,
}: {
  type: AutomationBlockType;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}) {
  const help = blockHelp(type);
  const card = (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={cx(
        "rounded-loose p-detail-close border text-left transition-colors",
        "focus-visible:ring-stroke-active focus-visible:ring-2 focus-visible:outline-none",
        selected && "border-stroke-active bg-surface-always-white",
        disabled
          ? "text-text-disabled cursor-not-allowed opacity-60"
          : !selected &&
              "border-stroke-secondary bg-surface-primary hover:border-stroke-primary hover:bg-surface-always-white cursor-pointer",
      )}
      aria-disabled={disabled || undefined}
      aria-pressed={selected || undefined}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="gap-detail-close flex items-center justify-between">
        <span className="type-body-em text-text-primary">{help.title}</span>
        {selected && (
          <Check aria-hidden className="text-icon-primary size-4 shrink-0" strokeWidth={2.5} />
        )}
      </span>
    </div>
  );

  if (!disabled || !disabledReason) return card;

  return (
    <Tooltip title={disabledReason} placement="left">
      <span className="block w-full">{card}</span>
    </Tooltip>
  );
}
