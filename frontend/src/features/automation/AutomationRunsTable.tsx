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
import { Pill } from "../../components/ui/Pill";
import { formatLocalDateTime } from "../../lib/time";
import { AutomationRunInspectModal } from "./AutomationRunInspectModal";
import { formatRunDuration, RUN_STATUS } from "./automationRunDisplay";
import type { AutomationRun } from "./automationTypes";

export function AutomationRunsTable({
  runs,
  compact = false,
  filtered = false,
  loading = false,
  onClearFilters,
}: {
  runs: AutomationRun[];
  compact?: boolean;
  filtered?: boolean;
  loading?: boolean;
  onClearFilters?: () => void;
}) {
  const [inspectRunId, setInspectRunId] = useState<string | null>(null);
  const inspectRun = inspectRunId ? (runs.find((run) => run.id === inspectRunId) ?? null) : null;

  if (loading)
    return (
      <LoadingState
        title="Fetching your workflow runs"
        description="This should take a few seconds."
      />
    );

  if (runs.length === 0)
    return (
      <EmptyContentState
        icon={Inbox}
        title={filtered ? "No matching workflow runs" : "No workflow runs yet"}
        description={
          filtered
            ? "Try another status or search, or clear filters."
            : "Runs from your automation workflows will be added to your history here."
        }
        actionLabel={filtered && onClearFilters ? "Clear filters" : undefined}
        actionVariant="secondary"
        onAction={filtered ? onClearFilters : undefined}
      />
    );

  return (
    <>
      <TableWrap>
        <DataTable aria-label="Workflow logs" className="min-w-245">
          <TableHead>
            <TableHeaderCell className="whitespace-nowrap">Started</TableHeaderCell>
            {!compact && <TableHeaderCell>Workflow</TableHeaderCell>}
            <TableHeaderCell>Trigger</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Duration</TableHeaderCell>
            <TableHeaderCell>Blocks</TableHeaderCell>
            <TableHeaderCell className="w-px whitespace-nowrap">Actions</TableHeaderCell>
          </TableHead>
          <TableBody>
            {runs.map((run) => {
              const status = RUN_STATUS[run.status];
              const successBlocks = run.blocks.filter((block) => block.status === "success").length;
              return (
                <TableRow key={run.id}>
                  <TableCell className="whitespace-nowrap">
                    <time className="text-text-secondary type-meta" dateTime={run.startedAt}>
                      {formatLocalDateTime(run.startedAt)}
                    </time>
                  </TableCell>
                  {!compact && (
                    <TableCell className="max-w-56 min-w-0">
                      <span className="type-body-em text-text-primary block truncate">
                        {run.workflowName}
                      </span>
                    </TableCell>
                  )}
                  <TableCell>
                    <Pill>{run.triggerType}</Pill>
                  </TableCell>
                  <TableCell>
                    <Pill tone={status.tone} indicator>
                      {status.label}
                    </Pill>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatRunDuration(run.durationMs)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {successBlocks}/{run.blockCount}
                  </TableCell>
                  <TableCell className="w-px whitespace-nowrap">
                    <RunRowActions run={run} onView={() => setInspectRunId(run.id)} />
                  </TableCell>
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
      <TableIconMenu
        aria-label={`More actions for ${label}`}
        items={[
          {
            label: "Show on canvas",
            disabled: !run.workflowId,
            title: run.workflowId ? undefined : "Workflow was deleted",
            onClick: () => {
              if (!run.workflowId) return;
              navigate(
                `/automation/${encodeURIComponent(run.workflowId)}/watch/${encodeURIComponent(run.id)}`,
              );
            },
          },
        ]}
      />
    </RowActions>
  );
}
