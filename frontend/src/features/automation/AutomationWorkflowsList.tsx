import { Inbox, Pencil, Plus, Workflow } from "lucide-react";
import { useState } from "react";
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
} from "../../components/DataTable";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ListFilterBar } from "../../components/patterns/ListFilterBar";
import { ListPaginationFooter } from "../../components/patterns/ListPaginationFooter";
import { LoadingState } from "../../components/patterns/LoadingState";
import {
  applyColumnFilters,
  orderedColumns,
  TableColumnFilterSummary,
  TableColumnVisibilityButton,
  type TableColumnDefinition,
} from "../../components/patterns/TableColumnVisibility";
import { TableControls } from "../../components/patterns/TableControls";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SwitchField } from "../../components/ui/SwitchField";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import type { DataSource } from "../data-sources/dataSourceTypes";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatLocalDateTime } from "../../lib/time";
import { useTableColumnVisibility } from "../preferences/useTableColumnVisibility";
import type { AutomationWorkflow } from "./automationTypes";
import {
  formatInterval,
  summarizeBlocks,
  workflowIntervalSeconds,
  workflowMatchesFilter,
  workflowPrimarySourceId,
} from "./workflow/workflowHelpers";
import { WorkflowStatusPill } from "./workflow/workflowWorkspaceUi";

const STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Active list (not archived)" },
  { value: "all", label: "All workflows" },
  { value: "enabled", label: "Enabled" },
  { value: "paused", label: "Paused" },
  { value: "error", label: "With errors" },
  { value: "archived", label: "Archived" },
] as const;

type WorkflowFilter = (typeof STATUS_FILTER_OPTIONS)[number]["value"];

const PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS.map((size) => ({
  value: String(size),
  label: String(size),
}));

const WORKFLOW_COLUMNS = [
  { id: "name", label: "Name", filterable: true },
  { id: "enabled", label: "Enabled" },
  { id: "status", label: "Status" },
  { id: "lastRun", label: "Last run" },
  { id: "source", label: "Source", defaultVisible: false, filterable: true },
  { id: "blocks", label: "Blocks", defaultVisible: false, filterable: true },
  { id: "nextRun", label: "Next run", defaultVisible: false },
  { id: "lastHash", label: "Last hash", defaultVisible: false, filterable: true },
  { id: "actions", label: "Actions", dataColumn: false },
] as const satisfies readonly TableColumnDefinition[];

