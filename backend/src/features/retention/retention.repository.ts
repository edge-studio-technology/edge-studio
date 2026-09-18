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

function oldestRowsQuery(table: RetainedTable) {
  return `SELECT id FROM ${table} ORDER BY ${timestampColumns[table]} ASC, id ASC LIMIT ?`;
}

// Age and row-cap eligibility each select a prefix of the (timestamp, id) order, so their union is
// the longer prefix.
function eligibleRowCount(table: RetainedTable, limits: RetentionLimits) {
  const { older } = db.prepare(`SELECT COUNT(*) AS older FROM ${table} WHERE ${timestampColumns[table]} < ?`).get(limits.cutoffIso) as { older: number };
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number };
  return Math.max(0, Math.min(limits.batchSize, Math.max(older, total - limits.maxRows)));
}

/** Deletes one batch of runs, explicitly deleting their block runs first rather than relying on the cascade. */
export function pruneAutomationRuns(limits: RetentionLimits) {
  return db.transaction(() => {
    const count = eligibleRowCount("automation_runs", limits);
    if (count === 0) return { runs: 0, dependentBlockRuns: 0 };
    const oldestRuns = oldestRowsQuery("automation_runs");
    const dependentBlockRuns = db.prepare(`DELETE FROM automation_block_runs WHERE run_id IN (${oldestRuns})`).run(count).changes;
    const runs = db.prepare(`DELETE FROM automation_runs WHERE id IN (${oldestRuns})`).run(count).changes;
    return { runs, dependentBlockRuns };
  }).immediate();
}

/** Deletes one batch of rows, including soft-deleted inbox items. */
export function pruneRetainedRows(table: Exclude<RetainedTable, "automation_runs">, limits: RetentionLimits) {
  return db.transaction(() => {
    const count = eligibleRowCount(table, limits);
    if (count === 0) return 0;
    return db.prepare(`DELETE FROM ${table} WHERE id IN (${oldestRowsQuery(table)})`).run(count).changes;
  }).immediate();
}
