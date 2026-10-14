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
