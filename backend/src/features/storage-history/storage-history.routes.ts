import { Router } from "express";
import fs from "node:fs/promises";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { MinimaBackupError, verifyCurrentPassword } from "../minima/minima-backup.service.js";
import { apiErrorFromStatus, unexpected } from "../../shared/api-error.js";
import { buildHistoryArchive } from "./history-archive.service.js";
import { HistoryArchiveImportError, getImportedHistoryArchive, importHistoryArchive, listImportedHistoryArchives } from "./history-archive-import.service.js";
import { getStorageHistoryInventory } from "./storage-history.service.js";
import { upload } from "../integritas/upload.middleware.js";
import { badRequest, notFound } from "../../shared/api-error.js";

export const storageHistoryRouter = Router();

storageHistoryRouter.get("/inventory", (_req, res) => {
  return res.json(getStorageHistoryInventory());
});

storageHistoryRouter.post("/export", requireRole("admin"), async (req, res) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    await verifyCurrentPassword(req.user?.id, currentPassword);
    const archive = buildHistoryArchive();
    const fileName = `edge-studio-history-${archive.exportedAt.replace(/[:.]/g, "-")}.json`;
    recordAuditEvent("storage_history.exported", { userId: req.user?.id });
    return res.attachment(fileName).json(archive);
  } catch (error) {
    if (error instanceof MinimaBackupError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    return unexpected(res, "History export failed", error);
  }
});

storageHistoryRouter.get("/imports", requireRole("admin"), (_req, res) => {
  return res.json({ archives: listImportedHistoryArchives() });
});

storageHistoryRouter.get("/imports/:id", requireRole("admin"), (req, res) => {
  const archive = getImportedHistoryArchive(req.params.id);
  return archive ? res.json(archive) : notFound(res, "Imported history archive not found");
});

storageHistoryRouter.post("/imports", requireRole("admin"), upload.single("file"), async (req, res) => {
  if (!req.file) return badRequest(res, "Choose a history archive file.", { field: "file" });
  try {
    const archive = importHistoryArchive(await fs.readFile(req.file.path, "utf8"));
    recordAuditEvent("storage_history.imported", { userId: req.user?.id });
    return res.status(201).json({ archive });
  } catch (error) {
    if (error instanceof HistoryArchiveImportError) return badRequest(res, error.message, { field: "file" });
    return unexpected(res, "History import failed", error);
  } finally {
    await fs.rm(req.file.path, { force: true });
  }
});
