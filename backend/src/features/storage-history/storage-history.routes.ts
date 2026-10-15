import { Router } from "express";
import { recordAuditEvent } from "../auth/audit.service.js";
import { requireRole } from "../auth/auth.middleware.js";
import { MinimaBackupError, verifyCurrentPassword } from "../minima/minima-backup.service.js";
import { apiErrorFromStatus, unexpected } from "../../shared/api-error.js";
import { buildHistoryArchive } from "./history-archive.service.js";
import { getStorageHistoryInventory } from "./storage-history.service.js";

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
