import { Router } from "express";
import { requireRole } from "../auth/auth.middleware.js";
import { badRequest, unauthorized, unexpected } from "../../shared/api-error.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { appendFeedbackSubmission, FeedbackValidationError, getFeedbackConfig, getFeedbackExport, retryPendingFeedback } from "./feedback.service.js";

export const feedbackRouter = Router();

feedbackRouter.get("/config", (_req, res) => {
  return res.json(getFeedbackConfig());
});

feedbackRouter.post("/retry-pending", requireRole("admin"), async (req, res) => {
  if (!req.user) return unauthorized(res);

  try {
    const result = await retryPendingFeedback(req.user);
    recordAuditEvent("feedback.retry_pending", {
      userId: req.user.id,
      detail: JSON.stringify(result),
    });
    return res.json(result);
  } catch (error) {
    console.error("Failed to retry feedback delivery", error);
    return unexpected(res, "Failed to retry feedback delivery", error);
  }
});

feedbackRouter.post("/", async (req, res) => {
  if (!req.user) return unauthorized(res);

  try {
    const result = await appendFeedbackSubmission(req.body, req.user);
    recordAuditEvent("feedback.submit", {
      userId: req.user.id,
      detail: JSON.stringify({ id: result.submission.id, type: result.submission.type, area: result.submission.area, page: result.submission.page })
    });
    return res.status(201).json({ id: result.submission.id, fileName: result.fileName, exportUrl: result.exportUrl, remoteDelivery: result.submission.remoteDelivery });
  } catch (error) {
    if (error instanceof FeedbackValidationError) return badRequest(res, error.message);
    console.error("Failed to save feedback", error);
    return unexpected(res, "Failed to save feedback", error);
  }
});

feedbackRouter.get("/export", (req, res) => {
  if (!req.user) return unauthorized(res);

  try {
    const body = getFeedbackExport(req.user);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="feedback-submissions.json"');
    return res.send(body);
  } catch (error) {
    console.error("Failed to export feedback", error);
    return unexpected(res, "Failed to export feedback", error);
  }
});
