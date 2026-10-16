import { db } from "../../db/database.js";
import { redactDeep, redactSecrets } from "../../shared/redact.js";

const ARCHIVE_SCHEMA_VERSION = 1;

type RunRow = Record<string, unknown> & {
  id: string;
  trigger_payload_json: string | null;
  error: string | null;
};

type BlockRunRow = Record<string, unknown> & {
  run_id: string;
  input_json: string | null;
  output_json: string | null;
  error: string | null;
};

type InboxRow = Record<string, unknown> & {
  run_id: string | null;
  content_json: string | null;
  rendered_text: string | null;
};

type DataReadRow = {
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

type ProofRow = Record<string, unknown> & {
  file_name: string | null;
  proof_payload: string | null;
  proof_error: string | null;
};

export function buildHistoryArchive() {
  const walletTransactions = (db.prepare(`
    SELECT txpow_id, token_id, transaction_id, direction, amount, token_name, counterparty,
      time_millis, block, confirmations, confirmed_at, synced_at
    FROM wallet_transactions ORDER BY time_millis ASC, txpow_id ASC, token_id ASC
  `).all() as Record<string, unknown>[]).map((row) => redactDeep(row));
  const walletSendHistory = (db.prepare(`
    SELECT id, created_at, from_account_label, from_account_address, to_address, token_id,
      token_name, amount, txpow_id, transaction_id, status, origin, error
    FROM wallet_send_history ORDER BY created_at ASC, id ASC
  `).all() as Record<string, unknown>[]).map((row) => redactDeep(row));
  const workflowRuns = (db.prepare(`
    SELECT id, workflow_id, workflow_name, started_at, finished_at, status, trigger_type,
      trigger_source_id, trigger_payload_json, duration_ms, block_count, error
    FROM automation_runs ORDER BY started_at ASC, id ASC
  `).all() as RunRow[]).map((row) => ({
    ...row,
    trigger_payload: parseAndRedact(row.trigger_payload_json),
    trigger_payload_json: undefined,
    error: redactNullable(row.error),
  }));
  const workflowBlockRuns = (db.prepare(`
    SELECT id, run_id, workflow_id, block_id, order_index, block_type, block_label, started_at,
      finished_at, status, duration_ms, input_json, output_json, error
    FROM automation_block_runs ORDER BY started_at ASC, id ASC
  `).all() as BlockRunRow[]).map((row) => ({
    ...row,
    input: parseAndRedact(row.input_json),
    output: parseAndRedact(row.output_json),
    input_json: undefined,
    output_json: undefined,
    error: redactNullable(row.error),
  }));
  const workflowInboxItems = (db.prepare(`
    SELECT id, workflow_id, workflow_name, run_id, block_id, title, format, content_json,
      rendered_text, created_at, read_at, deleted_at
    FROM automation_inbox_items ORDER BY created_at ASC, id ASC
  `).all() as InboxRow[]).map((row) => ({
    ...row,
    content: parseAndRedact(row.content_json),
    content_json: undefined,
    rendered_text: redactNullable(row.rendered_text),
  }));
  const dataSourceReads = (db.prepare(`
    SELECT id, created_at, data_source_id, workflow_id, integritas_proof_id, source_name,
      source_url, trigger_type, status, hash, preview_json, error, trigger_source_id,
      trigger_payload_json, block_id
    FROM data_source_reads ORDER BY created_at ASC, id ASC
  `).all() as DataReadRow[]).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    data_source_id: row.data_source_id,
    workflow_id: row.workflow_id,
    integritas_proof_id: row.integritas_proof_id,
    source_name: redactSecrets(row.source_name),
    source_reference: typeof row.source_url === "string" && row.source_url.startsWith("data-source:")
      ? row.source_url
      : null,
    trigger_type: row.trigger_type,
    status: row.status,
    hash: row.hash,
    preview: parseAndRedact(row.preview_json),
    error: redactNullable(row.error),
    trigger_source_id: row.trigger_source_id,
    trigger_payload: parseAndRedact(row.trigger_payload_json),
    block_id: row.block_id,
  }));
  const integritasProofs = (db.prepare(`
    SELECT id, created_at, updated_at, file_name, file_size, hash, proof_uid, proof_status,
      proof_payload, proof_error
    FROM integritas_proofs ORDER BY created_at ASC, id ASC
  `).all() as ProofRow[]).map((row) => ({
    ...row,
    file_name: redactNullable(row.file_name),
    proof_payload: parseAndRedact(row.proof_payload),
    proof_error: redactNullable(row.proof_error),
  }));

  return {
    format: "edge-studio-history",
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    categories: {
      walletTransactions: walletTransactions.length,
      walletSendHistory: walletSendHistory.length,
      workflowRuns: workflowRuns.length,
      workflowBlockRuns: workflowBlockRuns.length,
      workflowInboxItems: workflowInboxItems.length,
      dataSourceReads: dataSourceReads.length,
      integritasProofs: integritasProofs.length,
    },
    records: {
      walletTransactions,
      walletSendHistory,
      workflowRuns,
      workflowBlockRuns,
      workflowInboxItems,
      dataSourceReads,
      integritasProofs,
    },
  };
}

function parseAndRedact(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    return redactDeep(JSON.parse(value));
  } catch {
    return redactSecrets(value);
  }
}

function redactNullable(value: unknown) {
  return typeof value === "string" ? redactSecrets(value) : null;
}
