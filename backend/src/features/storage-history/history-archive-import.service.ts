import { redactDeep } from "../../shared/redact.js";
import { createHistoryArchive, getHistoryArchive, listHistoryArchives, type HistoryArchiveRow } from "./history-archive.repository.js";

const RECORD_KEYS = [
  "walletTransactions",
  "walletSendHistory",
  "workflowRuns",
  "workflowBlockRuns",
  "workflowInboxItems",
  "dataSourceReads",
  "integritasProofs",
] as const;

export class HistoryArchiveImportError extends Error {}

export function importHistoryArchive(serialized: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new HistoryArchiveImportError("Choose a valid Edge Studio history archive.");
  }
  const archive = normalizeArchive(parsed);
  return serializeHistoryArchive(createHistoryArchive({
    exportedAt: archive.exportedAt,
    schemaVersion: archive.schemaVersion,
    categoryCounts: archive.categories,
    archive,
  }));
}

export function listImportedHistoryArchives() {
  return listHistoryArchives().map(serializeHistoryArchive);
}

export function getImportedHistoryArchive(id: string) {
  const row = getHistoryArchive(id);
  return row ? { ...serializeHistoryArchive(row), archive: JSON.parse(row.archive_json) } : undefined;
}

function normalizeArchive(value: unknown) {
  if (!isRecord(value) || value.format !== "edge-studio-history" || value.schemaVersion !== 1 || typeof value.exportedAt !== "string") {
    throw new HistoryArchiveImportError("Choose an Edge Studio history archive version 1.");
  }
  const recordSets = value.records;
  if (!isRecord(recordSets)) throw new HistoryArchiveImportError("Choose an Edge Studio history archive version 1.");
  if (Number.isNaN(new Date(value.exportedAt).getTime())) {
    throw new HistoryArchiveImportError("The archive export date is invalid.");
  }
  const records = Object.fromEntries(RECORD_KEYS.map((key) => {
    const rows = recordSets[key];
    if (!Array.isArray(rows)) throw new HistoryArchiveImportError(`The archive ${key} records are invalid.`);
    return [key, redactDeep(rows)];
  }));
  const categories = Object.fromEntries(RECORD_KEYS.map((key) => [key, records[key].length]));
  return { format: "edge-studio-history", schemaVersion: 1, exportedAt: value.exportedAt, categories, records };
}

function serializeHistoryArchive(row: HistoryArchiveRow) {
  return {
    id: row.id,
    importedAt: row.imported_at,
    exportedAt: row.exported_at,
    schemaVersion: row.schema_version,
    categories: JSON.parse(row.category_counts_json),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
