import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Inbox } from "lucide-react";
import {
  DataTable,
  RowActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableIconButton,
  TableIconMenu,
  TableRow,
  TableWrap,
} from "../../components/patterns/DataTable";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { LoadingState } from "../../components/patterns/LoadingState";
import {
  TableColumnVisibilityButton,
  type TableColumnDefinition,
  type TableColumnVisibility,
} from "../../components/patterns/TableColumnVisibility";
import { TableControls } from "../../components/patterns/TableControls";
import { Pill } from "../../components/ui/Pill";
import { formatLocalDateTime } from "../../lib/time";
import { useTableColumnVisibility } from "../preferences/useTableColumnVisibility";
import { AutomationRunInspectModal } from "./AutomationRunInspectModal";
import { formatRunDuration, RUN_STATUS } from "./automationRunDisplay";
import type { AutomationRun } from "./automationTypes";

export const WORKFLOW_RUN_COLUMNS = [
  { id: "started", label: "Started" },
  { id: "workflow", label: "Workflow" },
  { id: "trigger", label: "Trigger" },
  { id: "status", label: "Status" },
  { id: "duration", label: "Duration" },
  { id: "blocks", label: "Blocks" },
  { id: "finished", label: "Finished", defaultVisible: false },
  { id: "triggerSource", label: "Trigger source", defaultVisible: false },
  { id: "error", label: "Error", defaultVisible: false },
  { id: "runId", label: "Run ID", defaultVisible: false },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

export function AutomationRunsTable({
  runs,
  compact = false,
  filtered = false,
  loading = false,
  onClearFilters,
  columnVisibility,
  onColumnVisibilityChange,
  showColumnControls = true,
}: {
  runs: AutomationRun[];
  compact?: boolean;
  filtered?: boolean;
  loading?: boolean;
  onClearFilters?: () => void;
  columnVisibility?: TableColumnVisibility;
  onColumnVisibilityChange?: (next: TableColumnVisibility) => void;
  showColumnControls?: boolean;
}) {
  const [inspectRunId, setInspectRunId] = useState<string | null>(null);
  const inspectRun = inspectRunId ? (runs.find((run) => run.id === inspectRunId) ?? null) : null;
  const columns = compact
    ? WORKFLOW_RUN_COLUMNS.filter((column) => column.id !== "workflow")
    : WORKFLOW_RUN_COLUMNS;
  const internalColumns = useTableColumnVisibility(
    compact ? "workflow-runs-compact" : "workflow-runs",
    columns,
  );
  const visibility = columnVisibility ?? internalColumns.visibility;
  const setVisibility = onColumnVisibilityChange ?? internalColumns.setVisibility;
  const visibleColumnCount = columns.filter((column) => visibility[column.id]).length;

  const controls = showColumnControls ? (
    <TableControls
      utilities={
        <TableColumnVisibilityButton
          tableLabel={compact ? "Workflow runs" : "Workflow logs"}
          columns={columns}
          visibility={visibility}
          onChange={setVisibility}
        />
      }
    />
  ) : null;

  if (loading)
    return (
      <>
        {controls}
        <LoadingState
          title="Fetching your workflow runs"
          description="This should take a few seconds."
        />
      </>
    );

  if (runs.length === 0)
    return (
      <>
        {controls}
        <EmptyContentState
          icon={Inbox}
          title={filtered ? "No matching workflow runs" : "No workflow runs yet"}
          description={
            filtered
              ? "Try another status or search, or clear filters."
              : "Runs from your workflows will be added to your history here."
          }
          actionLabel={filtered && onClearFilters ? "Clear filters" : undefined}
          actionVariant="secondary"
          onAction={filtered ? onClearFilters : undefined}
        />
      </>
    );

  return (
    <>
      {controls}
      <TableWrap>
        <DataTable
          aria-label="Workflow logs"
          className={visibleColumnCount > 3 ? "min-w-245" : undefined}
        >
          <TableHead>
            {visibility.started && (
              <TableHeaderCell className="whitespace-nowrap">Started</TableHeaderCell>
            )}
            {!compact && visibility.workflow && <TableHeaderCell>Workflow</TableHeaderCell>}
            {visibility.trigger && <TableHeaderCell>Trigger</TableHeaderCell>}
            {visibility.status && <TableHeaderCell>Status</TableHeaderCell>}
            {visibility.duration && <TableHeaderCell>Duration</TableHeaderCell>}
            {visibility.blocks && <TableHeaderCell>Blocks</TableHeaderCell>}
            {visibility.finished && <TableHeaderCell>Finished</TableHeaderCell>}
            {visibility.triggerSource && <TableHeaderCell>Trigger source</TableHeaderCell>}
            {visibility.error && <TableHeaderCell>Error</TableHeaderCell>}
            {visibility.runId && <TableHeaderCell>Run ID</TableHeaderCell>}
            {visibility.actions && (
              <TableHeaderCell className="w-px whitespace-nowrap">Actions</TableHeaderCell>
            )}
          </TableHead>
          <TableBody>
            {runs.map((run) => {
              const status = RUN_STATUS[run.status];
              const successBlocks = run.blocks.filter((block) => block.status === "success").length;
              return (
                <TableRow key={run.id}>
                  {visibility.started && (
                    <TableCell className="whitespace-nowrap">
                      <time className="text-text-secondary type-meta" dateTime={run.startedAt}>
                        {formatLocalDateTime(run.startedAt)}
                      </time>
                    </TableCell>
                  )}
                  {!compact && visibility.workflow && (
                    <TableCell className="max-w-56 min-w-0">
                      <span className="type-body-em text-text-primary block truncate">
                        {run.workflowName}
                      </span>
                    </TableCell>
                  )}
                  {visibility.trigger && (
                    <TableCell>
                      <Pill>{run.triggerType}</Pill>
                    </TableCell>
                  )}
                  {visibility.status && (
                    <TableCell>
                      <Pill tone={status.tone} indicator>
                        {status.label}
                      </Pill>
                    </TableCell>
                  )}
                  {visibility.duration && (
                    <TableCell className="whitespace-nowrap">
                      {formatRunDuration(run.durationMs)}
                    </TableCell>
                  )}
                  {visibility.blocks && (
                    <TableCell className="whitespace-nowrap">
                      {successBlocks}/{run.blockCount}
                    </TableCell>
                  )}
                  {visibility.finished && (
                    <TableCell className="whitespace-nowrap">
                      {run.finishedAt ? (
                        <time className="text-text-secondary type-meta" dateTime={run.finishedAt}>
                          {formatLocalDateTime(run.finishedAt)}
                        </time>
                      ) : (
                        <span className="text-text-secondary">Running</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.triggerSource && (
                    <TableCell className="max-w-44 min-w-0">
                      {run.triggerSourceId ? (
                        <code className="type-mono block truncate" title={run.triggerSourceId}>
                          {run.triggerSourceId}
                        </code>
                      ) : (
                        <span className="text-text-secondary">None</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.error && (
                    <TableCell className="max-w-64 min-w-0">
                      {run.error ? (
                        <span className="text-text-error block truncate" title={run.error}>
                          {run.error}
                        </span>
                      ) : (
                        <span className="text-text-secondary">None</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.runId && (
                    <TableCell className="max-w-44 min-w-0">
                      <code className="type-mono block truncate" title={run.id}>
                        {run.id}
                      </code>
                    </TableCell>
                  )}
                  {visibility.actions && (
                    <TableCell className="w-px whitespace-nowrap">
                      <RunRowActions run={run} onView={() => setInspectRunId(run.id)} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </DataTable>
      </TableWrap>

      {inspectRun ? (
        <AutomationRunInspectModal run={inspectRun} onClose={() => setInspectRunId(null)} />
      ) : null}
    </>
  );
}

function RunRowActions({ run, onView }: { run: AutomationRun; onView: () => void }) {
  const navigate = useNavigate();
  const label = run.workflowName;

  return (
    <RowActions>
      <TableIconButton
        type="button"
        title="View details"
        aria-label={`View details for ${label}`}
        onClick={onView}
      >
        <Eye size={16} aria-hidden />
      </TableIconButton>
      {/* <TableIconMenu
        aria-label={`More actions for ${label}`}
        items={[
          {
            label: "Show on canvas",
            disabled: !run.workflowId,
            title: run.workflowId ? undefined : "Workflow was deleted",
            onClick: () => {
              if (!run.workflowId) return;
              navigate(
                `/workflows/${encodeURIComponent(run.workflowId)}/watch/${encodeURIComponent(run.id)}`,
              );
            },
          },
        ]}
      /> */}
    </RowActions>
  );
}
