import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/Button";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pause, Play } from "lucide-react";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableWrap,
} from "../../../components/DataTable";
import { JsonPreview, JsonPreviewContent } from "../../../components/JsonPreview";
import { Modal } from "../../../components/ui/Modal";
import { Disclosure } from "../../../components/ui/Disclosure";
import { ReadDetailsModal } from "../../data-reads/DataReadsHistoryTable";
import { getDataSourceRead } from "../../data-reads/dataReadsApi";
import type { DataSourceRead } from "../../data-reads/dataReadTypes";
import {
  orderedColumns,
  TableColumnVisibilityButton,
  type TableColumnDefinition,
} from "../../../components/patterns/TableColumnVisibility";
import { ScrollArea } from "../../../components/ui/ScrollArea";
import { formatLocalTime } from "../../../lib/time";
import { useTableColumnVisibility } from "../../preferences/useTableColumnVisibility";
import type { AutomationBlock, AutomationRun, AutomationWorkflow } from "../automationTypes";
import { WorkflowRailHeader, WorkflowRailPanel } from "./chrome/WorkflowRail";
import {
  blockLabel,
  diagnosticsLink,
  formatDuration,
  proofIdFromOutput,
  readIdFromOutput,
} from "./workflowHelpers";
import {
  InspectorSection,
  Panel,
  RuntimeStat,
  StatusPill,
  errorText,
  formGridClass,
  mutedText,
  statusRowClass,
} from "./workflowWorkspaceUi";

function statusTone(status: AutomationRun["status"] | undefined) {
  if (status === "success") return "good";
  if (status === "failed") return "warn";
  return "neutral";
}

function workflowStateSummary(workflow: AutomationWorkflow, hasValidationErrors: boolean) {
  if (workflow.archived) return "Archived workflows cannot run until restored.";
  if (hasValidationErrors) return "Validation errors must be fixed before this workflow can run.";
  if (!workflow.enabled) return "Paused. It will not run automatically until resumed.";
  return "Active and ready for incoming triggers.";
}

function runProgressLabel(run: AutomationRun | undefined) {
  if (!run) return "No run selected";
  const completedBlocks = run.blocks.filter((block) => block.status === "success").length;
  if (run.status === "running") return `${completedBlocks}/${run.blockCount} blocks completed`;
  if (run.status === "failed") return `${completedBlocks}/${run.blockCount} blocks completed before failure`;
  return `${completedBlocks}/${run.blockCount} blocks completed`;
}

function isEventTriggeredWorkflow(workflow: AutomationWorkflow) {
  const startBlock = workflow.blocks
    .filter((block) => !block.parentBlockId)
    .sort((a, b) => a.order - b.order)[0];
  return (
    startBlock?.type === "gpio_event_start" ||
    startBlock?.type === "webhook_event_start" ||
    startBlock?.type === "mqtt_event_start"
  );
}

function eventTriggerLabel(workflow: AutomationWorkflow) {
  const startBlock = workflow.blocks
    .filter((block) => !block.parentBlockId)
    .sort((a, b) => a.order - b.order)[0];
  if (startBlock?.type === "gpio_event_start") return "GPIO trigger";
  if (startBlock?.type === "webhook_event_start") return "webhook trigger";
  if (startBlock?.type === "mqtt_event_start") return "MQTT trigger";
  return "trigger";
}

function blockCreatesDataRead(block: AutomationBlock | undefined) {
  return block?.type === "fetch_data_source" || block?.type === "capture_camera";
}

function clippedPayloadPreview(payloadText: string, maxLines = 8) {
  const trimmed = payloadText.trim();
  if (!trimmed) return "{}";
  const lines = trimmed.split(/\r?\n/);
  return lines.length > maxLines ? [...lines.slice(0, maxLines - 1), "..."].join("\n") : trimmed;
}

/** Watch-mode overview: workflow state, selected run, and live-follow control. */
export function WatchRuntimeOverview({
  workflow,
  selectedRun,
  latestRun,
  hasValidationErrors,
}: {
  workflow: AutomationWorkflow;
  selectedRun: AutomationRun | undefined;
  latestRun: AutomationRun | undefined;
  hasValidationErrors: boolean;
}) {
  const viewingLatestRun = Boolean(selectedRun && latestRun && selectedRun.id === latestRun.id);
  const selectedRunLabel = selectedRun
    ? viewingLatestRun
      ? selectedRun.status === "running"
        ? "Following live run"
        : "Viewing latest run"
      : "Viewing historic run"
    : "No run selected";

  return (
    <WorkflowRailPanel className={formGridClass}>
      <WorkflowRailHeader
        title="Runtime overview"
        description="Monitor the current workflow state and choose whether live runs should take focus."
      />
      <div className="gap-detail-next grid">
        <RuntimeStat
          label="Workflow"
          value={<StatusPill status={workflow.archived || hasValidationErrors ? "warn" : workflow.enabled ? "good" : "neutral"}>{workflow.archived ? "Archived" : workflow.enabled ? "Active" : "Paused"}</StatusPill>}
        />
        <p className={`${mutedText} m-0`}>{workflowStateSummary(workflow, hasValidationErrors)}</p>
      </div>
      <div className="gap-detail-next grid">
        <RuntimeStat
          label="Selected run"
          value={<StatusPill status={statusTone(selectedRun?.status)}>{selectedRunLabel}</StatusPill>}
        />
        {selectedRun ? (
          <>
            <RuntimeStat label="Started" value={formatLocalTime(selectedRun.startedAt)} />
            <RuntimeStat label="Trigger" value={selectedRun.triggerType} />
            <RuntimeStat label="Progress" value={runProgressLabel(selectedRun)} />
            <RuntimeStat label="Duration" value={formatDuration(selectedRun.durationMs)} />
          </>
        ) : (
          <p className={`${mutedText} m-0`}>Run the workflow or choose a recent run below.</p>
        )}
        {selectedRun?.error ? <p className={`${errorText} m-0`}>{selectedRun.error}</p> : null}
      </div>
    </WorkflowRailPanel>
  );
}

