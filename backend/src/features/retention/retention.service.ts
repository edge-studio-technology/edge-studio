import { redactSecrets } from "../../shared/redact.js";
import { RETENTION_INTERVAL_MS, RETENTION_POLICIES } from "./retention.policy.js";
import { pruneAutomationRuns, pruneDeletedAutomationInboxItems, pruneRetainedRows } from "./retention.repository.js";

export { RETENTION_INTERVAL_MS } from "./retention.policy.js";

let cancelCleanup: (() => void) | null = null;
let retentionTimer: NodeJS.Timeout | null = null;

export function runRetentionPass(now = Date.now()) {
  const runPolicy = RETENTION_POLICIES.automationRuns;
  const blockRunPolicy = RETENTION_POLICIES.automationBlockRuns;
  const runLimits = {
    cutoffIso: new Date(now - runPolicy.maxAgeDays * 24 * 60 * 60 * 1000).toISOString(),
    maxRows: runPolicy.maxRows,
    batchSize: runPolicy.batchSize
  };
  const blockRunLimits = {
    cutoffIso: new Date(now - blockRunPolicy.maxAgeDays * 24 * 60 * 60 * 1000).toISOString(),
    maxRows: blockRunPolicy.maxRows,
    batchSize: blockRunPolicy.batchSize
  };

  const runs = pruneAutomationRuns(runLimits);
  return {
    automationRuns: runs.runs,
    automationBlockRuns: runs.dependentBlockRuns + pruneRetainedRows("automation_block_runs", blockRunLimits),
    automationInboxItems: pruneDeletedAutomationInboxItems(RETENTION_POLICIES.automationInboxItems.batchSize),
    dataSourceReads: 0
  };
}

export function startRetentionScheduler() {
  if (retentionTimer) return;

  let cancelled = false;
  let running = false;
  cancelCleanup = () => { cancelled = true; };
  const sweep = async () => {
    if (running || cancelled) return;
    running = true;
    try {
      const now = Date.now();
      while (!cancelled) {
        const deleted = runRetentionPass(now);
        if (Object.values(deleted).every((count) => count === 0)) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.error("Retention cleanup failed:", redactSecrets(error instanceof Error ? error.message : String(error)));
    } finally {
      running = false;
    }
  };

  void sweep();
  retentionTimer = setInterval(sweep, RETENTION_INTERVAL_MS);
}

export function stopRetentionScheduler() {
  cancelCleanup?.();
  cancelCleanup = null;
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
}
