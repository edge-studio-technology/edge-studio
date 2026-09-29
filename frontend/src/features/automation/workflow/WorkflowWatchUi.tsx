import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/Button";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
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
import { JsonPreview } from "../../../components/JsonPreview";
import { Disclosure } from "../../../components/ui/Disclosure";
import {
  orderedColumns,
  TableColumnVisibilityButton,
  type TableColumnDefinition,
} from "../../../components/patterns/TableColumnVisibility";
import { ScrollArea } from "../../../components/ui/ScrollArea";
import { SwitchField } from "../../../components/ui/SwitchField";
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

/** Watch-mode overview: workflow state, selected run, and live-follow control. */
export function WatchRuntimeOverview({
  workflow,
  selectedRun,
  latestRun,
  followLiveRuns,
  hasValidationErrors,
  onFollowLiveRunsChange,
}: {
  workflow: AutomationWorkflow;
  selectedRun: AutomationRun | undefined;
  latestRun: AutomationRun | undefined;
  followLiveRuns: boolean;
  hasValidationErrors: boolean;
  onFollowLiveRunsChange: (value: boolean) => void;
}) {
  const viewingLatestRun = Boolean(selectedRun && latestRun && selectedRun.id === latestRun.id);
  const latestRunAvailable = Boolean(latestRun && selectedRun && latestRun.id !== selectedRun.id);
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
      <SwitchField
        label="Follow live runs"
        description="When enabled, the canvas follows the newest run automatically. Turn it off while inspecting history."
        checked={followLiveRuns}
        onChange={(event) => onFollowLiveRunsChange(event.currentTarget.checked)}
      />
      {latestRunAvailable && !followLiveRuns ? (
        <p className={`${mutedText} m-0`}>Latest run available. Turn on follow live runs to jump back.</p>
      ) : null}
    </WorkflowRailPanel>
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
  const payloadRunLabel = eventTriggered ? "Test with this payload" : "Run test payload";

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
        defaultOpen={eventTriggered}
        contentClassName="gap-detail-next"
      >
        <p className={`${mutedText} m-0`}>{payloadDescription}</p>
        <label>
          Trigger payload
          <textarea
            rows={8}
            value={payloadText}
            onChange={(event) => onPayloadTextChange(event.target.value)}
          />
        </label>
        {payloadError && <p className={errorText}>{payloadError}</p>}
        <RowActions>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            disabled={busy}
            onClick={onResetPayload}
          >
            Reset example
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={busy || hasValidationErrors || workflow.archived}
            onClick={() => {
              try {
                onRunWithPayload(JSON.parse(payloadText) as unknown);
              } catch (error) {
                onPayloadError(error instanceof Error ? error.message : "Payload must be valid JSON");
              }
            }}
          >
            {payloadRunLabel}
          </Button>
        </RowActions>
      </Disclosure>
    </WorkflowRailPanel>
  );
}

function WatchRunCell({
  columnId,
  run,
  selectedRunId,
  rawRunId,
  onSelectRun,
  onToggleRaw,
}: {
  columnId: string;
  run: AutomationRun;
  selectedRunId: string | null;
  rawRunId: string | null;
  onSelectRun: (runId: string) => void;
  onToggleRaw: () => void;
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
          <Button type="button" variant="secondary" size="xs" onClick={onToggleRaw}>
            {rawRunId === run.id ? "Hide raw" : "Raw details"}
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
  const blockRunStatus = latestBlockRun
    ? latestBlockRun.status
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
        title="Output"
        description="Payload saved by this block during the selected run."
      >
        {latestBlockRun?.output !== null && latestBlockRun?.output !== undefined ? (
          <JsonPreview
            value={latestBlockRun.output}
            label="View output JSON"
            variant="button"
            className="w-full"
          />
        ) : (
          <p className={mutedText}>No output recorded for the latest selected-block run.</p>
        )}
      </InspectorSection>
      {(readId || proofId || onCloseSelectedBlock) && (
        <InspectorSection title="Diagnostics">
          <RowActions>
            {readId && (
              <Link
                className="type-meta rounded-loose bg-surface-secondary px-detail-close text-text-primary hover:border-stroke-primary inline-flex h-8 items-center border border-transparent no-underline"
                to={diagnosticsLink("reads", readId)}
              >
                Open read
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
    </div>
  );
}

/** Watch-mode bottom panel: historic runs table + raw JSON. */
export function WatchRunHistory({
  runs,
  selectedRunId,
  onSelectRun,
}: {
  runs: AutomationRun[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}) {
  const [rawRunId, setRawRunId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0];
  const selectedRunIndex = selectedRun ? runs.findIndex((run) => run.id === selectedRun.id) : -1;
  const newerRun = selectedRunIndex > 0 ? runs[selectedRunIndex - 1] : undefined;
  const olderRun = selectedRunIndex >= 0 && selectedRunIndex < runs.length - 1 ? runs[selectedRunIndex + 1] : undefined;
  const rawRun = runs.find((run) => run.id === rawRunId);
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
              ? "Choose a run to visualize on the canvas, or expand raw JSON for diagnostics."
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
                          rawRunId={rawRunId}
                          onSelectRun={onSelectRun}
                          onToggleRaw={() => setRawRunId(rawRunId === run.id ? null : run.id)}
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
        <div className="rounded-soft border-stroke-secondary bg-surface-always-white grid gap-detail-next border p-detail-close" data-testid="collapsed-run-history">
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
                onClick={() => setRawRunId(rawRunId === selectedRun.id ? null : selectedRun.id)}
              >
                {rawRunId === selectedRun.id ? "Hide raw" : "Raw details"}
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
      {rawRun && (
        <Panel>
          <div className={statusRowClass}>
            <div>
              <strong>Raw workflow run JSON</strong>
              <p className={mutedText}>Full stored run payload for diagnostics.</p>
            </div>
            <StatusPill status={statusTone(rawRun.status)}>
              {rawRun.status}
            </StatusPill>
          </div>
          <JsonPreview value={rawRun} />
        </Panel>
      )}
    </Panel>
  );
}