export function WatchReplayControls({
  selectedRun,
  latestRun,
  followLiveRuns,
  message,
  stepCount,
  currentStepIndex,
  playing,
  onFollowLiveRunsChange,
  onPlayingChange,
  onSelectStep,
}: {
  selectedRun: AutomationRun | undefined;
  latestRun: AutomationRun | undefined;
  followLiveRuns: boolean;
  message: string;
  stepCount: number;
  currentStepIndex: number;
  playing: boolean;
  onFollowLiveRunsChange: (value: boolean) => void;
  onPlayingChange: (playing: boolean) => void;
  onSelectStep: (index: number) => void;
}) {
  const hasSteps = Boolean(selectedRun && stepCount > 0);
  const latestRunAvailable = Boolean(latestRun && selectedRun && latestRun.id !== selectedRun.id);
  return (
    <div className="relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-detail-next">
      <div className="gap-detail-next flex min-w-0 flex-wrap items-center">
        <strong className="type-callout text-text-primary w-20 shrink-0 truncate">Replay</strong>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="Previous step"
          disabled={!hasSteps || currentStepIndex <= 0}
          onClick={() => onSelectStep(Math.max(0, currentStepIndex - 1))}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          aria-label="Play"
          disabled={!hasSteps || playing}
          onClick={() => onPlayingChange(true)}
        >
          <Play aria-hidden className="size-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="Pause"
          disabled={!playing}
          onClick={() => onPlayingChange(false)}
        >
          <Pause aria-hidden className="size-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label="Next step"
          disabled={!hasSteps || currentStepIndex >= stepCount - 1}
          onClick={() => onSelectStep(currentStepIndex < 0 ? 0 : Math.min(stepCount - 1, currentStepIndex + 1))}
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        <label className="gap-detail-tight type-meta text-text-primary flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="cursor-pointer accent-current"
            checked={followLiveRuns}
            onChange={(event) => onFollowLiveRunsChange(event.currentTarget.checked)}
          />
          Follow latest run
        </label>
      </div>
      <p className="type-body-em text-text-primary m-0 min-w-0 truncate text-center @4xl:absolute @4xl:left-[calc(50%-180px)] @4xl:-translate-x-1/2 @4xl:w-max">{message}</p>
      <div className="min-w-0 justify-self-end">
        {latestRunAvailable && !followLiveRuns ? (
          <p className={`${mutedText} m-0 truncate`}>Latest run available. Turn on follow latest run to jump back.</p>
        ) : null}
      </div>
    </div>
  );
}

