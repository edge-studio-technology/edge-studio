import { Router } from "express";
import { requireRole } from "../auth/auth.middleware.js";
import { conflict, unexpected, validationFailed } from "../../shared/api-error.js";
import {
  getRetentionDiskUsage,
  getRetentionSettings,
  previewRetentionSettings,
  RETENTION_LIMITS,
  RetentionPreviewConflict,
  RetentionValidationError,
  saveRetentionSettings,
} from "./retention-settings.service.js";

export const retentionRouter = Router();
retentionRouter.use(requireRole("admin"));

retentionRouter.get("/settings", (_req, res) => {
  try {
    const settings = getRetentionSettings();
    res.json({
      ...previewRetentionSettings(settings),
      limits: RETENTION_LIMITS,
      diskUsage: getRetentionDiskUsage(settings.diskWarningPercent),
    });
  } catch (error) {
    unexpected(res, "Retention settings could not be loaded.", error);
  }
});

retentionRouter.post("/settings/preview", (req, res) => {
  try {
    res.json(previewRetentionSettings(req.body));
  } catch (error) {
    if (error instanceof RetentionValidationError)
      return validationFailed(res, error.message, error.fieldErrors);
    unexpected(res, "Retention preview could not be loaded.", error);
  }
});

retentionRouter.post("/settings", (req, res) => {
  try {
    res.json(
      saveRetentionSettings(
        req.body?.settings,
        req.body?.previewToken,
        req.body?.confirmed,
        req.user?.id,
      ),
    );
  } catch (error) {
    if (error instanceof RetentionValidationError)
      return validationFailed(res, error.message, error.fieldErrors);
    if (error instanceof RetentionPreviewConflict) return conflict(res, error.message);
    unexpected(res, "Retention settings could not be saved.", error);
  }
});
