import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";
import { db } from "../../db/database.js";

type StorageCategory = {
  id: string;
  label: string;
  description: string;
  lifecycle: string;
  recordCount: number | null;
  databaseBytes: number | null;
  fileCount: number | null;
  fileBytes: number | null;
};

type DirectorySize = {
  fileCount: number;
  bytes: number;
  available: boolean;
};

const TABLES_BY_CATEGORY = {
  minimaHistory: ["wallet_transactions", "wallet_send_history"],
  workflowInbox: ["automation_inbox_items"],
  workflowDiagnostics: ["automation_runs", "automation_block_runs"],
  deviceDiagnostics: ["data_source_reads"],
  integritasEvidence: ["integritas_proofs"],
  auditEvents: ["audit_events"],
} as const;

const VERIFICATION_REPORTS_DIR = "integritas-verification-reports";
const EXPORTS_DIR = "exports";

export function getStorageHistoryInventory() {
  const databaseFiles = measureFiles([
    env.databasePath,
    `${env.databasePath}-wal`,
    `${env.databasePath}-shm`,
  ]);
  const captures = measureDirectory(env.cameraCaptureDir);
  const verificationReports = measureDirectory(path.join(env.dataDir, VERIFICATION_REPORTS_DIR));
  const generatedExports = measureDirectory(path.join(env.dataDir, EXPORTS_DIR));
  const tableBytes = getTableBytes();

  const categories: StorageCategory[] = [
    category({
      id: "minima-history",
      label: "Minima history",
      description: "Synced wallet transactions and Edge Studio send history.",
      lifecycle: "Kept until manually removed for a previous wallet.",
      tables: TABLES_BY_CATEGORY.minimaHistory,
      tableBytes,
    }),
    category({
      id: "workflow-inbox",
      label: "Workflow inbox",
      description: "Saved workflow previews and operator-facing output.",
      lifecycle: "Kept until deleted. Deleted items are purged automatically.",
      tables: TABLES_BY_CATEGORY.workflowInbox,
      tableBytes,
    }),
    category({
      id: "workflow-diagnostics",
      label: "Workflow diagnostics",
      description: "Workflow runs and their individual block runs.",
      lifecycle: "Kept until a future history policy is configured.",
      tables: TABLES_BY_CATEGORY.workflowDiagnostics,
      tableBytes,
    }),
    category({
      id: "device-diagnostics",
      label: "Device diagnostics",
      description: "Data-source reads from polls, webhooks, and device events.",
      lifecycle: "Kept until a future history policy is configured.",
      tables: TABLES_BY_CATEGORY.deviceDiagnostics,
      tableBytes,
    }),
    category({
      id: "integritas-evidence",
      label: "Integritas evidence",
      description: "Proof history and saved verification reports.",
      lifecycle: "Kept until explicitly removed.",
      tables: TABLES_BY_CATEGORY.integritasEvidence,
      tableBytes,
      files: verificationReports,
    }),
    category({
      id: "camera-captures",
      label: "Camera captures",
      description: "Photos and videos retained by camera capture workflows.",
      lifecycle: "Managed by the camera retention setting.",
      files: captures,
    }),
    category({
      id: "generated-exports",
      label: "Generated downloads",
      description: "Proof JSON and ZIP files generated for browser downloads.",
      lifecycle: "Not included in future history import.",
      files: generatedExports,
    }),
    category({
      id: "audit-events",
      label: "Audit events",
      description: "Security and administrative event records.",
      lifecycle: "Kept until an audit-retention policy is defined.",
      tables: TABLES_BY_CATEGORY.auditEvents,
      tableBytes,
    }),
  ];

  return {
    totalBytes: databaseFiles.bytes + captures.bytes + verificationReports.bytes + generatedExports.bytes,
    database: {
      databaseBytes: measureFile(env.databasePath),
      walBytes: measureFile(`${env.databasePath}-wal`),
      sharedMemoryBytes: measureFile(`${env.databasePath}-shm`),
      tableAllocationAvailable: tableBytes !== null,
    },
    categories,
  };
}

function category(input: Omit<StorageCategory, "recordCount" | "databaseBytes" | "fileCount" | "fileBytes"> & {
  tables?: readonly string[];
  tableBytes?: Map<string, number> | null;
  files?: DirectorySize;
}): StorageCategory {
  const { tables, tableBytes, files, ...details } = input;
  return {
    ...details,
    recordCount: tables ? countRows(tables) : null,
    databaseBytes: tables && tableBytes ? sumTableBytes(tables, tableBytes) : null,
    fileCount: files ? files.fileCount : null,
    fileBytes: files?.available ? files.bytes : null,
  };
}

function countRows(tables: readonly string[]) {
  return tables.reduce((total, table) => {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    return total + row.count;
  }, 0);
}

function getTableBytes() {
  try {
    const rows = db.prepare("SELECT name, SUM(pgsize) AS bytes FROM dbstat GROUP BY name").all() as { name: string; bytes: number }[];
    return new Map(rows.map((row) => [row.name, row.bytes]));
  } catch {
    return null;
  }
}

function sumTableBytes(tables: readonly string[], tableBytes: Map<string, number>) {
  return tables.reduce((total, table) => {
    const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[];
    return total + (tableBytes.get(table) ?? 0) + indexes.reduce((indexTotal, index) => indexTotal + (tableBytes.get(index.name) ?? 0), 0);
  }, 0);
}

function measureFiles(filePaths: string[]) {
  return { bytes: filePaths.reduce((total, filePath) => total + measureFile(filePath), 0) };
}

function measureFile(filePath: string) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function measureDirectory(directory: string): DirectorySize {
  try {
    let bytes = 0;
    let fileCount = 0;
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const nested = measureDirectory(entryPath);
        bytes += nested.bytes;
        fileCount += nested.fileCount;
        if (!nested.available) return { bytes, fileCount, available: false };
      } else if (entry.isFile()) {
        bytes += fs.statSync(entryPath).size;
        fileCount += 1;
      }
    }
    return { bytes, fileCount, available: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { bytes: 0, fileCount: 0, available: true };
    }
    return { bytes: 0, fileCount: 0, available: false };
  }
}
