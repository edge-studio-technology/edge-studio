import { redactSecrets } from "../../shared/redact.js";
import { pruneAutomationRuns, pruneRetainedRows } from "./retention.repository.js";

export const RETENTION_MAX_AGE_DAYS = 30;
export const RETENTION_MAX_ROWS = 10_000;
export const RETENTION_BATCH_SIZE = 500;
export const RETENTION_INTERVAL_MS = 60 * 60 * 1000;

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

  const sweep = () => {
    try {
      runRetentionPass();
    } catch (error) {
      console.error("Retention cleanup failed:", redactSecrets(error instanceof Error ? error.message : String(error)));
    }
  };

  sweep();
  retentionTimer = setInterval(sweep, RETENTION_INTERVAL_MS);
}

export function stopRetentionScheduler() {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
}
