import { HardDrive, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { LoadingState } from "../../components/patterns/LoadingState";
import { describeLoadFailure } from "../../lib/errors";
import { getStorageHistoryInventory, type StorageHistoryCategory, type StorageHistoryInventory } from "./storageHistoryApi";

const historyLinks: Record<string, { to: string; label: string }> = {
  "minima-history": { to: "/wallet", label: "Open wallet history" },
  "workflow-inbox": { to: "/automation", label: "Open workflow inbox" },
  "workflow-diagnostics": { to: "/diagnostics?tab=workflow-runs", label: "Open workflow logs" },
  "device-diagnostics": { to: "/diagnostics?tab=reads", label: "Open device logs" },
  "integritas-evidence": { to: "/diagnostics?tab=proofs", label: "Open Integritas history" },
};

export function StorageHistoryPanel() {
  const [inventory, setInventory] = useState<StorageHistoryInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setInventory(await getStorageHistoryInventory());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load storage history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- load once when the collapsed settings section opens

  if (loading) {
    return <LoadingState title="Measuring stored history" description="This should take a few seconds." />;
  }

  if (error || !inventory) {
    return (
      <ErrorContentState
        title="Storage history isn't available"
        description={describeLoadFailure(error ?? "Failed to load storage history.")}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <div className="gap-detail-next grid">
      <div className="rounded-soft border-stroke-secondary bg-surface-secondary p-pad-tight gap-detail-tight grid border">
        <div className="gap-detail-close flex items-center justify-between">
          <div className="gap-detail-tight flex items-center">
            <HardDrive className="text-icon-secondary size-4" aria-hidden />
            <p className="type-body-em text-text-primary m-0">Managed application storage</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()} iconStart={<RefreshCw aria-hidden />}>
            Refresh
          </Button>
        </div>
        <p className="type-title text-text-primary m-0">{formatBytes(inventory.totalBytes)}</p>
        <p className="type-meta text-text-secondary m-0">
          SQLite database, managed captures, verification reports, and generated downloads. Docker logs are managed separately.
        </p>
      </div>

      <div className="grid gap-2">
        {inventory.categories.map((category) => (
          <StorageCategoryRow key={category.id} category={category} tableAllocationAvailable={inventory.database.tableAllocationAvailable} />
        ))}
      </div>

      <p className="type-meta text-text-tertiary m-0">
        Removing records in a future cleanup feature will not always reduce the SQLite file size immediately.
      </p>
    </div>
  );
}

function StorageCategoryRow({
  category,
  tableAllocationAvailable,
}: {
  category: StorageHistoryCategory;
  tableAllocationAvailable: boolean;
}) {
  const link = historyLinks[category.id];
  const measures = [
    category.recordCount === null ? null : `${category.recordCount.toLocaleString()} records`,
    category.databaseBytes === null
      ? tableAllocationAvailable ? null : "Database allocation unavailable"
      : `${formatBytes(category.databaseBytes)} in database`,
    category.fileCount === null || category.fileBytes === null
      ? null
      : `${category.fileCount.toLocaleString()} files, ${formatBytes(category.fileBytes)}`,
  ].filter((value): value is string => value !== null);

  return (
    <div className="rounded-soft border-stroke-secondary p-pad-tight gap-detail-tight grid border">
      <div className="gap-detail-close flex flex-wrap items-baseline justify-between">
        <div>
          <p className="type-body-em text-text-primary m-0">{category.label}</p>
          <p className="type-meta text-text-secondary mt-1 mb-0">{category.description}</p>
        </div>
        {link ? <Link className="type-meta text-text-link" to={link.to}>{link.label}</Link> : null}
      </div>
      {measures.length > 0 ? <p className="type-meta text-text-primary m-0">{measures.join(" · ")}</p> : null}
      <p className="type-meta text-text-tertiary m-0">{category.lifecycle}</p>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length);
  return `${(bytes / 1024 ** unit).toFixed(unit === 1 ? 0 : 1)} ${units[unit - 1]}`;
}
