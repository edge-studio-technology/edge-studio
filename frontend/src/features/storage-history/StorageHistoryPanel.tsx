import { Download, HardDrive, RefreshCw, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { FileDropBox } from "../../components/patterns/FileDropBox";
import { LoadingState } from "../../components/patterns/LoadingState";
import { ErrorText } from "../../components/Text";
import { CredentialField } from "../../components/ui/CredentialField";
import { Modal } from "../../components/ui/Modal";
import { isAdminCredentialEntryReady } from "../auth/adminCredentials";
import { useAuth } from "../auth/hooks";
import { useToast } from "../../components/ToastProvider";
import { describeLoadFailure } from "../../lib/errors";
import { downloadHistoryArchive, getStorageHistoryInventory, importHistoryArchive, type StorageHistoryCategory, type StorageHistoryInventory } from "./storageHistoryApi";

const historyLinks: Record<string, { to: string; label: string }> = {
  "minima-history": { to: "/wallet", label: "Open wallet history" },
  "workflow-inbox": { to: "/automation", label: "Open workflow inbox" },
  "workflow-diagnostics": { to: "/diagnostics?tab=workflow-runs", label: "Open workflow logs" },
  "device-diagnostics": { to: "/diagnostics?tab=reads", label: "Open device logs" },
  "integritas-evidence": { to: "/diagnostics?tab=proofs", label: "Open Integritas history" },
};

export function StorageHistoryPanel() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [inventory, setInventory] = useState<StorageHistoryInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

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
  }, []);

  async function exportHistory() {
    if (exporting || !isAdminCredentialEntryReady(user?.credentialType ?? null, currentPassword)) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadHistoryArchive(currentPassword);
      setExportOpen(false);
      setCurrentPassword("");
    } catch (exportFailure) {
      setExportError(exportFailure instanceof Error ? exportFailure.message : "History export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function importHistory() {
    if (!importFile || importing) return;
    setImporting(true);
    try {
      const { archive } = await importHistoryArchive(importFile);
      setImportFile(null);
      showToast({ tone: "success", title: "History imported", message: `Imported archive from ${new Date(archive.exportedAt).toLocaleString()}.`, timeoutMs: 6000 });
    } catch (importFailure) {
      showToast({ tone: "error", title: "History import failed", message: importFailure instanceof Error ? importFailure.message : "Choose a valid history archive.", timeoutMs: 9000 });
    } finally {
      setImporting(false);
    }
  }

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
        <Button type="button" variant="secondary" size="sm" iconStart={<Download aria-hidden />} onClick={() => setExportOpen(true)}>
          Export history
        </Button>
        <FileDropBox title="Import history archive" file={importFile} onFile={setImportFile} accept="application/json,.json" busy={importing} />
        {importFile ? <Button type="button" variant="secondary" size="sm" iconStart={<Upload aria-hidden />} disabled={importing} onClick={() => void importHistory()}>{importing ? "Importing…" : "Import history"}</Button> : null}
      </div>

      <div className="grid gap-2">
        {inventory.categories.map((category) => (
          <StorageCategoryRow key={category.id} category={category} tableAllocationAvailable={inventory.database.tableAllocationAvailable} />
        ))}
      </div>

      <p className="type-meta text-text-tertiary m-0">
        Removing records in a future cleanup feature will not always reduce the SQLite file size immediately.
      </p>

      {exportOpen ? (
        <Modal
          title="Export history"
          description="Downloads a read-only history archive. It does not include devices, workflows, contacts, credentials, or Minima backups."
          onClose={() => {
            if (exporting) return;
            setExportOpen(false);
            setCurrentPassword("");
            setExportError(null);
          }}
          closeDisabled={exporting}
          footer={
            <ButtonRow>
              <Button type="button" variant="secondary" disabled={exporting} onClick={() => setExportOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={exporting || !isAdminCredentialEntryReady(user?.credentialType ?? null, currentPassword)}
                onClick={() => void exportHistory()}
              >
                {exporting ? "Exporting…" : "Export history"}
              </Button>
            </ButtonRow>
          }
        >
          <div className="gap-detail-next grid">
            <p className="type-body text-text-secondary m-0">
              Collected payloads are included after secret redaction. The archive is for history viewing and cannot restore active devices or workflows.
            </p>
            <CredentialField
              credentialType={user?.credentialType ?? null}
              label="Current PIN or password"
              value={currentPassword}
              onChange={(value) => {
                setCurrentPassword(value);
                setExportError(null);
              }}
              autoComplete="current-password"
            />
            {exportError ? <ErrorText className="m-0">{exportError}</ErrorText> : null}
          </div>
        </Modal>
      ) : null}
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
