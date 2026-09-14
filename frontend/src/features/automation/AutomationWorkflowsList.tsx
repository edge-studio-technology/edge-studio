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
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SwitchField } from "../../components/ui/SwitchField";
import { TruncatedHash } from "../../components/ui/TruncatedHash";
import type { DataSource } from "../data-sources/dataSourceTypes";
import { DEFAULT_PAGE_SIZE_OPTIONS } from "../../lib/paginated";
import { formatLocalDateTime } from "../../lib/time";
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

  const sourceName = (id: string) =>
    sources.find((source) => source.id === id)?.name ?? "Unknown source";
  const filtersActive = Boolean(query.trim()) || filter !== "active";
  const filteredWorkflows = workflows.filter((workflow) =>
    workflowMatchesFilter(workflow, query, filter, sourceName(workflowPrimarySourceId(workflow))),
  );
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
      <div className="gap-detail-close flex flex-wrap items-end justify-between">
        <div className="min-w-0 flex-1 [&>div]:mb-0">
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
          />
        </div>
        <Button type="button" iconStart={<Plus aria-hidden />} onClick={onCreate}>
          New workflow
        </Button>
      </div>

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
          <DataTable>
            <TableHead>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell className="w-28">Enabled</TableHeaderCell>
              <TableHeaderCell className="w-40">Status</TableHeaderCell>
              {/* <TableHeaderCell className="w-56">Source</TableHeaderCell> */}
              {/* <TableHeaderCell className="w-48">Blocks</TableHeaderCell> */}
              <TableHeaderCell className="w-40">Last run</TableHeaderCell>
              {/* <TableHeaderCell className="w-40">Last hash</TableHeaderCell> */}
              <TableHeaderCell className="w-px whitespace-nowrap">Actions</TableHeaderCell>
            </TableHead>
            <TableBody>
              {pagedWorkflows.map((workflow) => {
                const validationError = workflow.validation?.firstErrorMessage ?? null;
                const inlineError = workflow.lastError ?? validationError;
                return (
                  <TableRow key={workflow.id}>
                    <TableCell className="min-w-0">
                      <span className="type-body-em block truncate" title={workflow.name}>
                        {workflow.name}
                      </span>
                      {inlineError && (
                        <p
                          className="type-meta text-text-error mt-detail-next m-0 truncate"
                          title={inlineError}
                        >
                          {inlineError}
                        </p>
                      )}
                      {workflow.archived && (
                        <p className="type-meta text-text-secondary mt-detail-next m-0">
                          Archived, does not run until restored.
                        </p>
                      )}
                    </TableCell>
                  <TableCell>
                    <SwitchField
                      aria-label={`${workflow.enabled ? "Disable" : "Enable"} ${workflow.name}`}
                      checked={workflow.enabled}
                      disabled={busy || workflow.archived}
                      className="min-w-0"
                      onChange={() => onToggleEnabled(workflow)}
                    />
                  </TableCell>
                  <TableCell>
                    <WorkflowStatusPill workflow={workflow} />
                  </TableCell>
                  {/* <TableCell className="min-w-0">
                    <span className="block truncate">
                      {sourceName(workflowPrimarySourceId(workflow))}
                    </span>
                    <p className="type-meta text-text-secondary mt-detail-next m-0">
                      {workflowIntervalSeconds(workflow) > 0
                        ? formatInterval(workflowIntervalSeconds(workflow))
                        : "Event driven"}
                    </p>
                  </TableCell> */}
                  {/* <TableCell className="min-w-0">
                    <span>{workflow.blocks.length}</span>
                    <p className="type-meta text-text-secondary mt-detail-next m-0 truncate">
                      {summarizeBlocks(workflow)}
                    </p>
                  </TableCell> */}
                  <TableCell className="whitespace-nowrap">
                    {workflow.lastRunAt ? (
                      <time className="text-text-secondary type-meta" dateTime={workflow.lastRunAt}>
                        {formatLocalDateTime(workflow.lastRunAt)}
                      </time>
                    ) : (
                      <span className="text-text-secondary">Never</span>
                    )}
                  </TableCell>
                  {/* <TableCell>
                    {workflow.lastHash ? (
                      <TruncatedHash value={workflow.lastHash} />
                    ) : (
                      <span className="text-text-secondary">Not read yet</span>
                    )}
                  </TableCell> */}
                  <TableCell className="w-px whitespace-nowrap">
                    <RowActions>
                      <TableIconButton
                        type="button"
                        disabled={busy}
                        title="Edit workflow"
                        aria-label={`Edit ${workflow.name}`}
                        onClick={() => onEdit(workflow)}
                      >
                        <Pencil size={16} aria-hidden />
                      </TableIconButton>
                      <TableIconMenu
                        aria-label={`More actions for ${workflow.name}`}
                        items={[
                          {
                            label: "Run now",
                            disabled: busy || workflow.archived,
                            onClick: () => onRunNow(workflow),
                          },
                          // {
                          //   label: "Watch workflow",
                          //   disabled: busy,
                          //   onClick: () => onWatch(workflow),
                          // },
                          {
                            label: "Duplicate",
                            disabled: busy,
                            onClick: () => onDuplicate(workflow),
                          },
                          {
                            label: workflow.archived ? "Restore" : "Archive",
                            disabled: busy,
                            onClick: () => onToggleArchive(workflow),
                          },
                          {
                            label: "Delete",
                            danger: true,
                            disabled: busy,
                            onClick: () => onDelete(workflow),
                          },
                        ]}
                      />
                    </RowActions>
                  </TableCell>
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
