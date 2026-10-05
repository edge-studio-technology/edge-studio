import { db } from "../../db/database.js";

export type WorkflowBudgetReservation = { ok: true } | { ok: false; nextAvailableAt: string };

/** Atomically expires, counts, and reserves one rolling-window slot for a run. */
export function reserveWorkflowRunBudget(input: { workflowId: string; runId: string; nowMs: number; maxRuns: number; windowMs: number }): WorkflowBudgetReservation {
  return db.transaction((): WorkflowBudgetReservation => {
    const windowStartIso = new Date(input.nowMs - input.windowMs).toISOString();
    db.prepare("DELETE FROM automation_workflow_budget_events WHERE workflow_id = ? AND consumed_at <= ?").run(input.workflowId, windowStartIso);

    if (db.prepare("SELECT 1 FROM automation_workflow_budget_events WHERE run_id = ?").get(input.runId)) return { ok: true };

    const { count, oldest } = db.prepare(`
      SELECT COUNT(*) AS count, MIN(consumed_at) AS oldest
      FROM automation_workflow_budget_events
      WHERE workflow_id = ?
    `).get(input.workflowId) as { count: number; oldest: string | null };
    if (count >= input.maxRuns) {
      return { ok: false, nextAvailableAt: new Date(Date.parse(oldest!) + input.windowMs).toISOString() };
    }

    db.prepare("INSERT INTO automation_workflow_budget_events (run_id, workflow_id, consumed_at) VALUES (?, ?, ?)")
      .run(input.runId, input.workflowId, new Date(input.nowMs).toISOString());
    return { ok: true };
  }).immediate();
}
