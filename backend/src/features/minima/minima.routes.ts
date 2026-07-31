import fs from "node:fs/promises";
import { Router } from "express";
import type { Response } from "express";
import { apiErrorFromStatus, badRequest, dependencyUnavailable, notFound, unauthorized, unexpected } from "../../shared/api-error.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { authRateLimiter } from "../auth/rate-limit.middleware.js";
import {
  clearBackupPassword,
  createBackup,
  deleteBackup,
  getAutoBackupEnabled,
  getBackupFilePath,
  hasBackupPassword,
  listBackups,
  MinimaBackupError,
  restoreBackup,
  saveUploadedBackup,
  setAutoBackupEnabled,
  setBackupPassword,
  verifyCurrentPassword
} from "./minima-backup.service.js";
import { getConsoleWhitelist, MinimaConsoleError, runConsoleCommand, updateConsoleWhitelist } from "./minima-console.service.js";
import { backupUpload } from "./minima-upload.middleware.js";
import { normalizeMinimaRpcError } from "./minima.errors.js";
import {
  addMinimaPeers,
  getMinimaConfig,
  getMinimaNodeStatus,
  getMinimaPeers,
  getWalletBalance,
  resyncMegammr,
  restartMinimaContainer,
  saveMinimaConfig
} from "./minima.service.js";

export const minimaRouter = Router();

minimaRouter.get("/config", (_req, res) => {
  res.json(getMinimaConfig());
});

minimaRouter.post("/config", (req, res) => {
  try {
    const megammrHost = typeof req.body?.megammrHost === "string" ? req.body.megammrHost : "";
    res.json(saveMinimaConfig({ megammrHost }));
  } catch (error) {
    badRequest(res, error instanceof Error ? error.message : "Invalid Minima configuration");
  }
});

minimaRouter.get("/status", async (_req, res) => {
  try {
    res.json(await getMinimaNodeStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    dependencyUnavailable(res, message, message);
  }
});

minimaRouter.get("/peers", async (_req, res) => {
  try {
    const result = await getMinimaPeers();
    if (!result.ok) return dependencyUnavailable(res, "Failed to get Minima peers", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false });
  }
});

minimaRouter.post("/peers/add", requireRole("admin"), async (req, res) => {
  try {
    const peerslist = typeof req.body?.peerslist === "string" ? req.body.peerslist : "";
    const result = await addMinimaPeers(peerslist);
    recordAuditEvent("minima.peers.add", {
      userId: req.user?.id,
      detail: peerslist.trim()
    });
    if (!result.ok) return dependencyUnavailable(res, "Failed to add Minima peers", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    const message = normalizeMinimaRpcError(error instanceof Error ? error.message : "Unknown error");
    badRequest(res, message, undefined, { ok: false });
  }
});

minimaRouter.post("/restart", requireRole("admin"), async (req, res) => {
  try {
    const result = await restartMinimaContainer();
    recordAuditEvent("minima.container.restart", {
      userId: req.user?.id,
      detail: result.containerId
    });
    res.json(result);
  } catch (error) {
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false });
  }
});

minimaRouter.get("/balance", async (_req, res) => {
  try {
    const result = await getWalletBalance();
    if (!result.ok) return dependencyUnavailable(res, "Failed to get wallet balance", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false, source: "minima" });
  }
});

minimaRouter.post("/megammrsync/resync", async (_req, res) => {
  try {
    const result = await resyncMegammr();
    if (!result.ok) return dependencyUnavailable(res, "Megammr resync failed", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false, source: "minima" });
  }
});

minimaRouter.get("/console/whitelist", requireRole("admin"), (_req, res) => {
  res.json(getConsoleWhitelist());
});

minimaRouter.post("/console/whitelist", requireRole("admin"), authRateLimiter, async (req, res) => {
  if (!req.user) return unauthorized(res);
  try {
    const enabledKeys = Array.isArray(req.body?.enabledKeys) ? req.body.enabledKeys : [];
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const result = await updateConsoleWhitelist(req.user.id, { enabledKeys, currentPassword });
    res.json(result);
  } catch (error) {
    if (error instanceof MinimaConsoleError) {
      // errorCode marks this as a re-auth failure, not an expired session — without it the
      // frontend's shared 401 handler (frontend/src/lib/api.ts) treats any bare 401 as a dead
      // session and force-logs-out, even though the session cookie is still valid.
      const extra = error.status === 401 ? { errorCode: "invalid_credential" } : {};
      return apiErrorFromStatus(res, error.status, error.message, extra);
    }
    unexpected(res, "Failed to update console whitelist", error);
  }
});

minimaRouter.post("/console/run", requireRole("admin"), async (req, res) => {
  try {
    const command = typeof req.body?.command === "string" ? req.body.command : "";
    const result = await runConsoleCommand(req.user?.id, command);
    res.json(result);
  } catch (error) {
    if (error instanceof MinimaConsoleError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    const nativeMessage = error instanceof Error ? error.message : "Unknown error";
    const message = normalizeMinimaRpcError(nativeMessage);
    dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false, source: "minima" });
  }
});

