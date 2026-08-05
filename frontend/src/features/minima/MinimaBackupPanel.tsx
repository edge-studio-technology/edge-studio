import { useEffect, useState } from "react";
import { Download, KeyRound, RotateCcw, Trash2, Upload } from "lucide-react";
import type { MinimaBackupEntry, MinimaBackupListResponse, MinimaNodeState } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Card } from "../../components/Card";
import { LoadingDots } from "../../components/LoadingDots";
import { Modal } from "../../components/Modal";
import { FileDropZone } from "../../components/patterns/FileDropZone";
import { ListDisclosure } from "../../components/patterns/ListDisclosure";
import { ErrorText } from "../../components/Text";
import { useToast } from "../../components/ToastProvider";
import { CheckboxField } from "../../components/ui/CheckboxField";
import { InputField } from "../../components/ui/InputField";
import {
  clearBackupPassword,
  createMinimaBackup,
  deleteMinimaBackup,
  downloadMinimaBackup,
  getAutoBackupEnabled,
  getBackupPasswordStatus,
  listMinimaBackups,
  restoreMinimaBackup,
  restoreMinimaBackupFromUpload,
  setAutoBackupEnabled,
  setBackupPassword
} from "./minimaBackupApi";

const MAX_BACKUPS = 20;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCreatedAt(iso: string) {
  const date = new Date(iso);
  const utc = date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  return `${date.toLocaleString()} local · ${utc}`;
}

const restoreWarning = (
  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
    <p className="text-sm font-bold text-amber-800 m-0">This will replace the current node state</p>
    <p className="text-sm text-amber-700 mt-1 m-0">
      Restoring re-syncs from the configured MegaMMR host and overwrites the node's current wallet and chain state.
    </p>
  </div>
);

