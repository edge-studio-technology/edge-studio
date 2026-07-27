import { randomUUID } from "node:crypto";
import { db } from "../../db/database.js";

export type AutomationInboxFormat = "text" | "json" | "link" | "image";
export type AutomationInboxImageSource = "url" | "local_path";

export type AutomationInboxItemRecord = {
  id: string;
  workflow_id: string | null;
  workflow_name: string;
  run_id: string | null;
  block_id: string | null;
  title: string;
  format: AutomationInboxFormat;
  content_json: string;
  rendered_text: string | null;
  created_at: string;
  read_at: string | null;
  deleted_at: string | null;
};

export type AutomationInboxListQuery = {
  status?: "unread" | "read" | "all";
  workflowId?: string;
  format?: AutomationInboxFormat;
  limit: number;
  offset: number;
};

export function createAutomationInboxItem(input: {
  workflowId: string | null;
  workflowName: string;
  runId: string | null;
  blockId: string | null;
  title: string;
  format: AutomationInboxFormat;
  content: unknown;
  renderedText?: string | null;
}) {
  const now = new Date().toISOString();
  const record: AutomationInboxItemRecord = {
    id: randomUUID(),
    workflow_id: input.workflowId,
    workflow_name: input.workflowName,
    run_id: input.runId,
    block_id: input.blockId,
    title: input.title,
    format: input.format,
    content_json: JSON.stringify(input.content),
    rendered_text: input.renderedText ?? null,
    created_at: now,
    read_at: null,
    deleted_at: null
  };

  db.prepare(`
    INSERT INTO automation_inbox_items (id, workflow_id, workflow_name, run_id, block_id, title, format, content_json, rendered_text, created_at, read_at, deleted_at)
    VALUES (@id, @workflow_id, @workflow_name, @run_id, @block_id, @title, @format, @content_json, @rendered_text, @created_at, @read_at, @deleted_at)
  `).run(record);
  return record;
}

export function listAutomationInboxItems(query: AutomationInboxListQuery) {
  const where = inboxWhere(query);
  return db.prepare(`
    SELECT * FROM automation_inbox_items
    ${where.sql}
    ORDER BY created_at DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...where.params, limit: query.limit, offset: query.offset }) as AutomationInboxItemRecord[];
}

export function countAutomationInboxItems(query: Omit<AutomationInboxListQuery, "limit" | "offset">) {
  const where = inboxWhere({ ...query, limit: 1, offset: 0 });
  const row = db.prepare(`SELECT COUNT(*) as count FROM automation_inbox_items ${where.sql}`).get(where.params) as { count: number };
  return row.count;
}

export function getAutomationInboxItem(id: string) {
  return db.prepare("SELECT * FROM automation_inbox_items WHERE id = ? AND deleted_at IS NULL").get(id) as AutomationInboxItemRecord | undefined;
}

export function setAutomationInboxItemRead(id: string, read: boolean) {
  const readAt = read ? new Date().toISOString() : null;
  db.prepare("UPDATE automation_inbox_items SET read_at = ? WHERE id = ? AND deleted_at IS NULL").run(readAt, id);
  return getAutomationInboxItem(id);
}

export function deleteAutomationInboxItem(id: string) {
  const result = db.prepare("UPDATE automation_inbox_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL").run(new Date().toISOString(), id);
  return result.changes > 0;
}

function inboxWhere(query: AutomationInboxListQuery) {
  const clauses = ["deleted_at IS NULL"];
  const params: Record<string, unknown> = {};
  if (query.status === "unread") clauses.push("read_at IS NULL");
  if (query.status === "read") clauses.push("read_at IS NOT NULL");
  if (query.workflowId) {
    clauses.push("workflow_id = @workflowId");
    params.workflowId = query.workflowId;
  }
  if (query.format) {
    clauses.push("format = @format");
    params.format = query.format;
  }
  return { sql: `WHERE ${clauses.join(" AND ")}`, params };
}
