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
  orderedColumns,
  TableColumnVisibilityButton,
  type TableColumnDefinition,
  type TableColumnFilters,
  type TableColumnOrder,
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
  { id: "workflow", label: "Workflow", filterable: true },
  { id: "trigger", label: "Trigger", filterable: true },
  { id: "status", label: "Status" },
  { id: "duration", label: "Duration" },
  { id: "blocks", label: "Blocks" },
  { id: "finished", label: "Finished", defaultVisible: false },
  { id: "triggerSource", label: "Trigger source", defaultVisible: false, filterable: true },
  { id: "error", label: "Error", defaultVisible: false, filterable: true },
  { id: "runId", label: "Run ID", defaultVisible: false, filterable: true },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

export function AutomationRunsTable({
  runs,
  compact = false,
  filtered = false,
  loading = false,
  onClearFilters,
  columnVisibility,
  columnOrder: controlledColumnOrder,
  columnFilters: controlledColumnFilters,
  onColumnVisibilityChange,
  onColumnOrderChange,
  onColumnFiltersChange,
  showColumnControls = true,
}: {
  runs: AutomationRun[];
  compact?: boolean;
  filtered?: boolean;
  loading?: boolean;
  onClearFilters?: () => void;
  columnVisibility?: TableColumnVisibility;
  columnOrder?: TableColumnOrder;
  columnFilters?: TableColumnFilters;
  onColumnVisibilityChange?: (next: TableColumnVisibility) => void;
  onColumnOrderChange?: (next: TableColumnOrder) => void;
  onColumnFiltersChange?: (next: TableColumnFilters) => void;
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
  const columnOrder = controlledColumnOrder ?? internalColumns.columnOrder;
  const setColumnOrder = onColumnOrderChange ?? internalColumns.setColumnOrder;
  const filters = controlledColumnFilters ?? internalColumns.filters;
  const setFilters = onColumnFiltersChange ?? internalColumns.setFilters;
  const visibleColumns = orderedColumns(columns, columnOrder).filter((column) => visibility[column.id]);
  const visibleColumnCount = visibleColumns.length;

  const controls = showColumnControls ? (
    <TableControls
      utilities={
        <TableColumnVisibilityButton
          tableLabel={compact ? "Workflow runs" : "Workflow logs"}
          columns={columns}
          visibility={visibility}
          columnOrder={columnOrder}
          filters={filters}
          onChange={setVisibility}
          onOrderChange={setColumnOrder}
          onFiltersChange={setFilters}
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
            {visibleColumns.map((column) => (
              <TableHeaderCell
                key={column.id}
                sticky={column.id === "actions"}
                className={column.id === "actions" ? "w-px whitespace-nowrap" : undefined}
              >
                {column.label}
              </TableHeaderCell>
            ))}
          </TableHead>
          <TableBody>
            {runs.map((run) => {
              const status = RUN_STATUS[run.status];
              const successBlocks = run.blocks.filter((block) => block.status === "success").length;
              return (
                <TableRow key={run.id}>
                  {visibleColumns.map((column) => (
                    <WorkflowRunCell
                      key={column.id}
                      columnId={column.id}
                      run={run}
                      status={status}
                      successBlocks={successBlocks}
                      onView={() => setInspectRunId(run.id)}
                    />
                  ))}
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

function WorkflowRunCell({
  columnId,
  run,
  status,
  successBlocks,
  onView,
}: {
  columnId: string;
  run: AutomationRun;
  status: (typeof RUN_STATUS)[AutomationRun["status"]];
  successBlocks: number;
  onView: () => void;
}) {
  if (columnId === "started") {
    return (
      <TableCell className="whitespace-nowrap">
        <time className="text-text-secondary type-meta" dateTime={run.startedAt}>
          {formatLocalDateTime(run.startedAt)}
        </time>
      </TableCell>
    );
  }
  if (columnId === "workflow") {
    return (
      <TableCell className="max-w-56 min-w-0">
        <span className="type-body-em text-text-primary block truncate">{run.workflowName}</span>
      </TableCell>
    );
  }
  if (columnId === "trigger") {
    return (
      <TableCell>
        <Pill>{run.triggerType}</Pill>
      </TableCell>
    );
  }
  if (columnId === "status") {
    return (
      <TableCell>
        <Pill tone={status.tone} indicator>
          {status.label}
        </Pill>
      </TableCell>
    );
  }
  if (columnId === "duration") return <TableCell className="whitespace-nowrap">{formatRunDuration(run.durationMs)}</TableCell>;
  if (columnId === "blocks") return <TableCell className="whitespace-nowrap">{successBlocks}/{run.blockCount}</TableCell>;
  if (columnId === "finished") {
    return (
      <TableCell className="whitespace-nowrap">
        {run.finishedAt ? (
          <time className="text-text-secondary type-meta" dateTime={run.finishedAt}>
            {formatLocalDateTime(run.finishedAt)}
          </time>
        ) : (
          <span className="text-text-secondary">Running</span>
        )}
      </TableCell>
    );
  }
  if (columnId === "triggerSource") {
    return (
      <TableCell className="max-w-44 min-w-0">
        {run.triggerSourceId ? (
          <code className="type-mono block truncate" title={run.triggerSourceId}>{run.triggerSourceId}</code>
        ) : (
          <span className="text-text-secondary">None</span>
        )}
      </TableCell>
    );
  }
  if (columnId === "error") {
    return (
      <TableCell className="max-w-64 min-w-0">
        {run.error ? <span className="text-text-error block truncate" title={run.error}>{run.error}</span> : <span className="text-text-secondary">None</span>}
      </TableCell>
    );
  }
  if (columnId === "runId") {
    return (
      <TableCell className="max-w-44 min-w-0">
        <code className="type-mono block truncate" title={run.id}>{run.id}</code>
      </TableCell>
    );
  }
  if (columnId === "actions") {
    return (
      <TableCell sticky className="w-px whitespace-nowrap">
        <RunRowActions run={run} onView={onView} />
      </TableCell>
    );
  }
  return null;
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
