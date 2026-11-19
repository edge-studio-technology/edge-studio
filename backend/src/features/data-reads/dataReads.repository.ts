import crypto from "node:crypto";
import { db } from "../../db/database.js";
import type { ParsedListQuery } from "../../shared/list-query.js";
import { serializeStructuredError, type StructuredError } from "../../shared/structured-error.js";

export type DataSourceReadRecord = {
  id: string;
  created_at: string;
  data_source_id: string | null;
  workflow_id: string | null;
  integritas_proof_id: string | null;
  source_name: string;
  source_url: string;
  trigger_type: string;
  status: string;
  hash: string | null;
  preview_json: string | null;
  error: string | null;
  trigger_source_id: string | null;
  trigger_payload_json: string | null;
  block_id: string | null;
};

/** Credential-free `source_url` for push sources (webhook, MQTT, GPIO) — never their config URL. */
export function dataSourceReference(dataSourceId: string) {
  return `data-source:${dataSourceId}`;
}

export const DATA_READ_LIST_STATUSES = ["success", "failed"] as const;

export type DataReadListQuery = ParsedListQuery;

function buildDataReadListWhere(query: Pick<DataReadListQuery, "status" | "q">) {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    clauses.push("status = ?");
    params.push(query.status);
  }

  if (query.q) {
    const like = `%${query.q}%`;
    clauses.push("(id LIKE ? OR hash LIKE ? OR integritas_proof_id LIKE ? OR source_name LIKE ? OR source_url LIKE ?)");
    params.push(like, like, like, like, like);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function countDataSourceReads(query: Pick<DataReadListQuery, "status" | "q"> = {}) {
  const { where, params } = buildDataReadListWhere(query);
  const row = db.prepare(`SELECT COUNT(*) as count FROM data_source_reads ${where}`).get(...params) as { count: number };
  return row.count;
}

export function listDataSourceReads(query: DataReadListQuery) {
  const { where, params } = buildDataReadListWhere(query);
  const offset = (query.page - 1) * query.pageSize;
  return db.prepare(`
    SELECT * FROM data_source_reads
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, query.pageSize, offset) as DataSourceReadRecord[];
}

export function getDataSourceRead(id: string) {
  return db.prepare("SELECT * FROM data_source_reads WHERE id = ?").get(id) as DataSourceReadRecord | undefined;
}

export function getDataSourceReadByProofId(proofId: string) {
  return db.prepare("SELECT * FROM data_source_reads WHERE integritas_proof_id = ?").get(proofId) as DataSourceReadRecord | undefined;
}

export function createDataSourceRead(input: { dataSourceId: string; workflowId?: string | null; sourceName: string; sourceUrl: string; triggerType: "manual" | "automation" | "webhook" | "mqtt" | "gpio" | "schedule"; status: "success" | "failed"; hash?: string | null; preview?: unknown; error?: string | StructuredError | null; triggerSourceId?: string | null; triggerPayload?: unknown; blockId?: string | null }) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO data_source_reads (id, created_at, data_source_id, workflow_id, source_name, source_url, trigger_type, status, hash, preview_json, error, trigger_source_id, trigger_payload_json, block_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, new Date().toISOString(), input.dataSourceId, input.workflowId ?? null, input.sourceName, input.sourceUrl, input.triggerType, input.status, input.hash ?? null, input.preview === undefined ? null : JSON.stringify(input.preview), serializeStructuredError(input.error), input.triggerSourceId ?? null, input.triggerPayload === undefined ? null : JSON.stringify(input.triggerPayload), input.blockId ?? null);
  return getDataSourceRead(id)!;
}

export function linkDataSourceReadProof(id: string, proofId: string) {
  db.prepare("UPDATE data_source_reads SET integritas_proof_id = ? WHERE id = ?").run(proofId, id);
  return getDataSourceRead(id)!;
}

/**
 * A source's readings in the order they were recorded, for the marketplace delivery service's live stream (FR-17).
 * after: undefined = start from now (nothing yet; the cursor is the newest read, or "" when there is none);
 * "" = from the first read; an id = after that read. Failed reads move the cursor but are not readings.
 */
export function listSourceReadingsAfter(dataSourceId: string, after: string | undefined, limit = 500) {
  // An unknown cursor (its read was removed by retention, or never existed) also starts from now: replaying the
  // source's whole remaining history as new readings would be wrong (review 2026-11-19).
  const known = after !== undefined && (after === "" || db.prepare("SELECT 1 FROM data_source_reads WHERE id = ? AND data_source_id = ?").get(after, dataSourceId));
  if (!known) {
    const newest = db.prepare("SELECT id FROM data_source_reads WHERE data_source_id = ? ORDER BY rowid DESC LIMIT 1").get(dataSourceId) as { id: string } | undefined;
    return { reads: [], cursor: newest?.id ?? "" };
  }
  const rows = db
    .prepare(
      `SELECT r.id, r.created_at, r.status, r.hash, r.preview_json, p.proof_uid FROM data_source_reads r
       LEFT JOIN integritas_proofs p ON p.id = r.integritas_proof_id
       WHERE r.data_source_id = ? AND r.rowid > coalesce((SELECT rowid FROM data_source_reads WHERE id = ?), 0)
       ORDER BY r.rowid LIMIT ?`
    )
    .all(dataSourceId, after, limit) as { id: string; created_at: string; status: string; hash: string | null; preview_json: string | null; proof_uid: string | null }[];
  return {
    reads: rows
      .filter((r) => r.status === "success")
      .map((r) => ({ id: r.id, createdAt: r.created_at, data: r.preview_json ? (JSON.parse(r.preview_json) as unknown) : null, hash: r.hash, proof: r.proof_uid ? `integritas:uid:${r.proof_uid}` : null })),
    cursor: rows.at(-1)?.id ?? after,
  };
}
