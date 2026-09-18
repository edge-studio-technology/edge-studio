import { getActiveAutomationRunIds } from "../automation/automationRuns.repository.js";
import { db } from "../../db/database.js";

export type RetentionLimits = {
  cutoffIso: string;
  maxRows: number;
  batchSize: number;
};

export type RetainedTable = "automation_runs" | "automation_block_runs" | "automation_inbox_items" | "data_source_reads";

const timestampColumns: Record<RetainedTable, string> = {
  automation_runs: "started_at",
  automation_block_runs: "started_at",
  automation_inbox_items: "created_at",
  data_source_reads: "created_at"
};

function eligibleRows(table: RetainedTable) {
  if (table === "automation_runs") return "id NOT IN (SELECT value FROM json_each(@activeRuns))";
  if (table === "automation_block_runs") return "run_id NOT IN (SELECT value FROM json_each(@activeRuns))";
  return "@activeRuns IS NOT NULL";
}

function oldestRowsQuery(table: RetainedTable) {
  return `SELECT id FROM ${table} WHERE ${eligibleRows(table)} ORDER BY ${timestampColumns[table]} ASC, id ASC LIMIT @count`;
}

// Age and row-cap eligibility each select a prefix of the (timestamp, id) order, so their union is
// the longer prefix.
function eligibleRowCount(table: RetainedTable, limits: RetentionLimits, activeRuns: string) {
  const { older } = db.prepare(`SELECT COUNT(*) AS older FROM ${table} WHERE ${timestampColumns[table]} < @cutoff AND ${eligibleRows(table)}`).get({ cutoff: limits.cutoffIso, activeRuns }) as { older: number };
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number };
  return Math.max(0, Math.min(limits.batchSize, Math.max(older, total - limits.maxRows)));
}

/** Deletes one batch of runs, explicitly deleting their block runs first rather than relying on the cascade. */
export function pruneAutomationRuns(limits: RetentionLimits) {
  return db.transaction(() => {
    const activeRuns = JSON.stringify(getActiveAutomationRunIds());
    const count = eligibleRowCount("automation_runs", limits, activeRuns);
    if (count === 0) return { runs: 0, dependentBlockRuns: 0 };
    const oldestRuns = oldestRowsQuery("automation_runs");
    const dependentBlockRuns = db.prepare(`DELETE FROM automation_block_runs WHERE run_id IN (${oldestRuns})`).run({ count, activeRuns }).changes;
    const runs = db.prepare(`DELETE FROM automation_runs WHERE id IN (${oldestRuns})`).run({ count, activeRuns }).changes;
    return { runs, dependentBlockRuns };
  }).immediate();
}

/** Deletes one batch of rows, including soft-deleted inbox items. */
export function pruneRetainedRows(table: Exclude<RetainedTable, "automation_runs">, limits: RetentionLimits) {
  return db.transaction(() => {
    const activeRuns = JSON.stringify(getActiveAutomationRunIds());
    const count = eligibleRowCount(table, limits, activeRuns);
    if (count === 0) return 0;
    return db.prepare(`DELETE FROM ${table} WHERE id IN (${oldestRowsQuery(table)})`).run({ count, activeRuns }).changes;
  }).immediate();
}