function handleMinimaBackupError(res: Response, error: unknown) {
  if (error instanceof MinimaBackupError) {
    // errorCode marks this as a re-auth failure, not an expired session — see the same
    // note on POST /console/whitelist above.
    const extra = error.status === 401 ? { errorCode: "invalid_credential" } : {};
    return apiErrorFromStatus(res, error.status, error.message, extra);
  }
  const nativeMessage = error instanceof Error ? error.message : "Unknown error";
  const message = normalizeMinimaRpcError(nativeMessage);
  return dependencyUnavailable(res, message, nativeMessage, undefined, { ok: false, source: "minima" });
}

minimaRouter.get("/backups", requireRole("admin"), async (_req, res) => {
  try {
    res.json(await listBackups());
  } catch (error) {
    unexpected(res, "Failed to list Minima backups", error);
  }
});

minimaRouter.get("/backups/password", requireRole("admin"), (_req, res) => {
  res.json({ hasPassword: hasBackupPassword() });
});

minimaRouter.post("/backups/password", requireRole("admin"), authRateLimiter, async (req, res) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    await verifyCurrentPassword(req.user?.id, currentPassword);
    const backupPassword = typeof req.body?.backupPassword === "string" ? req.body.backupPassword : "";
    setBackupPassword(backupPassword);
    recordAuditEvent("minima.backup.password_set", { userId: req.user?.id });
    res.json({ hasPassword: true });
  } catch (error) {
    handleMinimaBackupError(res, error);
  }
});

minimaRouter.delete("/backups/password", requireRole("admin"), authRateLimiter, async (req, res) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    await verifyCurrentPassword(req.user?.id, currentPassword);
    clearBackupPassword();
    recordAuditEvent("minima.backup.password_cleared", { userId: req.user?.id });
    res.json({ hasPassword: false });
  } catch (error) {
    handleMinimaBackupError(res, error);
  }
});

minimaRouter.post("/backups", requireRole("admin"), async (req, res) => {
  try {
    const result = await createBackup({ auto: false });
    recordAuditEvent("minima.backup.created", { userId: req.user?.id, detail: result.fileName });
    if (!result.ok) return dependencyUnavailable(res, "Backup failed", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    handleMinimaBackupError(res, error);
  }
});

minimaRouter.post("/backups/:fileName/download", requireRole("admin"), async (req, res) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    await verifyCurrentPassword(req.user?.id, currentPassword);
    const filePath = await getBackupFilePath(req.params.fileName);
    recordAuditEvent("minima.backup.downloaded", { userId: req.user?.id, detail: req.params.fileName });
    res.download(filePath, req.params.fileName);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT" || (error as NodeJS.ErrnoException)?.code === "OUTSIDE_ROOT") {
      return notFound(res, "Backup file not found");
    }
    handleMinimaBackupError(res, error);
  }
});

minimaRouter.post("/backups/restore", requireRole("admin"), backupUpload.single("file"), async (req, res) => {
  // An uploaded file is a one-time restore source, not a permanently tracked/classified
  // entry (we don't know if it's encrypted), so it's removed from the shared folder after
  // the restore attempt either way instead of lingering and confusing the two lists above.
  let uploadedFileName: string | null = null;
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    await verifyCurrentPassword(req.user?.id, currentPassword);

    const password = typeof req.body?.password === "string" ? req.body.password : undefined;
    const fileName = req.file
      ? (uploadedFileName = await saveUploadedBackup(req.file.path, req.file.originalname))
      : typeof req.body?.fileName === "string"
        ? req.body.fileName
        : "";
    if (!fileName) return badRequest(res, "fileName or an uploaded backup file is required");

    const result = await restoreBackup({ fileName, password });
    recordAuditEvent("minima.backup.restored", { userId: req.user?.id, detail: fileName });
    if (!result.ok) return dependencyUnavailable(res, "Restore failed", undefined, undefined, result);
    res.json(result);
  } catch (error) {
    if (req.file && !uploadedFileName) await fs.rm(req.file.path, { force: true });
    handleMinimaBackupError(res, error);
  } finally {
    if (uploadedFileName) await deleteBackup(uploadedFileName).catch(() => undefined);
  }
});

minimaRouter.delete("/backups/:fileName", requireRole("admin"), async (req, res) => {
  try {
    await deleteBackup(req.params.fileName);
    recordAuditEvent("minima.backup.deleted", { userId: req.user?.id, detail: req.params.fileName });
    res.json({ ok: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT" || (error as NodeJS.ErrnoException)?.code === "OUTSIDE_ROOT") {
      return notFound(res, "Backup file not found");
    }
    unexpected(res, "Failed to delete Minima backup", error);
  }
});

minimaRouter.get("/backups/auto", requireRole("admin"), (_req, res) => {
  res.json({ autoBackupEnabled: getAutoBackupEnabled() });
});

minimaRouter.post("/backups/auto", requireRole("admin"), (req, res) => {
  try {
    const enabled = req.body?.enabled === true;
    const result = setAutoBackupEnabled(enabled);
    recordAuditEvent("minima.backup.auto_toggled", { userId: req.user?.id, detail: String(enabled) });
    res.json(result);
  } catch (error) {
    handleMinimaBackupError(res, error);
  }
});
