import { useEffect, useState } from "react";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import type { MinimaBackupEntry, MinimaNodeState } from "../../app/types";
import { Button } from "../../components/Button";
import { ButtonRow } from "../../components/ButtonRow";
import { Card } from "../../components/Card";
import { LoadingDots } from "../../components/LoadingDots";
import { Modal } from "../../components/Modal";
import { ErrorText } from "../../components/Text";
import { useToast } from "../../components/ToastProvider";
import {
  createMinimaBackup,
  deleteMinimaBackup,
  downloadMinimaBackup,
  getAutoBackupEnabled,
  listMinimaBackups,
  restoreMinimaBackup,
  restoreMinimaBackupFromUpload,
  setAutoBackupEnabled
} from "./minimaBackupApi";
import { useMinimaStatusRefresh } from "./useMinimaStatusRefresh";

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

type ReauthAction = { kind: "download"; fileName: string } | { kind: "restore" };

export function MinimaBackupPanel() {
  const { showToast } = useToast();
  const [minimaState, setMinimaState] = useState<MinimaNodeState | null>(null);
  useMinimaStatusRefresh(
    (status) => setMinimaState(status.state),
    () => {}
  );
  // Same "confirmed running" gate used by MinimaSettingsPanel/WalletSettingsPanel.
  const actionsBlocked = minimaState !== "running";

  const [backups, setBackups] = useState<MinimaBackupEntry[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabledState] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [createPassword, setCreatePassword] = useState("");
  const [togglingAuto, setTogglingAuto] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const [view, setView] = useState<"list" | "restore">("list");
  const [restoreExistingFile, setRestoreExistingFile] = useState("");
  const [restoreUploadFile, setRestoreUploadFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState("");

  const [reauthAction, setReauthAction] = useState<ReauthAction | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  async function refreshBackups() {
    try {
      const res = await listMinimaBackups();
      setBackups(res.backups);
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Failed to load backups");
    }
  }

  useEffect(() => {
    void refreshBackups();
    getAutoBackupEnabled()
      .then((res) => setAutoBackupEnabledState(res.autoBackupEnabled))
      .catch(() => undefined);
  }, []);

  async function handleCreateBackup() {
    setCreating(true);
    try {
      await createMinimaBackup(createPassword);
      setCreatePassword("");
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

  async function handleDelete(fileName: string) {
    setDeletingFile(fileName);
    try {
      await deleteMinimaBackup(fileName);
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
    setReauthAction({ kind: "download", fileName });
    setReauthPassword("");
    setReauthError(null);
  }

  function startRestoreConfirm() {
    setReauthAction({ kind: "restore" });
    setReauthPassword("");
    setReauthError(null);
  }

  async function confirmReauth() {
    if (!reauthAction) return;
    setReauthBusy(true);
    setReauthError(null);
    try {
      if (reauthAction.kind === "download") {
        await downloadMinimaBackup(reauthAction.fileName, reauthPassword);
      } else {
        if (restoreUploadFile) {
          await restoreMinimaBackupFromUpload({
            file: restoreUploadFile,
            password: restorePassword,
            currentPassword: reauthPassword
          });
        } else {
          await restoreMinimaBackup({
            fileName: restoreExistingFile,
            password: restorePassword,
            currentPassword: reauthPassword
          });
        }
        showToast({
          tone: "success",
          title: "Restore started",
          message: "Minima is restoring and re-syncing from the backup."
        });
        setView("list");
        setRestoreExistingFile("");
        setRestoreUploadFile(null);
        setRestorePassword("");
        await refreshBackups();
      }
      setReauthAction(null);
    } catch (error) {
      setReauthError(error instanceof Error ? error.message : "Invalid current credential");
    } finally {
      setReauthBusy(false);
    }
  }

  const restoreReady = Boolean(restoreUploadFile || restoreExistingFile);

  return (
    <Card>
      <div className="grid gap-1" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Node backup & restore</h3>
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
          Full node backups include the seed phrase, private keys, coin proofs, and transaction
          history — a superset of a plain seed-phrase wallet import.
        </p>
      </div>

      {actionsBlocked && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3" style={{ marginBottom: 16 }}>
          <p className="text-sm text-amber-800" style={{ margin: 0 }}>
            Unavailable until Minima is running.
          </p>
        </div>
      )}

      {view === "list" ? (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Password (optional)</span>
              <input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Leave blank for an unencrypted backup"
                autoComplete="new-password"
              />
            </label>
            <ButtonRow>
              <Button onClick={() => void handleCreateBackup()} disabled={creating || actionsBlocked}>
                {creating ? "Backing up…" : "Backup now"}
              </Button>
              <Button variant="secondary" onClick={() => setView("restore")} disabled={actionsBlocked}>
                Restore from backup
              </Button>
              <Button variant="secondary" disabled title="Restore wallet keys only from a 24-word seed phrase, without needing a backup file — coming in v1.5">
                Import from seed phrase
              </Button>
            </ButtonRow>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className="grid">
              <span className="text-sm font-semibold text-slate-900">Automatic daily backups</span>
              <span className="text-xs text-amber-700">Writes unencrypted backup files on a timer.</span>
            </span>
            <input
              type="checkbox"
              className="size-4 shrink-0 rounded border-slate-300"
              checked={autoBackupEnabled ?? false}
              disabled={autoBackupEnabled === null || togglingAuto || actionsBlocked}
              onChange={() => void handleToggleAutoBackup()}
            />
          </label>

          {listError && <ErrorText className="m-0">{listError}</ErrorText>}
          {!backups && !listError && <LoadingDots />}
          {backups && backups.length === 0 && <p className="text-sm text-slate-500 m-0">No backups yet.</p>}
          {backups && backups.length > 0 && (
            <div className="grid gap-1.5">
              {backups.map((backup) => (
                <div
                  key={backup.fileName}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
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
                      onClick={() => startDownload(backup.fileName)}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      title="Restore"
                      disabled={actionsBlocked}
                      onClick={() => {
                        setView("restore");
                        setRestoreExistingFile(backup.fileName);
                        setRestoreUploadFile(null);
                      }}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      disabled={deletingFile === backup.fileName}
                      onClick={() => void handleDelete(backup.fileName)}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <button
            type="button"
            onClick={() => setView("list")}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors w-fit"
          >
            Back
          </button>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm font-bold text-amber-800 m-0">This will replace the current node state</p>
            <p className="text-sm text-amber-700 mt-1 m-0">
              Restoring re-syncs from the configured MegaMMR host and overwrites the node's current
              wallet and chain state.
            </p>
          </div>

          {restoreUploadFile ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="truncate text-sm text-slate-800">{restoreUploadFile.name}</span>
              <button type="button" onClick={() => setRestoreUploadFile(null)} className="text-xs font-bold text-slate-500">
                Remove
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <Upload size={14} /> Upload a .bak file
              </span>
              <input
                type="file"
                accept=".bak"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setRestoreUploadFile(file);
                  if (file) setRestoreExistingFile("");
                }}
              />
            </label>
          )}

          {!restoreUploadFile && backups && backups.length > 0 && (
            <label className="grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Or choose an existing backup</span>
              <select value={restoreExistingFile} onChange={(e) => setRestoreExistingFile(e.target.value)}>
                <option value="">Select a backup…</option>
                {backups.map((backup) => (
                  <option key={backup.fileName} value={backup.fileName}>
                    {backup.fileName}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Backup password (if set)</span>
            <input type="password" value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} autoComplete="off" />
          </label>

          <ButtonRow>
            <Button onClick={startRestoreConfirm} disabled={!restoreReady || actionsBlocked}>
              Restore
            </Button>
          </ButtonRow>
        </div>
      )}

      {reauthAction && (
        <Modal
          title={reauthAction.kind === "download" ? "Confirm download" : "Confirm restore"}
          onClose={() => {
            if (!reauthBusy) setReauthAction(null);
          }}
          closeDisabled={reauthBusy}
        >
          <div className="grid gap-3">
            <p className="text-sm text-slate-600 m-0">
              {reauthAction.kind === "download"
                ? "This backup file may contain unencrypted key material. Re-enter your current PIN or password to download it."
                : "Re-enter your current PIN or password to confirm the restore."}
            </p>
            <label className="grid gap-1.5 font-bold text-slate-700">
              Current PIN or password
              <input
                type="password"
                value={reauthPassword}
                onChange={(e) => {
                  setReauthPassword(e.target.value);
                  setReauthError(null);
                }}
                autoComplete="current-password"
              />
            </label>
            {reauthError && <ErrorText className="m-0">{reauthError}</ErrorText>}
            <ButtonRow>
              <Button onClick={() => void confirmReauth()} disabled={reauthBusy || reauthPassword.length === 0}>
                {reauthBusy ? "Confirming…" : "Confirm"}
              </Button>
            </ButtonRow>
          </div>
        </Modal>
      )}
    </Card>
  );
}
