import { DetailList, DetailRow } from "../../components/patterns/DetailList";
import { ErrorDetailPanel } from "../../components/patterns/ErrorDetailPanel";
import { JsonPreviewContent } from "../../components/JsonPreview";
import { Disclosure } from "../../components/ui/Disclosure";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { formatLocalDateTime } from "../../lib/time";
import { formatRunDuration, RUN_STATUS } from "./automationRunDisplay";
import type { AutomationRun } from "./automationTypes";

/** Prefer the run-level error; if missing, fall back to the first failed block's error. */
function primaryInspectError(run: AutomationRun) {
  if (run.errorDetails ?? run.error) return run.errorDetails ?? run.error;
  const failedBlock = run.blocks.find((block) => block.error || block.status === "failed");
  return failedBlock?.errorDetails ?? failedBlock?.error ?? null;
}

/** Eye-action inspect dialog for one workflow run (opened from AutomationRunsTable). */
export function AutomationRunInspectModal({
  run,
  onClose,
}: {
  run: AutomationRun;
  onClose: () => void;
}) {
  const error = primaryInspectError(run);
  const failedBlocks = run.blocks.filter((block) => block.error || block.status === "failed");
  const failedBlock = failedBlocks[0];
  const successBlocks = run.blocks.filter((block) => block.status === "success").length;
  const status = RUN_STATUS[run.status];

  return (
    <Modal title={`${run.workflowName} workflow`} onClose={onClose}>
      <div className="gap-detail-near grid">
        <DetailList>
          <DetailRow label="Started" value={formatLocalDateTime(run.startedAt)} />
          <DetailRow label="Trigger" value={<Pill>{run.triggerType}</Pill>} />
          <DetailRow
            label="Status"
            value={
              <Pill tone={status.tone} indicator>
                {status.label}
              </Pill>
            }
          />
          <DetailRow label="Duration" value={formatRunDuration(run.durationMs)} />
          <DetailRow label="Blocks" value={`${successBlocks}/${run.blockCount}`} />
          {failedBlock ? <DetailRow label="Failed block" value={failedBlock.blockLabel} /> : null}
        </DetailList>

        {error ? (
          <Disclosure title="Error">
            <ErrorDetailPanel error={error} />
          </Disclosure>
        ) : null}

        {failedBlocks.length > 0 ? (
          <Disclosure title="Block errors">
            <div className="border-stroke-secondary divide-stroke-secondary flex flex-col divide-y">
              {failedBlocks.map((block) => {
                const blockError = block.errorDetails ?? block.error;
                return blockError ? (
                  <div
                    key={block.id}
                    className="py-pad-close flex flex-col first:pt-0 last:pb-0"
                  >
                    <ErrorDetailPanel error={blockError} />
                  </div>
                ) : null;
              })}
            </div>
          </Disclosure>
        ) : null}

        <Disclosure title="Run data">
          <JsonPreviewContent value={run} />
        </Disclosure>
      </div>
    </Modal>
  );
}
