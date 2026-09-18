import { redactSecrets } from "../../shared/redact.js";
import { pruneAutomationRuns, pruneRetainedRows } from "./retention.repository.js";

export const RETENTION_MAX_AGE_DAYS = 30;
export const RETENTION_MAX_ROWS = 10_000;
export const RETENTION_BATCH_SIZE = 500;
export const RETENTION_INTERVAL_MS = 60 * 60 * 1000;

let cancelCleanup: (() => void) | null = null;
let retentionTimer: NodeJS.Timeout | null = null;

export function runRetentionPass(now = Date.now()) {
  const limits = {
    cutoffIso: new Date(now - RETENTION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    maxRows: RETENTION_MAX_ROWS,
    batchSize: RETENTION_BATCH_SIZE
  };

  const runs = pruneAutomationRuns(limits);
  return {
    automationRuns: runs.runs,
    automationBlockRuns: runs.dependentBlockRuns + pruneRetainedRows("automation_block_runs", limits),
    automationInboxItems: pruneRetainedRows("automation_inbox_items", limits),
    dataSourceReads: pruneRetainedRows("data_source_reads", limits)
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