function BackupRow({
  backup,
  actionsBlocked,
  deleting,
  onDownload,
  onRestore,
  onDelete
}: {
  backup: MinimaBackupEntry;
  actionsBlocked: boolean;
  deleting: boolean;
  onDownload: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 m-0">{backup.fileName}</p>
        <p className="text-xs text-slate-500 m-0">
          {formatSize(backup.sizeBytes)} · {formatCreatedAt(backup.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          title="Download"
          onClick={onDownload}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
        >
          <Download size={14} />
        </button>
        <button
          type="button"
          title="Restore"
          disabled={actionsBlocked}
          onClick={onRestore}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          title="Delete"
          disabled={deleting}
          onClick={onDelete}
          className="rounded-lg border border-slate-200 bg-white p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function MinimaBackupPanel({
  bare = false,
  minimaState,
}: {
  bare?: boolean;
  minimaState: MinimaNodeState | null;
}) {
  const { showToast } = useToast();
  // Same "confirmed running" gate used by MinimaSettingsPanel/WalletSettingsPanel.
  const actionsBlocked = minimaState !== "running";

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newBackupPassword, setNewBackupPassword] = useState("");
  const [setupCurrentPassword, setSetupCurrentPassword] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [clearPasswordOpen, setClearPasswordOpen] = useState(false);
  const [clearPasswordCurrentPassword, setClearPasswordCurrentPassword] = useState("");
  const [clearPasswordBusy, setClearPasswordBusy] = useState(false);
  const [clearPasswordError, setClearPasswordError] = useState<string | null>(null);

  const [backups, setBackups] = useState<MinimaBackupListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabledState] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MinimaBackupEntry | null>(null);

  const [downloadTarget, setDownloadTarget] = useState<string | null>(null);
  const [downloadPassword, setDownloadPassword] = useState("");
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [uploadRestoreOpen, setUploadRestoreOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPasswordOverride, setUploadPasswordOverride] = useState("");
  const [uploadCurrentPassword, setUploadCurrentPassword] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [rowRestoreTarget, setRowRestoreTarget] = useState<MinimaBackupEntry | null>(null);
  const [rowRestorePassword, setRowRestorePassword] = useState("");
  const [rowRestoreBusy, setRowRestoreBusy] = useState(false);
  const [rowRestoreError, setRowRestoreError] = useState<string | null>(null);

  async function refreshBackups() {
    try {
      const res = await listMinimaBackups();
      setBackups(res);
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Failed to load backups");
    }
  }

  useEffect(() => {
    void refreshBackups();
    getBackupPasswordStatus()
      .then((res) => setHasPassword(res.hasPassword))
      .catch(() => setHasPassword(false));
    getAutoBackupEnabled()
      .then((res) => setAutoBackupEnabledState(res.autoBackupEnabled))
      .catch(() => undefined);
  }, []);

  function openPasswordModal() {
    setPasswordModalOpen(true);
    setNewBackupPassword("");
    setSetupCurrentPassword("");
    setSetupError(null);
  }

  async function handleSetBackupPassword(e: React.FormEvent) {
    e.preventDefault();
    setSetupBusy(true);
    setSetupError(null);
    try {
      const res = await setBackupPassword({ backupPassword: newBackupPassword, currentPassword: setupCurrentPassword });
      setHasPassword(res.hasPassword);
      setPasswordModalOpen(false);
      showToast({ tone: "success", title: "Backup password saved", message: "Used for every manual and automatic backup from now on." });
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to set backup password");
    } finally {
      setSetupBusy(false);
    }
  }

  function openClearPassword() {
    setPasswordModalOpen(false);
    setClearPasswordOpen(true);
    setClearPasswordCurrentPassword("");
    setClearPasswordError(null);
  }

  async function confirmClearPassword() {
    setClearPasswordBusy(true);
    setClearPasswordError(null);
    try {
      const res = await clearBackupPassword(clearPasswordCurrentPassword);
      setHasPassword(res.hasPassword);
      setAutoBackupEnabledState(false);
      setClearPasswordOpen(false);
      showToast({ tone: "success", title: "Backup password removed", message: "Automatic backups have been turned off." });
    } catch (error) {
      setClearPasswordError(error instanceof Error ? error.message : "Invalid current credential");
    } finally {
      setClearPasswordBusy(false);
    }
  }

  async function handleCreateBackup() {
    setCreating(true);
    try {
      await createMinimaBackup();
      showToast({ tone: "success", title: "Backup created", message: "Minima wrote a new backup file." });
      await refreshBackups();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Backup failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timeoutMs: 9000
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleAutoBackup() {
    if (autoBackupEnabled === null) return;
    setTogglingAuto(true);
    try {
      const res = await setAutoBackupEnabled(!autoBackupEnabled);
      setAutoBackupEnabledState(res.autoBackupEnabled);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Failed to update auto-backup",
        message: error instanceof Error ? error.message : "Unknown error",
        timeoutMs: 9000
      });
    } finally {
      setTogglingAuto(false);
    }
  }

  function startDelete(backup: MinimaBackupEntry) {
    setDeleteTarget(backup);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const fileName = deleteTarget.fileName;
    setDeletingFile(fileName);
    try {
      await deleteMinimaBackup(fileName);
      setDeleteTarget(null);
      await refreshBackups();
    } catch (error) {
      showToast({
        tone: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timeoutMs: 9000
      });
    } finally {
      setDeletingFile(null);
    }
  }

  function startDownload(fileName: string) {
    setDownloadTarget(fileName);
    setDownloadPassword("");
    setDownloadError(null);
  }

  async function confirmDownload() {
    if (!downloadTarget) return;
    setDownloadBusy(true);
    setDownloadError(null);
    try {
      await downloadMinimaBackup(downloadTarget, downloadPassword);
      setDownloadTarget(null);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Invalid current credential");
    } finally {
      setDownloadBusy(false);
    }
  }

  function openUploadRestore() {
    setUploadRestoreOpen(true);
    setUploadFile(null);
    setUploadPasswordOverride("");
    setUploadCurrentPassword("");
    setUploadError(null);
  }

  async function confirmUploadRestore() {
    if (!uploadFile) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      await restoreMinimaBackupFromUpload({
        file: uploadFile,
        password: uploadPasswordOverride,
        currentPassword: uploadCurrentPassword
      });
      showToast({ tone: "success", title: "Restore started", message: "Minima is restoring and re-syncing from the backup." });
      setUploadRestoreOpen(false);
      await refreshBackups();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Invalid current credential");
    } finally {
      setUploadBusy(false);
    }
  }

  function startRowRestore(backup: MinimaBackupEntry) {
    setRowRestoreTarget(backup);
    setRowRestorePassword("");
    setRowRestoreError(null);
  }

  async function confirmRowRestore() {
    if (!rowRestoreTarget) return;
    setRowRestoreBusy(true);
    setRowRestoreError(null);
    try {
      await restoreMinimaBackup({ fileName: rowRestoreTarget.fileName, currentPassword: rowRestorePassword });
      showToast({ tone: "success", title: "Restore started", message: "Minima is restoring and re-syncing from the backup." });
      setRowRestoreTarget(null);
      await refreshBackups();
    } catch (error) {
      setRowRestoreError(error instanceof Error ? error.message : "Invalid current credential");
    } finally {
      setRowRestoreBusy(false);
    }
  }

  const content = (
    <>
      <div className="mb-4 grid gap-1">
        {!bare && <h3 style={{ margin: 0 }}>Node backup & restore</h3>}
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
          Full node backups include the seed phrase, private keys, coin proofs, and transaction
          history — a superset of a plain seed-phrase wallet import.
        </p>
      </div>

      {hasPassword === false && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="text-sm text-amber-800 m-0">
            No backup password set. Use the key icon below to set one — required for manual and automatic backups.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleCreateBackup()} disabled={creating || actionsBlocked || !hasPassword}>
            {creating ? "Backing up…" : "Backup now"}
          </Button>
          <button
            type="button"
            title={hasPassword ? "Manage backup password" : "Set backup password"}
            onClick={openPasswordModal}
            className={`rounded-lg border p-2 hover:bg-slate-50 ${
              hasPassword === false ? "border-amber-300 text-amber-700 bg-amber-50" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <KeyRound size={16} />
          </button>
          <button
            type="button"
            title="Restore from backup"
            onClick={openUploadRestore}
            disabled={actionsBlocked}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Upload size={16} />
          </button>

          <CheckboxField
            className="shrink-0"
            label="Auto backups (nightly)"
            checked={autoBackupEnabled ?? false}
            disabled={autoBackupEnabled === null || togglingAuto || actionsBlocked || !hasPassword}
            onChange={() => void handleToggleAutoBackup()}
          />
        </div>

        <p className="m-0 text-xs text-slate-500">
          Auto backup runs nightly at 00:30 and keeps the last {MAX_BACKUPS}, deleting the oldest.
        </p>

        {listError && <ErrorText className="m-0">{listError}</ErrorText>}
        {!backups && !listError && <LoadingDots />}

        {backups && (
          <ListDisclosure title="Backups" count={backups.length} max={MAX_BACKUPS}>
            {backups.length === 0 && <p className="m-0 px-3 py-2 text-sm text-slate-500">None yet.</p>}
            {backups.map((backup) => (
              <BackupRow
                key={backup.fileName}
                backup={backup}
                actionsBlocked={actionsBlocked}
                deleting={deletingFile === backup.fileName}
                onDownload={() => startDownload(backup.fileName)}
                onRestore={() => startRowRestore(backup)}
                onDelete={() => startDelete(backup)}
              />
            ))}
          </ListDisclosure>
        )}
      </div>

      {downloadTarget && (
        <Modal
          title="Confirm download"
          onClose={() => {
            if (!downloadBusy) setDownloadTarget(null);
          }}
          closeDisabled={downloadBusy}
          bodyClassName="min-h-0 flex-1"
        >
          <div className="grid gap-3">
            <p className="text-sm text-slate-600 m-0">Re-enter your current PIN or password to download this backup.</p>
            <InputField
              label="Current PIN or password"
              type="password"
              value={downloadPassword}
              onChange={(e) => {
                setDownloadPassword(e.target.value);
                setDownloadError(null);
              }}
              autoComplete="current-password"
            />
            {downloadError && <ErrorText className="m-0">{downloadError}</ErrorText>}
            <ButtonRow>
              <Button onClick={() => void confirmDownload()} disabled={downloadBusy || downloadPassword.length === 0}>
                {downloadBusy ? "Confirming…" : "Confirm"}
              </Button>
            </ButtonRow>
          </div>
        </Modal>
      )}

      {passwordModalOpen && (
        <Modal
          title={hasPassword ? "Manage backup password" : "Set backup password"}
          onClose={() => {
            if (!setupBusy) setPasswordModalOpen(false);
          }}
          closeDisabled={setupBusy}
          bodyClassName="min-h-0 flex-1"
        >
          <form onSubmit={(e) => void handleSetBackupPassword(e)} className="grid gap-3">
            {hasPassword === false && (
              <p className="text-sm text-slate-600 m-0">
                One password protects every manual and automatic backup. It's stored encrypted; nothing about it is
                ever shown again, so keep a copy somewhere safe.
              </p>
            )}
            <InputField
              label={hasPassword ? "New backup password" : "Backup password"}
              type="password"
              value={newBackupPassword}
              onChange={(e) => setNewBackupPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <InputField
              label="Current PIN or password"
              type="password"
              value={setupCurrentPassword}
              onChange={(e) => setSetupCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {setupError && <ErrorText className="m-0">{setupError}</ErrorText>}
            <ButtonRow>
              <Button type="submit" disabled={setupBusy || !newBackupPassword || !setupCurrentPassword}>
                {setupBusy ? "Saving…" : hasPassword ? "Update backup password" : "Save backup password"}
              </Button>
              {hasPassword === true && (
                <Button variant="danger" type="button" onClick={openClearPassword} disabled={setupBusy}>
                  Remove backup password
                </Button>
              )}
            </ButtonRow>
          </form>
        </Modal>
      )}

      {uploadRestoreOpen && (
        <Modal
          title="Restore from backup"
          onClose={() => {
            if (!uploadBusy) setUploadRestoreOpen(false);
          }}
          closeDisabled={uploadBusy}
          bodyClassName="min-h-0 flex-1"
        >
          <div className="grid gap-3">
            {restoreWarning}

            <FileDropZone
              file={uploadFile}
              onFile={setUploadFile}
              onClear={() => setUploadFile(null)}
              accept=".bak"
              placeholder="Upload a .bak file"
            />

            <InputField
              label="Password override (leave blank to use your saved backup password)"
              type="password"
              value={uploadPasswordOverride}
              onChange={(e) => setUploadPasswordOverride(e.target.value)}
              autoComplete="off"
            />

            <InputField
              label="Current PIN or password"
              type="password"
              value={uploadCurrentPassword}
              onChange={(e) => {
                setUploadCurrentPassword(e.target.value);
                setUploadError(null);
              }}
              autoComplete="current-password"
            />

            {uploadError && <ErrorText className="m-0">{uploadError}</ErrorText>}
            <ButtonRow>
              <Button
                onClick={() => void confirmUploadRestore()}
                disabled={uploadBusy || !uploadFile || uploadCurrentPassword.length === 0}
              >
                {uploadBusy ? "Restoring…" : "Restore"}
              </Button>
            </ButtonRow>
          </div>
        </Modal>
      )}

      {rowRestoreTarget && (
        <Modal
          title="Confirm restore"
          onClose={() => {
            if (!rowRestoreBusy) setRowRestoreTarget(null);
          }}
          closeDisabled={rowRestoreBusy}
          bodyClassName="min-h-0 flex-1"
        >
          <div className="grid gap-3">
            {restoreWarning}
            <p className="text-sm text-slate-600 m-0">
              Restoring <span className="font-mono">{rowRestoreTarget.fileName}</span>. Re-enter your current PIN or
              password to confirm.
            </p>
            <InputField
              label="Current PIN or password"
              type="password"
              value={rowRestorePassword}
              onChange={(e) => {
                setRowRestorePassword(e.target.value);
                setRowRestoreError(null);
              }}
              autoComplete="current-password"
            />
            {rowRestoreError && <ErrorText className="m-0">{rowRestoreError}</ErrorText>}
            <ButtonRow>
              <Button onClick={() => void confirmRowRestore()} disabled={rowRestoreBusy || rowRestorePassword.length === 0}>
                {rowRestoreBusy ? "Restoring…" : "Confirm restore"}
              </Button>
            </ButtonRow>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete backup"
          onClose={() => {
            if (deletingFile !== deleteTarget.fileName) setDeleteTarget(null);
          }}
          closeDisabled={deletingFile === deleteTarget.fileName}
          bodyClassName="min-h-0 flex-1"
        >
          <div className="grid gap-3">
            <p className="text-sm text-slate-600 m-0">
              Delete <span className="font-mono">{deleteTarget.fileName}</span>? This can't be undone.
            </p>
            <ButtonRow>
              <Button variant="danger" onClick={() => void confirmDelete()} disabled={deletingFile === deleteTarget.fileName}>
                {deletingFile === deleteTarget.fileName ? "Deleting…" : "Delete backup"}
              </Button>
            </ButtonRow>
          </div>
        </Modal>
      )}

      {clearPasswordOpen && (
        <Modal
          title="Remove backup password"
          onClose={() => {
            if (!clearPasswordBusy) setClearPasswordOpen(false);
          }}
          closeDisabled={clearPasswordBusy}
          bodyClassName="min-h-0 flex-1"
        >
          <div className="grid gap-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm font-bold text-amber-800 m-0">This turns off automatic backups</p>
              <p className="text-sm text-amber-700 mt-1 m-0">
                You'll need to set a new backup password before creating another backup.
              </p>
            </div>
            <InputField
              label="Current PIN or password"
              type="password"
              value={clearPasswordCurrentPassword}
              onChange={(e) => {
                setClearPasswordCurrentPassword(e.target.value);
                setClearPasswordError(null);
              }}
              autoComplete="current-password"
            />
            {clearPasswordError && <ErrorText className="m-0">{clearPasswordError}</ErrorText>}
            <ButtonRow>
              <Button
                variant="danger"
                onClick={() => void confirmClearPassword()}
                disabled={clearPasswordBusy || clearPasswordCurrentPassword.length === 0}
              >
                {clearPasswordBusy ? "Removing…" : "Remove password"}
              </Button>
            </ButtonRow>
          </div>
        </Modal>
      )}
    </>
  );

  return bare ? content : <Card>{content}</Card>;
}
