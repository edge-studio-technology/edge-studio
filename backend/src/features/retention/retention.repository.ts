import { getActiveAutomationRunIds } from "../automation/automationRuns.repository.js";
import { db } from "../../db/database.js";
import type { RetentionSettings } from "./retention-settings.service.js";

const configuredRuns = `
  WITH ranked AS (
    SELECT id, workflow_id, started_at,
      ROW_NUMBER() OVER (PARTITION BY workflow_id ORDER BY started_at DESC, id DESC) AS position
    FROM automation_runs
  )
  SELECT id FROM ranked
  WHERE id NOT IN (SELECT value FROM json_each(@activeRuns))
    AND ((workflow_id IS NOT NULL AND position > @runsPerWorkflow)
      OR (workflow_id IS NULL AND started_at < @deletedCutoff))
  ORDER BY started_at ASC, id ASC
`;

const configuredReads = `SELECT id FROM data_source_reads
  WHERE created_at < @readCutoff AND integritas_proof_id IS NULL
  ORDER BY created_at ASC, id ASC`;

function configuredParameters(settings: RetentionSettings, now: number) {
  return {
    activeRuns: JSON.stringify(getActiveAutomationRunIds()),
    runsPerWorkflow: settings.runsPerWorkflow,
    deletedCutoff: new Date(now - settings.deletedWorkflowRunDays * 86400000).toISOString()
  };
}

export function previewConfiguredRetention(settings: RetentionSettings, now = Date.now()) {
  const parameters = configuredParameters(settings, now);
  const readCutoff = new Date(now - settings.dataSourceReadDays * 86400000).toISOString();
  const count = (sql: string, values: Record<string, string | number>) => (db.prepare(sql).get(values) as { count: number }).count;
  return {
    automationRuns: count(`SELECT COUNT(*) AS count FROM (${configuredRuns})`, parameters),
    automationBlockRuns: count(`SELECT COUNT(*) AS count FROM automation_block_runs WHERE run_id IN (${configuredRuns})`, parameters),
    dataSourceReads: count(`SELECT COUNT(*) AS count FROM (${configuredReads})`, { readCutoff })
  };
}

export function pruneConfiguredRetention(settings: RetentionSettings, batchSize: number, now = Date.now()) {
  return db.transaction(() => {
    const parameters = configuredParameters(settings, now);
    const runIds = db.prepare(`${configuredRuns} LIMIT @batchSize`).all({ ...parameters, batchSize }) as { id: string }[];
    const ids = JSON.stringify(runIds.map((row) => row.id));
    const automationBlockRuns = db.prepare("DELETE FROM automation_block_runs WHERE run_id IN (SELECT value FROM json_each(?))").run(ids).changes;
    const automationRuns = db.prepare("DELETE FROM automation_runs WHERE id IN (SELECT value FROM json_each(?))").run(ids).changes;
    const dataSourceReads = db.prepare(`DELETE FROM data_source_reads WHERE id IN (${configuredReads} LIMIT @batchSize)`).run({ readCutoff: new Date(now - settings.dataSourceReadDays * 86400000).toISOString(), batchSize }).changes;
    return { automationRuns, automationBlockRuns, dataSourceReads };
  }).immediate();
}

export type RetentionLimits = {
  cutoffIso: string;
  maxRows: number;
  batchSize: number;
};

export type RetainedTable = "automation_runs" | "automation_block_runs" | "data_source_reads";

const timestampColumns: Record<RetainedTable, string> = {
  automation_runs: "started_at",
  automation_block_runs: "started_at",
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

/** Deletes one age/count-limited batch from a retained diagnostics or product-data table. */
export function pruneRetainedRows(table: Exclude<RetainedTable, "automation_runs">, limits: RetentionLimits) {
  return db.transaction(() => {
    const activeRuns = JSON.stringify(getActiveAutomationRunIds());
    const count = eligibleRowCount(table, limits, activeRuns);
    if (count === 0) return 0;
    return db.prepare(`DELETE FROM ${table} WHERE id IN (${oldestRowsQuery(table)})`).run({ count, activeRuns }).changes;
  }).immediate();
}

/** Physically deletes one bounded batch of inbox items that the user has already deleted. */
export function pruneDeletedAutomationInboxItems(batchSize: number) {
  return db.transaction(() => db.prepare(`
    DELETE FROM automation_inbox_items
    WHERE id IN (
      SELECT id
      FROM automation_inbox_items
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at ASC, id ASC
      LIMIT ?
    )
  `).run(batchSize).changes).immediate();
}
