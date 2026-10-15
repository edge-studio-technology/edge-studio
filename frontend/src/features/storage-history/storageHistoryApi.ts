import { getJson } from "../../lib/api";

export type StorageHistoryCategory = {
  id: string;
  label: string;
  description: string;
  lifecycle: string;
  recordCount: number | null;
  databaseBytes: number | null;
  fileCount: number | null;
  fileBytes: number | null;
};

export type StorageHistoryInventory = {
  totalBytes: number;
  database: {
    databaseBytes: number;
    walBytes: number;
    sharedMemoryBytes: number;
    tableAllocationAvailable: boolean;
  };
  categories: StorageHistoryCategory[];
};

export function getStorageHistoryInventory() {
  return getJson<StorageHistoryInventory>("/api/storage-history/inventory");
}

export async function downloadHistoryArchive(currentPassword: string) {
  const response = await fetch("/api/storage-history/export", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword }),
  });
  if (!response.ok) {
    const parsed = await response.json().catch(() => ({}));
    throw new Error(typeof parsed.error === "string" ? parsed.error : `HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "edge-studio-history.json";
  link.click();
  URL.revokeObjectURL(url);
}