const WATCH_RUN_COLUMNS = [
  { id: "started", label: "Started" },
  { id: "trigger", label: "Trigger" },
  { id: "status", label: "Status" },
  { id: "duration", label: "Duration" },
  { id: "blocks", label: "Blocks" },
  { id: "details", label: "Details", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

const WATCH_RUN_SUMMARY_FIELDS = [
  { id: "status", label: "Status" },
  { id: "started", label: "Started" },
  { id: "trigger", label: "Trigger" },
  { id: "duration", label: "Duration" },
  { id: "blocks", label: "Blocks" },
  { id: "finished", label: "Finished", defaultVisible: false },
  { id: "runId", label: "Run ID", defaultVisible: false },
  { id: "error", label: "Error", defaultVisible: false },
] as const satisfies readonly TableColumnDefinition[];

/** Watch-mode rail: run now + test payload. */
export function WatchRunControls({
  workflow,
  busy,
  hasValidationErrors,
  payloadText,
  payloadError,
  onPayloadTextChange,
  onPayloadError,
  onResetPayload,
  onRunNow,
  onRunWithPayload,
}: {
  workflow: AutomationWorkflow;
  busy: boolean;
  hasValidationErrors: boolean;
  payloadText: string;
  payloadError: string | null;
  onPayloadTextChange: (value: string) => void;
  onPayloadError: (value: string | null) => void;
  onResetPayload: () => void;
  onRunNow: () => void;
  onRunWithPayload: (payload: unknown) => void;
}) {
  const eventTriggered = isEventTriggeredWorkflow(workflow);
  const triggerLabel = eventTriggerLabel(workflow);
  const payloadDisclosureTitle = eventTriggered ? `Test ${triggerLabel}` : "Test with custom payload";
  const payloadDescription = eventTriggered
    ? "This simulates the trigger for a manual test run. It does not fire the real external event."
    : "Use this when trigger-dependent blocks need specific payload data for a manual test run.";
  const payloadRunLabel = eventTriggered ? "Run with this payload" : "Run test payload";
  const [payloadModalOpen, setPayloadModalOpen] = useState(false);
  const [draftPayloadText, setDraftPayloadText] = useState(payloadText);
  const [draftPayloadError, setDraftPayloadError] = useState<string | null>(null);

  useEffect(() => {
    if (payloadModalOpen) setDraftPayloadText(payloadText);
  }, [payloadModalOpen, payloadText]);

  function openPayloadModal() {
    setDraftPayloadText(payloadText);
    setDraftPayloadError(null);
    setPayloadModalOpen(true);
  }

  function savePayloadDraft() {
    try {
      JSON.parse(draftPayloadText) as unknown;
      onPayloadTextChange(draftPayloadText);
      onPayloadError(null);
      setDraftPayloadError(null);
      setPayloadModalOpen(false);
    } catch (error) {
      setDraftPayloadError(error instanceof Error ? error.message : "Payload must be valid JSON");
    }
  }

  function runWithCurrentPayload() {
    try {
      onRunWithPayload(JSON.parse(payloadText) as unknown);
    } catch (error) {
      onPayloadError(error instanceof Error ? error.message : "Payload must be valid JSON");
      openPayloadModal();
    }
  }

  return (
    <WorkflowRailPanel className={formGridClass}>
      <WorkflowRailHeader
        title="Run controls"
        description={
          eventTriggered
            ? "Test this event-triggered workflow with simulated trigger payload data."
            : "Run this workflow or test it with a custom trigger payload."
        }
      />
      {workflow.archived && (
        <p className={mutedText}>
          Archived workflows cannot run until restored from the workflow list.
        </p>
      )}
      {hasValidationErrors && <p className={errorText}>Fix validation errors before running.</p>}
      {!eventTriggered ? (
        <>
          <Button
            type="button"
            size="sm"
            disabled={busy || hasValidationErrors || workflow.archived}
            onClick={onRunNow}
          >
            Run now
          </Button>
          <p className={`${mutedText} m-0`}>Runs this workflow immediately.</p>
        </>
      ) : null}
      <Disclosure
        title={payloadDisclosureTitle}
        defaultOpen={false}
        contentClassName="gap-detail-next"
      >
        <p className={`${mutedText} m-0`}>{payloadDescription}</p>
        <div className="gap-detail-tight grid">
          <div className="gap-detail-next flex items-center justify-between">
            <strong className="type-body-em text-text-primary">Payload preview</strong>
            <Button type="button" variant="secondary" size="xs" onClick={openPayloadModal}>
              Edit payload
            </Button>
          </div>
          <button
            type="button"
            className="border-stroke-secondary bg-surface-secondary type-meta text-text-primary hover:border-stroke-primary w-full cursor-pointer rounded-soft border p-detail-next text-left font-mono whitespace-pre-wrap transition-colors"
            onClick={openPayloadModal}
          >
            {clippedPayloadPreview(payloadText)}
          </button>
        </div>
        {payloadError && <p className={errorText}>{payloadError}</p>}
        <RowActions>
          <Button
            type="button"
            size="xs"
            disabled={busy || hasValidationErrors || workflow.archived}
            onClick={runWithCurrentPayload}
          >
            {payloadRunLabel}
          </Button>
        </RowActions>
      </Disclosure>
      {payloadModalOpen ? (
        <Modal
          title="Edit trigger payload"
          description={payloadDescription}
          width="wide"
          bodyScrollable={false}
          onClose={() => setPayloadModalOpen(false)}
          footer={
            <RowActions>
              <Button type="button" variant="secondary" onClick={() => setPayloadModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  onResetPayload();
                  setDraftPayloadText(payloadText);
                  setDraftPayloadError(null);
                }}
              >
                Reset example
              </Button>
              <Button type="button" onClick={savePayloadDraft}>
                Save payload
              </Button>
            </RowActions>
          }
        >
          <div className="gap-detail-next grid">
            <label className="gap-detail-tight grid">
              <span className="type-body-em text-text-primary">Trigger payload</span>
              <textarea
                className="border-stroke-secondary bg-surface-secondary rounded-soft min-h-[360px] border p-detail-next font-mono"
                value={draftPayloadText}
                onChange={(event) => {
                  setDraftPayloadText(event.target.value);
                  setDraftPayloadError(null);
                }}
              />
            </label>
            {draftPayloadError ? <p className={errorText}>{draftPayloadError}</p> : null}
          </div>
        </Modal>
      ) : null}
    </WorkflowRailPanel>
  );
}

function WatchRunCell({
  columnId,
  run,
  selectedRunId,
  onSelectRun,
  onOpenRaw,
}: {
  columnId: string;
  run: AutomationRun;
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onOpenRaw: () => void;
}) {
  if (columnId === "started") return <TableCell>{formatLocalTime(run.startedAt)}</TableCell>;
  if (columnId === "trigger") return <TableCell>{run.triggerType}</TableCell>;
  if (columnId === "status") {
    return (
      <TableCell>
        <StatusPill status={statusTone(run.status)}>
          {run.status}
        </StatusPill>
      </TableCell>
    );
  }
  if (columnId === "duration") return <TableCell>{formatDuration(run.durationMs)}</TableCell>;
  if (columnId === "blocks") {
    return (
      <TableCell>
        {run.blocks.filter((block) => block.status === "success").length}/{run.blockCount}
      </TableCell>
    );
  }
  if (columnId === "details") {
    return (
      <TableCell sticky>
        <RowActions>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            disabled={selectedRunId === run.id}
            onClick={() => onSelectRun(run.id)}
          >
            {selectedRunId === run.id ? "Showing" : "Show on canvas"}
          </Button>
          <Button type="button" variant="secondary" size="xs" onClick={onOpenRaw}>
            Raw details
          </Button>
        </RowActions>
      </TableCell>
    );
  }
  return null;
}

function successfulBlockCount(run: AutomationRun) {
  return run.blocks.filter((block) => block.status === "success").length;
}

function WatchRunSummaryCard({ fieldId, run }: { fieldId: string; run: AutomationRun }) {
  let value: ReactNode = "-";
  let valueClassName = "type-body-em text-text-primary";

  if (fieldId === "status") {
    value = <StatusPill status={statusTone(run.status)}>{run.status}</StatusPill>;
    valueClassName = "";
  } else if (fieldId === "started") value = formatLocalTime(run.startedAt);
  else if (fieldId === "finished") value = run.finishedAt ? formatLocalTime(run.finishedAt) : "Still running";
  else if (fieldId === "trigger") value = run.triggerType;
  else if (fieldId === "duration") value = formatDuration(run.durationMs);
  else if (fieldId === "blocks") value = `${successfulBlockCount(run)}/${run.blockCount}`;
  else if (fieldId === "runId") {
    value = run.id;
    valueClassName = "type-meta text-text-primary font-mono";
  } else if (fieldId === "error") {
    value = run.error ?? "No error";
    valueClassName = run.error ? "type-body-em text-text-error" : "type-body-em text-text-secondary";
  }

  const label = WATCH_RUN_SUMMARY_FIELDS.find((field) => field.id === fieldId)?.label ?? fieldId;

  return (
    <div className="border-stroke-secondary bg-surface-secondary gap-detail-fine grid min-w-0 rounded-soft border p-detail-next">
      <span className="type-meta text-text-secondary uppercase">{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}

function isPresentRunValue(value: unknown) {
  return value !== null && value !== undefined;
}

function shortRunValue(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value || "Empty string";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`;
  return String(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEmptyContextField(key: string, value: unknown) {
  if (value === null || value === undefined) return true;
  if (key === "stopped" && value === false) return true;
  if (isPlainRecord(value) && Object.keys(value).length === 0) return true;
  return false;
}

function meaningfulObjectEntries(value: Record<string, unknown>) {
  return Object.entries(value).filter(([key, entryValue]) => !isEmptyContextField(key, entryValue));
}

function shortRunFieldValue(key: string, value: unknown) {
  if (key === "trigger" && isPlainRecord(value)) {
    const type = typeof value.type === "string" ? value.type : "trigger";
    const payload = value.payload;
    return isPresentRunValue(payload) ? `${type} · payload ${shortRunValue(payload)}` : type;
  }
  if (key === "data" && isPlainRecord(value)) {
    if (typeof value.sourceName === "string") return value.sourceName;
    if (typeof value.readId === "string") return `Read ${value.readId}`;
    if (typeof value.hash === "string") return `Hash ${value.hash}`;
  }
  return shortRunValue(value);
}

function RunValueSummary({ value }: { value: unknown }) {
  if (!isPresentRunValue(value)) return null;
  if (Array.isArray(value)) {
    return (
      <div className="border-stroke-secondary bg-surface-secondary rounded-soft border p-detail-next">
        <span className="type-body-em text-text-primary">Array with {shortRunValue(value)}</span>
      </div>
    );
  }
  if (typeof value === "object") {
    const meaningfulEntries = meaningfulObjectEntries(value as Record<string, unknown>);
    const entries = meaningfulEntries.slice(0, 5);
    if (entries.length === 0) {
      return (
        <div className="border-stroke-secondary bg-surface-secondary rounded-soft border p-detail-next">
          <p className={`${mutedText} m-0`}>No meaningful context fields recorded.</p>
        </div>
      );
    }
    return (
      <div className="border-stroke-secondary bg-surface-secondary rounded-soft border p-detail-next">
        <dl className="gap-detail-tight grid m-0">
          {entries.map(([key, entryValue]) => (
            <div key={key} className="gap-detail-next grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <dt className="type-meta text-text-secondary truncate">{key}</dt>
              <dd className="type-meta text-text-primary m-0 truncate font-mono">{shortRunFieldValue(key, entryValue)}</dd>
            </div>
          ))}
        </dl>
        {meaningfulEntries.length > entries.length ? (
          <p className={`${mutedText} m-0 mt-detail-tight`}>More fields available in raw JSON.</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="border-stroke-secondary bg-surface-secondary rounded-soft border p-detail-next">
      <span className="type-body-em text-text-primary font-mono">{shortRunValue(value)}</span>
    </div>
  );
}

function contextRecord(value: unknown): Record<string, unknown> | null {
  return isPlainRecord(value) ? value : null;
}

function nestedOutput(value: unknown): Record<string, unknown> | null {
  const context = contextRecord(value);
  return context && isPlainRecord(context.output) ? context.output : null;
}

function SummaryRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <div className="border-stroke-secondary bg-surface-secondary rounded-soft border p-detail-next">
      <dl className="gap-detail-tight grid m-0">
        {rows.map((row) => (
          <div key={row.label} className="gap-detail-next grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <dt className="type-meta text-text-secondary truncate">{row.label}</dt>
            <dd className="type-meta text-text-primary m-0 truncate font-mono">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function inputContextValue(inputContext: Record<string, unknown> | null, source: string | undefined, path: string | undefined) {
  if (!inputContext) return undefined;
  if (source === "variable") return contextRecord(inputContext.variables)?.[String(path ?? "")];
  if (source === "data") return getPathValue(contextRecord(inputContext.data)?.result, path);
  return getPathValue(contextRecord(inputContext.trigger)?.payload, path);
}

function getPathValue(value: unknown, path: string | undefined) {
  if (!path?.trim()) return undefined;
  let current = value;
  for (const part of path.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.prototype.hasOwnProperty.call(current, part)
    ) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function variableSourceLabel(source: AutomationBlock["config"]["variableSource"]) {
  if (source === "trigger_field") return "Trigger field";
  if (source === "latest_data_field") return "Latest data field";
  if (source === "context_field") return "Workflow context field";
  return "Custom JSON";
}

function previewContentLabel(mode: AutomationBlock["config"]["contentMode"]) {
  if (mode === "workflow_context") return "Workflow context";
  if (mode === "trigger_payload") return "Trigger payload";
  if (mode === "latest_data") return "Latest data";
  return "Custom content";
}

function outputBodyLabel(mode: AutomationBlock["config"]["bodyMode"]) {
  if (mode === "custom") return "Custom JSON";
  if (mode === "trigger_payload") return "Trigger payload";
  if (mode === "latest_data") return "Latest data";
  if (mode === "latest_data_with_media") return "Latest data + media";
  if (mode === "multipart_media") return "Multipart media";
  if (mode === "none") return "No body";
  return "Workflow context";
}

function DomainBlockInputSummary({
  block,
  blockRun,
}: {
  block: AutomationBlock;
  blockRun: AutomationRun["blocks"][number];
}) {
  const inputContext = contextRecord(blockRun.input);
  const trigger = contextRecord(inputContext?.trigger);
  const data = contextRecord(inputContext?.data);

  if (block.type.endsWith("_start")) {
    return (
      <SummaryRows
        rows={[
          { label: "Input", value: "Received trigger" },
          { label: "Trigger", value: typeof trigger?.type === "string" ? trigger.type : blockRun.blockType },
          { label: "Source", value: typeof trigger?.sourceId === "string" ? trigger.sourceId : "No source" },
          { label: "Payload", value: isPresentRunValue(trigger?.payload) ? shortRunValue(trigger?.payload) : "No payload" },
        ]}
      />
    );
  }

  if (block.type === "record_trigger_event") {
    return (
      <SummaryRows
        rows={[
          { label: "Input", value: "Trigger payload" },
          { label: "Trigger", value: typeof trigger?.type === "string" ? trigger.type : "trigger" },
          { label: "Payload", value: isPresentRunValue(trigger?.payload) ? shortRunValue(trigger?.payload) : "No payload" },
        ]}
      />
    );
  }

  if (block.type === "fetch_data_source" || block.type === "capture_camera") {
    return (
      <SummaryRows
        rows={[
          { label: "Input", value: block.type === "capture_camera" ? "Camera source" : "Data source" },
          { label: "Source ID", value: block.config.sourceId ?? "Not selected" },
          { label: "Trigger", value: typeof trigger?.type === "string" ? trigger.type : "trigger" },
        ]}
      />
    );
  }

  if (block.type === "set_variable") {
    return (
      <SummaryRows
        rows={[
          { label: "Variable", value: block.config.variableName ?? "Unnamed" },
          { label: "Source", value: variableSourceLabel(block.config.variableSource) },
          { label: block.config.variableSource === "custom_json" ? "Configured value" : "Field", value: block.config.variableSource === "custom_json" ? shortRunValue(block.config.valueJsonText) : block.config.fieldPath ?? "Not set" },
        ]}
      />
    );
  }

  if (block.type === "if_payload_field_equals") {
    const source = block.config.source === "variable" ? "variable" : "trigger";
    const path = source === "variable" ? block.config.variableName : block.config.fieldPath;
    const actual = inputContextValue(inputContext, source, path);
    return (
      <SummaryRows
        rows={[
          { label: "Source", value: source === "variable" ? "Variable" : "Trigger payload" },
          { label: source === "variable" ? "Variable" : "Field", value: path ?? "Not set" },
          { label: "Expected", value: block.config.operator === "exists" || block.config.operator === "does_not_exist" ? block.config.operator : shortRunValue(block.config.value) },
          { label: "Actual", value: actual === undefined ? "Missing" : shortRunValue(actual) },
        ]}
      />
    );
  }

  if (block.type === "wait") {
    return <SummaryRows rows={[{ label: "Configured wait", value: formatDuration(Number(block.config.durationMs ?? 1000)) }]} />;
  }

  if (block.type === "show_preview") {
    return (
      <SummaryRows
        rows={[
          { label: "Content", value: previewContentLabel(block.config.contentMode) },
          { label: "Title", value: block.config.title ?? "Workflow preview" },
          { label: "Latest data", value: typeof data?.sourceName === "string" ? data.sourceName : "No data selected" },
        ]}
      />
    );
  }

  if (block.type === "stamp_integritas") {
    return (
      <SummaryRows
        rows={[
          { label: "Input", value: "Latest hash" },
          { label: "Hash", value: typeof inputContext?.hash === "string" ? inputContext.hash : "No hash" },
          { label: "Source", value: typeof data?.sourceName === "string" ? data.sourceName : "Workflow data" },
        ]}
      />
    );
  }

  if (block.type === "control_output") {
    return (
      <SummaryRows
        rows={[
          { label: "Target ID", value: block.config.targetId ?? "Not selected" },
          { label: "Action", value: block.config.action ?? "pulse" },
          { label: "Body", value: outputBodyLabel(block.config.bodyMode) },
        ]}
      />
    );
  }

  if (block.type === "send_transaction") {
    return (
      <SummaryRows
        rows={[
          { label: "Recipient ID", value: block.config.recipientAddressBookId ?? "Not selected" },
          { label: "Token", value: block.config.tokenId ?? "0x00" },
          { label: "Amount", value: block.config.amount ? `${block.config.amount} MINIMA` : "Not set" },
        ]}
      />
    );
  }

  return null;
}

function hasDomainBlockInput(block: AutomationBlock, blockRun: AutomationRun["blocks"][number]) {
  return Boolean(contextRecord(blockRun.input) && DomainInputBlockTypes.has(block.type));
}

const DomainInputBlockTypes = new Set<string>([
  "manual_start",
  "schedule_start",
  "gpio_event_start",
  "webhook_event_start",
  "mqtt_event_start",
  "record_trigger_event",
  "fetch_data_source",
  "capture_camera",
  "set_variable",
  "if_payload_field_equals",
  "wait",
  "show_preview",
  "stamp_integritas",
  "control_output",
  "send_transaction",
]);

function DomainBlockResultSummary({
  block,
  blockRun,
}: {
  block: AutomationBlock;
  blockRun: AutomationRun["blocks"][number];
}) {
  const outputContext = contextRecord(blockRun.output);
  const blockOutput = nestedOutput(blockRun.output);

  if (block.type.endsWith("_start") && outputContext) {
    const trigger = contextRecord(outputContext.trigger);
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: "Initialized run context" },
          { label: "Trigger", value: typeof trigger?.type === "string" ? trigger.type : blockRun.blockType },
          { label: "Data read", value: contextRecord(outputContext.data)?.readId ? "Available" : "Not created yet" },
          { label: "Variables", value: isPresentRunValue(outputContext.variables) ? shortRunValue(outputContext.variables) : "No variables" },
        ]}
      />
    );
  }

  if (block.type === "record_trigger_event" && outputContext) {
    const data = contextRecord(outputContext.data);
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: "Recorded trigger event" },
          { label: "Source", value: typeof data?.sourceName === "string" ? data.sourceName : "Trigger source" },
          { label: "Read", value: typeof data?.readId === "string" ? data.readId : "No read id" },
          { label: "Hash", value: typeof outputContext.hash === "string" ? outputContext.hash : "No hash" },
        ]}
      />
    );
  }

  if ((block.type === "fetch_data_source" || block.type === "capture_camera") && outputContext) {
    const data = contextRecord(outputContext.data);
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: block.type === "capture_camera" ? "Captured image" : "Fetched latest data" },
          { label: "Source", value: typeof data?.sourceName === "string" ? data.sourceName : "Unknown source" },
          { label: "Read", value: typeof data?.readId === "string" ? data.readId : "No read id" },
          { label: "Hash", value: typeof outputContext.hash === "string" ? outputContext.hash : "No hash" },
        ]}
      />
    );
  }

  if (block.type === "show_preview" && blockOutput) {
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: "Created preview" },
          { label: "Title", value: typeof blockOutput.title === "string" ? blockOutput.title : "Workflow preview" },
          { label: "Format", value: typeof blockOutput.format === "string" ? blockOutput.format : "Unknown" },
          { label: "Inbox item", value: typeof blockOutput.inboxItemId === "string" ? blockOutput.inboxItemId : "No inbox id" },
        ]}
      />
    );
  }

  if (block.type === "set_variable" && blockOutput) {
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: "Set variable" },
          { label: "Name", value: typeof blockOutput.name === "string" ? blockOutput.name : "Unnamed" },
          { label: "Value", value: shortRunValue(blockOutput.value) },
        ]}
      />
    );
  }

  if (block.type === "stamp_integritas" && outputContext) {
    const action = typeof blockOutput?.action === "string" ? blockOutput.action : blockRun.status;
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: action },
          { label: "Hash", value: typeof outputContext.hash === "string" ? outputContext.hash : "No hash" },
          { label: "Proof", value: typeof outputContext.proofId === "string" ? outputContext.proofId : "No proof" },
          { label: "Proof UID", value: typeof blockOutput?.proofUid === "string" ? blockOutput.proofUid : "No proof UID" },
        ]}
      />
    );
  }

  if (block.type === "if_payload_field_equals" && blockOutput) {
    const matched = blockOutput.matched === true;
    return (
      <SummaryRows
        rows={[
          { label: "Condition", value: matched ? "Matched" : "Did not match" },
          { label: "Field", value: typeof blockOutput.fieldPath === "string" ? blockOutput.fieldPath : "Unknown field" },
          { label: "Operator", value: typeof blockOutput.operator === "string" ? blockOutput.operator : "Unknown" },
          { label: "Action", value: typeof blockOutput.action === "string" ? blockOutput.action : matched ? "continued" : "stopped" },
        ]}
      />
    );
  }

  if (block.type === "wait") {
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: "Waited" },
          { label: "Configured", value: formatDuration(Number(block.config.durationMs ?? 1000)) },
          { label: "Actual", value: formatDuration(blockRun.durationMs) },
        ]}
      />
    );
  }

  if (block.type === "control_output" && blockOutput) {
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: typeof blockOutput.action === "string" ? blockOutput.action : "Sent output" },
          { label: "Result", value: shortRunValue(blockOutput) },
        ]}
      />
    );
  }

  if (block.type === "send_transaction" && blockOutput) {
    return (
      <SummaryRows
        rows={[
          { label: "Action", value: "Sent transaction" },
          { label: "Recipient", value: typeof blockOutput.recipientLabel === "string" ? blockOutput.recipientLabel : "Recipient" },
          { label: "Amount", value: typeof blockOutput.amount === "string" ? `${blockOutput.amount} MINIMA` : "Unknown amount" },
          { label: "TxPoW", value: typeof blockOutput.txpowId === "string" ? blockOutput.txpowId : "No TxPoW" },
        ]}
      />
    );
  }

  return null;
}

function hasDomainBlockResult(block: AutomationBlock, blockRun: AutomationRun["blocks"][number]) {
  if (block.type.endsWith("_start") && contextRecord(blockRun.output)) return true;
  if (block.type === "wait") return true;
  if (
    (block.type === "fetch_data_source" ||
      block.type === "capture_camera" ||
      block.type === "record_trigger_event") &&
    contextRecord(blockRun.output)
  ) return true;
  if (
    (block.type === "show_preview" ||
      block.type === "stamp_integritas" ||
      block.type === "if_payload_field_equals" ||
      block.type === "set_variable" ||
      block.type === "control_output" ||
      block.type === "send_transaction") &&
    nestedOutput(blockRun.output)
  ) return true;
  return false;
}

/** Watch-mode selected-block sheet: run/block status and output. */
export function WatchRuntimeInspector({
  selectedBlock,
  latestBlockRun,
  selectedRun,
  onCloseSelectedBlock,
}: {
  selectedBlock: AutomationBlock | undefined;
  latestBlockRun: AutomationRun["blocks"][number] | null;
  selectedRun: AutomationRun | undefined;
  onCloseSelectedBlock?: () => void;
}) {
  const readId = readIdFromOutput(latestBlockRun?.output);
  const proofId = proofIdFromOutput(latestBlockRun?.output);
  const showReadDiagnostics = Boolean(readId && blockCreatesDataRead(selectedBlock));
  const [readDetails, setReadDetails] = useState<DataSourceRead | null>(null);
  const [readDetailsLoading, setReadDetailsLoading] = useState(false);
  const [readDetailsError, setReadDetailsError] = useState<string | null>(null);
  const blockWasSkipped = latestBlockRun?.status === "skipped";
  const blockNotReached = Boolean(selectedBlock && selectedRun && !latestBlockRun);
  const blockStoppedBeforeRun = blockNotReached && selectedRun?.status === "failed";
  const blockRunStatus = latestBlockRun
    ? latestBlockRun.status
    : blockNotReached
      ? "Not reached"
    : selectedBlock?.lastRunAt
      ? "No run details"
      : "Not run yet";
  const blockRunTone =
    latestBlockRun?.status === "success"
      ? "good"
      : latestBlockRun?.status === "failed"
        ? "warn"
        : "neutral";
  const runTone =
    selectedRun?.status === "success"
      ? "good"
      : selectedRun?.status === "failed"
        ? "warn"
        : "neutral";
  const noBlockRunMessage = blockStoppedBeforeRun
    ? "The selected run stopped before this block could execute."
    : "This block was not reached in the selected run.";
  const skippedBlockMessage = "This block was skipped during the selected run.";

  return (
    <div className="gap-detail-close grid">
      <InspectorSection
        title="Run summary"
        description="The selected workflow run currently visualized on the canvas."
      >
        {selectedRun ? (
          <div className="gap-detail-next grid">
            <RuntimeStat
              label="Status"
              value={<StatusPill status={runTone}>{selectedRun.status}</StatusPill>}
            />
            <RuntimeStat label="Started" value={formatLocalTime(selectedRun.startedAt)} />
            <RuntimeStat label="Duration" value={formatDuration(selectedRun.durationMs)} />
            <RuntimeStat label="Trigger" value={selectedRun.triggerType} />
          </div>
        ) : (
          <p className={mutedText}>
            No run selected yet. Run the workflow or choose a historic run below.
          </p>
        )}
        {selectedRun?.error && <p className={errorText}>{selectedRun.error}</p>}
      </InspectorSection>
      <InspectorSection
        title="Block status"
        description="Latest stored status for the selected block in this run."
      >
        {!selectedBlock && (
          <p className={mutedText}>
            Select a block on the canvas to inspect its latest run output.
          </p>
        )}
        {selectedBlock && (
          <>
            <div className="gap-detail-next grid">
              <RuntimeStat label="Block" value={blockLabel(selectedBlock)} />
              <RuntimeStat
                label="Status"
                value={<StatusPill status={blockRunTone}>{blockRunStatus}</StatusPill>}
              />
              <RuntimeStat
                label="Duration"
                value={latestBlockRun ? formatDuration(latestBlockRun.durationMs) : "No timing"}
              />
            </div>
            {selectedBlock.lastError && <p className={errorText}>{selectedBlock.lastError}</p>}
            {latestBlockRun?.error && <p className={errorText}>{latestBlockRun.error}</p>}
          </>
        )}
      </InspectorSection>
      <InspectorSection
        title="Input"
        description="Data this block received during the selected run."
      >
        {blockWasSkipped ? (
          <p className={mutedText}>{skippedBlockMessage}</p>
        ) : blockNotReached ? (
          <p className={mutedText}>{noBlockRunMessage}</p>
        ) : selectedBlock && latestBlockRun && hasDomainBlockInput(selectedBlock, latestBlockRun) ? (
          <div className="gap-detail-next grid">
            <DomainBlockInputSummary block={selectedBlock} blockRun={latestBlockRun} />
            <JsonPreview
              value={latestBlockRun.input}
              label="View pre-block context"
              variant="button"
              className="w-full"
            />
          </div>
        ) : isPresentRunValue(latestBlockRun?.input) ? (
          <div className="gap-detail-next grid">
            <RunValueSummary value={latestBlockRun?.input} />
            <JsonPreview
              value={latestBlockRun?.input}
              label="View pre-block context"
              variant="button"
              className="w-full"
            />
          </div>
        ) : (
          <p className={mutedText}>No input recorded for the latest selected-block run.</p>
        )}
      </InspectorSection>
      <InspectorSection
        title="Result"
        description="Data this block produced during the selected run."
      >
        {blockWasSkipped ? (
          <p className={mutedText}>{skippedBlockMessage}</p>
        ) : blockNotReached ? (
          <p className={mutedText}>{noBlockRunMessage}</p>
        ) : selectedBlock && latestBlockRun && hasDomainBlockResult(selectedBlock, latestBlockRun) ? (
          <div className="gap-detail-next grid">
            <DomainBlockResultSummary block={selectedBlock} blockRun={latestBlockRun} />
            <JsonPreview
              value={latestBlockRun.output}
              label="View post-block context"
              variant="button"
              className="w-full"
            />
          </div>
        ) : isPresentRunValue(latestBlockRun?.output) ? (
          <div className="gap-detail-next grid">
            <RunValueSummary value={latestBlockRun?.output} />
            <JsonPreview
              value={latestBlockRun?.output}
              label="View post-block context"
              variant="button"
              className="w-full"
            />
          </div>
        ) : (
          <p className={mutedText}>No result recorded for the latest selected-block run.</p>
        )}
      </InspectorSection>
      {(showReadDiagnostics || proofId || onCloseSelectedBlock) && (
        <InspectorSection title="Diagnostics">
          {readDetailsError ? <p className={errorText}>{readDetailsError}</p> : null}
          <RowActions>
            {showReadDiagnostics && readId && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={readDetailsLoading}
                onClick={() => {
                  setReadDetailsLoading(true);
                  setReadDetailsError(null);
                  getDataSourceRead(readId)
                    .then((response) => setReadDetails(response.item))
                    .catch((error: Error) => setReadDetailsError(error.message))
                    .finally(() => setReadDetailsLoading(false));
                }}
              >
                {readDetailsLoading ? "Opening read..." : "Open read"}
              </Button>
            )}
            {showReadDiagnostics && readId && (
              <Link
                className="type-meta rounded-loose bg-surface-secondary px-detail-close text-text-primary hover:border-stroke-primary inline-flex h-8 items-center border border-transparent no-underline"
                to={diagnosticsLink("reads", readId)}
              >
                Open in diagnostics
              </Link>
            )}
            {proofId && (
              <Link
                className="type-meta rounded-loose bg-surface-secondary px-detail-close text-text-primary hover:border-stroke-primary inline-flex h-8 items-center border border-transparent no-underline"
                to={diagnosticsLink("proofs", proofId)}
              >
                Open proof
              </Link>
            )}
            {onCloseSelectedBlock && (
              <Button type="button" variant="secondary" size="sm" onClick={onCloseSelectedBlock}>
                Close inspector
              </Button>
            )}
          </RowActions>
        </InspectorSection>
      )}
      {readDetails ? (
        <ReadDetailsModal item={readDetails} onClose={() => setReadDetails(null)} />
      ) : null}
    </div>
  );
}

/** Watch-mode bottom panel: historic runs table + raw JSON diagnostics. */
export function WatchRunHistory({
  runs,
  selectedRunId,
  replayPlaying = false,
  onSelectRun,
}: {
  runs: AutomationRun[];
  selectedRunId: string | null;
  replayPlaying?: boolean;
  onSelectRun: (runId: string) => void;
}) {
  const [rawRunId, setRawRunId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0];
  const selectedRunIndex = selectedRun ? runs.findIndex((run) => run.id === selectedRun.id) : -1;
  const newerRun = selectedRunIndex > 0 ? runs[selectedRunIndex - 1] : undefined;
  const olderRun = selectedRunIndex >= 0 && selectedRunIndex < runs.length - 1 ? runs[selectedRunIndex + 1] : undefined;
  const rawRunForModal = runs.find((run) => run.id === rawRunId);
  const { visibility, columnOrder, setVisibility, setColumnOrder } = useTableColumnVisibility(
    "workflow-watch-runs",
    WATCH_RUN_COLUMNS,
  );
  const {
    visibility: summaryVisibility,
    columnOrder: summaryColumnOrder,
    setVisibility: setSummaryVisibility,
    setColumnOrder: setSummaryColumnOrder,
  } = useTableColumnVisibility("workflow-watch-run-summary", WATCH_RUN_SUMMARY_FIELDS);
  const visibleColumns = orderedColumns(WATCH_RUN_COLUMNS, columnOrder).filter(
    (column) => visibility[column.id],
  );
  const visibleSummaryFields = orderedColumns(WATCH_RUN_SUMMARY_FIELDS, summaryColumnOrder).filter(
    (field) => summaryVisibility[field.id],
  );

  return (
    <Panel>
      <div className={statusRowClass}>
        <div>
          <strong>{expanded ? "Historic runs" : "Selected run"}</strong>
          <p className={mutedText}>
            {expanded
              ? "Choose a run to visualize on the canvas, or open raw JSON for diagnostics."
              : "Use older/newer to step through recent runs, or expand history to browse the table."}
          </p>
        </div>
        <div className="gap-detail-next flex shrink-0 items-center justify-end">
          <StatusPill status="neutral">{runs.length} run(s)</StatusPill>
          {expanded ? (
            <TableColumnVisibilityButton
              tableLabel="Historic runs"
              columns={WATCH_RUN_COLUMNS}
              visibility={visibility}
              columnOrder={columnOrder}
              onChange={setVisibility}
              onOrderChange={setColumnOrder}
            />
          ) : runs.length > 0 ? (
            <TableColumnVisibilityButton
              tableLabel="Selected run summary"
              controlLabel="Choose fields for Selected run summary"
              description="Choose which summary fields are shown. At least one field must remain visible."
              columns={WATCH_RUN_SUMMARY_FIELDS}
              visibility={summaryVisibility}
              columnOrder={summaryColumnOrder}
              onChange={setSummaryVisibility}
              onOrderChange={setSummaryColumnOrder}
            />
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="xs"
            iconStart={expanded ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Collapse" : "Expand history"}
          </Button>
        </div>
      </div>
      {runs.length === 0 ? (
        <p className={mutedText}>No workflow runs recorded yet.</p>
      ) : expanded ? (
        <div className="grid gap-2" data-testid="expanded-run-history">
          <ScrollArea className="rounded-soft border-stroke-secondary bg-surface-always-white max-h-[50vh] border">
            <TableWrap>
              <DataTable>
                <TableHead>
                  {visibleColumns.map((column) => (
                    <TableHeaderCell key={column.id} sticky={column.id === "details"}>{column.label}</TableHeaderCell>
                  ))}
                </TableHead>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      {visibleColumns.map((column) => (
                        <WatchRunCell
                          key={column.id}
                          columnId={column.id}
                          run={run}
                          selectedRunId={selectedRunId}
                          onSelectRun={onSelectRun}
                          onOpenRaw={() => setRawRunId(run.id)}
                        />
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrap>
          </ScrollArea>
        </div>
      ) : (
        <div
          className="rounded-soft border-stroke-secondary bg-surface-always-white relative grid gap-detail-next border p-detail-close"
          data-testid="collapsed-run-history"
        >
          <div className="gap-detail-next flex flex-wrap items-center justify-between">
            <div className="gap-detail-next flex flex-wrap items-center">
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={!olderRun}
                iconStart={<ChevronLeft aria-hidden />}
                onClick={() => olderRun && onSelectRun(olderRun.id)}
              >
                Older run
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                disabled={!newerRun}
                iconStart={<ChevronRight aria-hidden />}
                onClick={() => newerRun && onSelectRun(newerRun.id)}
              >
                Newer run
              </Button>
              {selectedRunIndex >= 0 ? (
                <span className="type-meta text-text-secondary">
                  Run {selectedRunIndex + 1} of {runs.length}
                </span>
              ) : null}
            </div>
            {selectedRun ? (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => setRawRunId(selectedRun.id)}
              >
                Raw details
              </Button>
            ) : null}
          </div>
          {selectedRun ? (
            <div className="grid gap-detail-next [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
              {visibleSummaryFields.map((field) => (
                <WatchRunSummaryCard key={field.id} fieldId={field.id} run={selectedRun} />
              ))}
            </div>
          ) : null}
        </div>
      )}
      {rawRunForModal ? (
        <Modal
          title="Raw workflow run JSON"
          description="Full stored run payload for diagnostics."
          width="wide"
          onClose={() => setRawRunId(null)}
        >
          <JsonPreviewContent value={rawRunForModal} />
        </Modal>
      ) : null}
    </Panel>
  );
}
