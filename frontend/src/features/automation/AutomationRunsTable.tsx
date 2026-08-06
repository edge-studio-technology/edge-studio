import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
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
import { Pill } from "../../components/ui/Pill";
import { formatLocalDateTime } from "../../lib/time";
import { AutomationRunInspectModal } from "./AutomationRunInspectModal";
import { formatRunDuration, RUN_STATUS } from "./automationRunDisplay";
import type { AutomationRun } from "./automationTypes";

export function AutomationRunsTable({
  runs,
  compact = false,
  filtered = false,
}: {
  runs: AutomationRun[];
  compact?: boolean;
  filtered?: boolean;
}) {
  const [inspectRunId, setInspectRunId] = useState<string | null>(null);
  const inspectRun = inspectRunId ? (runs.find((run) => run.id === inspectRunId) ?? null) : null;
  const colCount = compact ? 6 : 7;

  return (
    <>
      <TableWrap>
        <DataTable aria-label="Workflow logs" className="min-w-[1020px]">
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
            {runs.length === 0 ? (
              <TableRow>
                <td colSpan={colCount} className="p-0">
                  <div className="p-margin-tight py-pad-relaxed">
                    <p className="type-body text-text-secondary m-0">
                      {filtered ? "No matching workflow runs." : "No workflow runs recorded yet."}
                    </p>
                  </div>
                </td>
              </TableRow>
            ) : (
              runs.map((run) => {
                const status = RUN_STATUS[run.status];
                const successBlocks = run.blocks.filter(
                  (block) => block.status === "success",
                ).length;
                return (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap">
                      <time className="type-meta text-text-secondary" dateTime={run.startedAt}>
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
              })
            )}
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
        title="View run"
        aria-label={`View run for ${label}`}
        onClick={onView}
      >
        <Eye size={16} aria-hidden />
      </TableIconButton>
      {run.workflowId ? (
        <TableIconMenu
          aria-label={`More actions for ${label}`}
          items={[
            {
              label: "Show on canvas",
              onClick: () =>
                navigate(
                  `/automation/${encodeURIComponent(run.workflowId!)}/watch/${encodeURIComponent(run.id)}`,
                ),
            },
          ]}
        />
      ) : null}
    </RowActions>
  );
}
