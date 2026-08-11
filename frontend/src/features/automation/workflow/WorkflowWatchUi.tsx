import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/Button";
import {
  DataTable,
  RowActions,
  TableWrap,
  tableCellClass,
  tableHeaderCellClass,
  tableHeadRowClass,
  tableRowClass,
} from "../../../components/DataTable";
import { JsonPreview } from "../../../components/JsonPreview";
import { ScrollArea } from "../../../components/ui/ScrollArea";
import { formatLocalTime } from "../../../lib/time";
import type {
  AutomationBlock,
  AutomationRun,
  AutomationWorkflow,
} from "../automationTypes";
import { WorkflowRailHeader, WorkflowRailPanel } from "./canvas";
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
  return (
    <WorkflowRailPanel className={formGridClass}>
      <WorkflowRailHeader
        title="Run controls"
        description="Run this workflow or test it with a manual trigger payload."
      />
      {workflow.archived && (
        <p className={mutedText}>
          Archived workflows cannot run until restored from the workflow list.
        </p>
      )}
      {hasValidationErrors && <p className={errorText}>Fix validation errors before running.</p>}
      <Button
        type="button"
        size="sm"
        disabled={busy || hasValidationErrors || workflow.archived}
        onClick={onRunNow}
      >
        Run now
      </Button>
      <div className="gap-detail-next grid">
        <strong className="type-body-em text-text-primary">Test payload</strong>
        <p className={mutedText}>This payload is used only for a manual test run.</p>
      </div>
      <label>
        Trigger payload
        <textarea
          rows={12}
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
          Run with payload
        </Button>
      </RowActions>
    </WorkflowRailPanel>
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
  const rawRun = runs.find((run) => run.id === rawRunId);

  return (
    <Panel>
      <div className={statusRowClass}>
        <div>
          <strong>Historic runs</strong>
          <p className={mutedText}>
            Choose a run to visualize on the canvas, or expand raw JSON for diagnostics.
          </p>
        </div>
        <StatusPill status="neutral">{runs.length} run(s)</StatusPill>
      </div>
      {runs.length === 0 ? (
        <p className={mutedText}>No workflow runs recorded yet.</p>
      ) : (
        <ScrollArea className="rounded-soft border-stroke-secondary bg-surface-always-white max-h-[150px] border">
          <TableWrap>
            <DataTable>
              <thead>
                <tr className={tableHeadRowClass}>
                  <th className={tableHeaderCellClass}>Started</th>
                  <th className={tableHeaderCellClass}>Trigger</th>
                  <th className={tableHeaderCellClass}>Status</th>
                  <th className={tableHeaderCellClass}>Duration</th>
                  <th className={tableHeaderCellClass}>Blocks</th>
                  <th className={tableHeaderCellClass}>Details</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className={tableRowClass}>
                    <td className={tableCellClass}>{formatLocalTime(run.startedAt)}</td>
                    <td className={tableCellClass}>{run.triggerType}</td>
                    <td className={tableCellClass}>
                      <StatusPill
                        status={
                          run.status === "success"
                            ? "good"
                            : run.status === "failed"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {run.status}
                      </StatusPill>
                    </td>
                    <td className={tableCellClass}>{formatDuration(run.durationMs)}</td>
                    <td className={tableCellClass}>
                      {run.blocks.filter((block) => block.status === "success").length}/
                      {run.blockCount}
                    </td>
                    <td className={tableCellClass}>
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
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={() => setRawRunId(rawRunId === run.id ? null : run.id)}
                        >
                          {rawRunId === run.id ? "Hide raw" : "Raw details"}
                        </Button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        </ScrollArea>
      )}
      {rawRun && (
        <Panel>
          <div className={statusRowClass}>
            <div>
              <strong>Raw workflow run JSON</strong>
              <p className={mutedText}>Full stored run payload for diagnostics.</p>
            </div>
            <StatusPill
              status={
                rawRun.status === "success"
                  ? "good"
                  : rawRun.status === "failed"
                    ? "warn"
                    : "neutral"
              }
            >
              {rawRun.status}
            </StatusPill>
          </div>
          <JsonPreview value={rawRun} />
        </Panel>
      )}
    </Panel>
  );
}
