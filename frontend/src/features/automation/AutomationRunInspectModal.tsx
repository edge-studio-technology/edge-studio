import { JsonBlock } from "../../components/patterns/JsonBlock";
import { Button } from "../../components/ui/Button";
import { Disclosure } from "../../components/ui/Disclosure";
import { Modal } from "../../components/ui/Modal";
import { Pill } from "../../components/ui/Pill";
import { normalizeError } from "../../lib/errors";
import { formatLocalDateTime } from "../../lib/time";
import { RUN_STATUS } from "./automationRunDisplay";
import type { AutomationRun } from "./automationTypes";

/** Prefer the run-level error; if missing, fall back to the first failed block's error. */
function primaryInspectError(run: AutomationRun) {
  if (run.errorDetails ?? run.error) return run.errorDetails ?? run.error;
  const failedBlock = run.blocks.find((block) => block.error || block.status === "failed");
  return failedBlock?.errorDetails ?? failedBlock?.error ?? null;
}

/** First block that failed — used for the summary "Failed block" label. */
function firstFailedBlock(run: AutomationRun) {
  return run.blocks.find((block) => block.error || block.status === "failed") ?? null;
}

function Field({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <section className="gap-detail-tight flex w-full flex-col">
      <p className="type-meta text-text-tertiary m-0">{label}</p>
      <p
        className={
          emphasis
            ? "type-body-em text-text-primary m-0 break-words"
            : "type-body text-text-primary m-0 break-words"
        }
      >
        {value}
      </p>
    </section>
  );
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
  const failedBlock = firstFailedBlock(run);
  // All failed blocks — listed under the "Block error details" disclosure.
  const failedBlocks = run.blocks.filter((block) => block.error || block.status === "failed");
  const status = RUN_STATUS[run.status];
  const normalized = error ? normalizeError(error) : null;
  // Raw payload for the primary error (separate "Raw" disclosure).
  const rawError = normalized?.raw ?? null;

  return (
    <Modal
      title={`${run.workflowName} workflow`}
      description={
        error
          ? "Details of this workflow run, including error details and raw data."
          : "Details of this workflow run."
      }
      className="max-w-[600px]"
      onClose={onClose}
      footer={
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="gap-detail-near px-detail-next py-pad-close flex flex-col">
        {/* Header: run summary line + status pill */}
        <div className="gap-detail-close flex flex-wrap items-start justify-between">
          <p className="type-body text-text-secondary m-0">
            Ran {run.blocks.filter((block) => block.status === "success").length} blocks out of{" "}
            {run.blocks.length} on {formatLocalDateTime(run.startedAt)}.
          </p>
          <Pill tone={status.tone} indicator>
            {status.label}
          </Pill>
        </div>

        {/* Summary (always visible): which block failed + Type / Message / Native */}
        {normalized ? (
          <div className="gap-detail-near flex flex-col">
            <Field label="Type" value={normalized.title} emphasis />
            {failedBlock ? <Field label="Failed block" value={failedBlock.blockLabel} /> : null}

            <Field label="Message" value={normalized.message} />
            {normalized.nativeMessage && normalized.nativeMessage !== normalized.message ? (
              <Field label="Native details" value={normalized.nativeMessage} />
            ) : null}
          </div>
        ) : null}

        {/* Collapsible sections (tech / deeper inspect) */}
        <div className="border-stroke-secondary divide-stroke-secondary flex flex-col divide-y border-t">
          {/* Primary error raw JSON (run-level or first failed block fallback) */}
          {rawError ? (
            <Disclosure title="Workflow error" defaultOpen={false} className="py-pad-close">
              <JsonBlock value={rawError} />
            </Disclosure>
          ) : null}
          {/* Per failed block: name + type, then JsonBlock of that block's error only */}
          {failedBlocks.length > 0 ? (
            <Disclosure
              title="Workflow block errors"
              defaultOpen={false}
              className="py-pad-close"
              contentClassName="gap-detail-close"
            >
              <div className="border-stroke-secondary divide-stroke-secondary flex flex-col divide-y">
                {failedBlocks.map((block) => {
                  const blockError = block.errorDetails ?? block.error;
                  return (
                    <div
                      key={block.id}
                      className="gap-detail-close py-pad-close flex flex-col first:pt-0 last:pb-0"
                    >
                      <div className="gap-detail-tight flex min-w-0 flex-col">
                        <p className="type-body text-text-primary m-0">{block.blockLabel}</p>
                        {/* <p className="type-meta text-text-secondary m-0">{block.blockType}</p> */}
                      </div>
                      {blockError ? <JsonBlock value={normalizeError(blockError).raw} /> : null}
                    </div>
                  );
                })}
              </div>
            </Disclosure>
          ) : null}
          {/* Full stored AutomationRun payload */}
          <Disclosure
            title="Workflow run data"
            defaultOpen={false}
            className={failedBlocks.length > 0 || rawError ? "py-pad-close" : "pt-pad-close"}
          >
            <JsonBlock value={run} />
          </Disclosure>
        </div>
      </div>
    </Modal>
  );
}