/** Feature-wide Automation workflows table (list/search/filter/actions). Not the workflow editor. */
export function AutomationWorkflowsList({
  workflows,
  sources,
  busy,
  loading = false,
  onCreate,
  onEdit,
  onWatch,
  onRunNow,
  onToggleEnabled,
  onDuplicate,
  onToggleArchive,
  onDelete,
}: {
  workflows: AutomationWorkflow[];
  sources: DataSource[];
  busy: boolean;
  loading?: boolean;
  onCreate: () => void;
  onEdit: (workflow: AutomationWorkflow) => void;
  onWatch: (workflow: AutomationWorkflow) => void;
  onRunNow: (workflow: AutomationWorkflow) => void;
  onToggleEnabled: (workflow: AutomationWorkflow) => void;
  onDuplicate: (workflow: AutomationWorkflow) => void;
  onToggleArchive: (workflow: AutomationWorkflow) => void;
  onDelete: (workflow: AutomationWorkflow) => void;
}) {
  const [filter, setFilter] = useState<WorkflowFilter>("active");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE_OPTIONS[0]);
  const { visibility, columnOrder, filters, setVisibility, setColumnOrder, setFilters } = useTableColumnVisibility("workflows", WORKFLOW_COLUMNS);
  const visibleColumns = orderedColumns(WORKFLOW_COLUMNS, columnOrder).filter(
    (column) => visibility[column.id],
  );
  const visibleColumnCount = visibleColumns.length;

  const sourceName = (id: string) =>
    sources.find((source) => source.id === id)?.name ?? "Unknown source";
  const filtersActive = Boolean(query.trim()) || filter !== "active" || Object.keys(filters).length > 0;
  const searchFilteredWorkflows = workflows.filter((workflow) =>
    workflowMatchesFilter(workflow, query, filter, sourceName(workflowPrimarySourceId(workflow))),
  );
  const filteredWorkflows = applyColumnFilters(searchFilteredWorkflows, filters, {
    name: (workflow) => [workflow.name, workflow.lastError, workflow.validation?.firstErrorMessage].filter(Boolean).join(" "),
    source: (workflow) => sourceName(workflowPrimarySourceId(workflow)),
    blocks: (workflow) => summarizeBlocks(workflow),
    lastHash: (workflow) => workflow.lastHash,
  });
  const totalPages = Math.max(1, Math.ceil(filteredWorkflows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedWorkflows = filteredWorkflows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function clearFilters() {
    setFilter("active");
    setQuery("");
    setPage(1);
  }

  return (
    <Card className="gap-detail-close grid w-full">
      <TableControls
        utilities={
          <TableColumnVisibilityButton
            tableLabel="Workflows"
            columns={WORKFLOW_COLUMNS}
            visibility={visibility}
            columnOrder={columnOrder}
            filters={filters}
            onChange={setVisibility}
            onOrderChange={setColumnOrder}
            onFiltersChange={setFilters}
          />
        }
      >
        <ListFilterBar
          filter={filter}
          q={query}
          filterOptions={STATUS_FILTER_OPTIONS}
          searchPlaceholder="Name, block type, device, hash..."
          disabled={loading || workflows.length === 0}
          onFilterChange={(value) => {
            setFilter(value as WorkflowFilter);
            setPage(1);
          }}
          onQueryChange={(q) => {
            setQuery(q);
            setPage(1);
          }}
          actions={
            <Button type="button" iconStart={<Plus aria-hidden />} onClick={onCreate}>
              New workflow
            </Button>
          }
        />
      </TableControls>

      <TableColumnFilterSummary
        columns={WORKFLOW_COLUMNS}
        filters={filters}
        onRemove={(columnId) => setFilters({ ...filters, [columnId]: undefined })}
        onClear={() => setFilters({})}
      />

      {loading ? (
        <LoadingState
          title="Fetching your workflows"
          description="This should take a few seconds."
        />
      ) : filteredWorkflows.length === 0 ? (
        <EmptyContentState
          icon={filtersActive ? Inbox : Workflow}
          title={filtersActive ? "No matching workflows" : "Build your first workflow"}
          description={
            filtersActive
              ? "Try another search or filter, or clear filters."
              : "Start from a trigger block, then chain data, logic, and Integritas stamping blocks."
          }
          actionLabel={filtersActive ? "Clear filters" : "New workflow"}
          actionIcon={filtersActive ? undefined : <Plus aria-hidden />}
          actionVariant={filtersActive ? "secondary" : "primary"}
          onAction={filtersActive ? clearFilters : onCreate}
        />
      ) : (
        <TableWrap>
          <DataTable className={visibleColumnCount > 3 ? "min-w-245" : undefined}>
            <TableHead>
              {visibleColumns.map((column) => (
                <TableHeaderCell key={column.id} sticky={column.id === "actions"} className={workflowHeaderClass(column.id)}>
                  {column.label}
                </TableHeaderCell>
              ))}
            </TableHead>
            <TableBody>
              {pagedWorkflows.map((workflow) => {
                const validationError = workflow.validation?.firstErrorMessage ?? null;
                const inlineError = workflow.lastError ?? validationError;
                return (
                  <TableRow key={workflow.id}>
                    {visibleColumns.map((column) => (
                      <WorkflowCell
                        key={column.id}
                        columnId={column.id}
                        workflow={workflow}
                        inlineError={inlineError}
                        busy={busy}
                        sourceName={sourceName}
                        onToggleEnabled={() => onToggleEnabled(workflow)}
                        onEdit={() => onEdit(workflow)}
                        onRunNow={() => onRunNow(workflow)}
                        onDuplicate={() => onDuplicate(workflow)}
                        onToggleArchive={() => onToggleArchive(workflow)}
                        onDelete={() => onDelete(workflow)}
                      />
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </TableWrap>
      )}

      <ListPaginationFooter
        page={currentPage}
        pageSize={pageSize}
        total={filteredWorkflows.length}
        totalPages={totalPages}
        disabled={loading}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </Card>
  );
}

function workflowHeaderClass(columnId: string) {
  if (columnId === "enabled") return "w-28";
  if (columnId === "status" || columnId === "lastRun" || columnId === "nextRun" || columnId === "lastHash") return "w-40";
  if (columnId === "source") return "w-56";
  if (columnId === "blocks") return "w-48";
  if (columnId === "actions") return "w-px whitespace-nowrap";
  return undefined;
}

function WorkflowCell({
  columnId,
  workflow,
  inlineError,
  busy,
  sourceName,
  onToggleEnabled,
  onEdit,
  onRunNow,
  onDuplicate,
  onToggleArchive,
  onDelete,
}: {
  columnId: string;
  workflow: AutomationWorkflow;
  inlineError: string | null;
  busy: boolean;
  sourceName: (id: string) => string;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onRunNow: () => void;
  onDuplicate: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  if (columnId === "name") {
    return (
      <TableCell className="min-w-0">
        <span className="type-body-em block truncate" title={workflow.name}>{workflow.name}</span>
        {inlineError && <p className="type-meta text-text-error mt-detail-next m-0 truncate" title={inlineError}>{inlineError}</p>}
        {workflow.archived && <p className="type-meta text-text-secondary mt-detail-next m-0">Archived, does not run until restored.</p>}
      </TableCell>
    );
  }
  if (columnId === "enabled") {
    return (
      <TableCell>
        <SwitchField
          aria-label={`${workflow.enabled ? "Disable" : "Enable"} ${workflow.name}`}
          checked={workflow.enabled}
          disabled={busy || workflow.archived}
          className="min-w-0"
          onChange={onToggleEnabled}
        />
      </TableCell>
    );
  }
  if (columnId === "status") return <TableCell><WorkflowStatusPill workflow={workflow} /></TableCell>;
  if (columnId === "lastRun") {
    return (
      <TableCell className="whitespace-nowrap">
        {workflow.lastRunAt ? <time className="text-text-secondary type-meta" dateTime={workflow.lastRunAt}>{formatLocalDateTime(workflow.lastRunAt)}</time> : <span className="text-text-secondary">Never</span>}
      </TableCell>
    );
  }
  if (columnId === "source") {
    return (
      <TableCell className="min-w-0">
        <span className="block truncate">{sourceName(workflowPrimarySourceId(workflow))}</span>
        <p className="type-meta text-text-secondary mt-detail-next m-0">
          {workflowIntervalSeconds(workflow) > 0 ? formatInterval(workflowIntervalSeconds(workflow)) : "Event driven"}
        </p>
      </TableCell>
    );
  }
  if (columnId === "blocks") {
    return (
      <TableCell className="min-w-0">
        <span>{workflow.blocks.length}</span>
        <p className="type-meta text-text-secondary mt-detail-next m-0 truncate">{summarizeBlocks(workflow)}</p>
      </TableCell>
    );
  }
  if (columnId === "nextRun") {
    return (
      <TableCell className="whitespace-nowrap">
        {workflow.nextRunAt ? <time className="text-text-secondary type-meta" dateTime={workflow.nextRunAt}>{formatLocalDateTime(workflow.nextRunAt)}</time> : <span className="text-text-secondary">Not scheduled</span>}
      </TableCell>
    );
  }
  if (columnId === "lastHash") {
    return <TableCell>{workflow.lastHash ? <TruncatedHash value={workflow.lastHash} /> : <span className="text-text-secondary">Not read yet</span>}</TableCell>;
  }
  if (columnId === "actions") {
    return (
      <TableCell sticky className="w-px whitespace-nowrap">
        <RowActions>
          <TableIconButton type="button" disabled={busy} title="Edit workflow" aria-label={`Edit ${workflow.name}`} onClick={onEdit}>
            <Pencil size={16} aria-hidden />
          </TableIconButton>
          <TableIconMenu
            aria-label={`More actions for ${workflow.name}`}
            items={[
              { label: "Run now", disabled: busy || workflow.archived, onClick: onRunNow },
              { label: "Duplicate", disabled: busy, onClick: onDuplicate },
              { label: workflow.archived ? "Restore" : "Archive", disabled: busy, onClick: onToggleArchive },
              { label: "Delete", danger: true, disabled: busy, onClick: onDelete },
            ]}
          />
        </RowActions>
      </TableCell>
    );
  }
  return null;
}
