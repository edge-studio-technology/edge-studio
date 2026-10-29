import crypto from "node:crypto";
import { db } from "../../db/database.js";

export type HistoryArchiveRow = {
  id: string;
  imported_at: string;
  exported_at: string;
  schema_version: number;
  category_counts_json: string;
  archive_json: string;
};

export function createHistoryArchive(input: { exportedAt: string; schemaVersion: number; categoryCounts: unknown; archive: unknown }) {
  const id = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO history_archives (id, imported_at, exported_at, schema_version, category_counts_json, archive_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, importedAt, input.exportedAt, input.schemaVersion, JSON.stringify(input.categoryCounts), JSON.stringify(input.archive));
  return getHistoryArchive(id)!;
}

export function listHistoryArchives() {
  return db.prepare(`
    SELECT id, imported_at, exported_at, schema_version, category_counts_json, archive_json
    FROM history_archives ORDER BY imported_at DESC, id DESC
  `).all() as HistoryArchiveRow[];
}

export function getHistoryArchive(id: string) {
  return db.prepare(`
    SELECT id, imported_at, exported_at, schema_version, category_counts_json, archive_json
    FROM history_archives WHERE id = ?
  `).get(id) as HistoryArchiveRow | undefined;
}
