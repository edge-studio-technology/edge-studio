import { Router } from "express";
import { env } from "../../config/env.js";
import { apiErrorFromStatus, unauthorized, unexpected, validationFailed } from "../../shared/api-error.js";
import { requireRole } from "./auth.middleware.js";
import { getSessionSettings, saveSessionSettings, SESSION_LIMITS, SessionSettingsError } from "./session-settings.service.js";
import { login, changePassword, AuthSettingsError } from "./auth.service.js";
import { recordAuditEvent } from "./audit.service.js";
import { authRateLimiter } from "./rate-limit.middleware.js";
import { deleteSession, sessionClearCookieOptions, sessionCookieOptions } from "./session.service.js";

export const authPublicRouter = Router();
export const authProtectedRouter = Router();

authProtectedRouter.get("/settings/session", requireRole("admin"), (_req, res) => {
  try {
    return res.json({ settings: getSessionSettings(), limits: SESSION_LIMITS });
  } catch (error) {
    return unexpected(res, "Session settings could not be loaded.", error);
  }
});

authProtectedRouter.post("/settings/session", requireRole("admin"), authRateLimiter, async (req, res) => {
  try {
    const result = await saveSessionSettings(req.user!.id, req.body?.settings,
      typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "",
      typeof req.cookies?.[env.sessionCookieName] === "string" ? req.cookies[env.sessionCookieName] : "");
    if (result.currentSessionExpired) res.clearCookie(env.sessionCookieName, sessionClearCookieOptions());
    return res.json(result);
  } catch (error) {
    if (error instanceof SessionSettingsError) {
      if (error.fieldErrors) return validationFailed(res, error.message, error.fieldErrors);
      return apiErrorFromStatus(res, error.status, error.message);
    }
    return unexpected(res, "Session settings could not be saved.", error);
  }
});

authPublicRouter.post("/login", authRateLimiter, async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const result = await login({ password });
  if (!result.ok) {
    return unauthorized(res, "Invalid credentials");
  }

  res.cookie(env.sessionCookieName, result.sessionToken, sessionCookieOptions());
  return res.json({ success: true, user: result.user });
});

authProtectedRouter.post("/logout", (req, res) => {
  const rawToken = req.cookies?.[env.sessionCookieName] as string | undefined;
  if (rawToken) {
    deleteSession(rawToken);
    if (req.user) {
      recordAuditEvent("logout", { userId: req.user.id, detail: req.user.displayName });
    }
  }

  res.clearCookie(env.sessionCookieName, sessionClearCookieOptions());
  return res.json({ success: true });
});

authProtectedRouter.get("/me", (req, res) => {
  if (!req.user) {
    return unauthorized(res);
  }

  return res.json({
    displayName: req.user.displayName,
    role: req.user.role,
    lastLogin: req.user.lastLogin,
    credentialType: req.user.credentialType,
  });
});

authProtectedRouter.post("/settings/password", authRateLimiter, async (req, res) => {
  if (!req.user) return unauthorized(res);
  try {
    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    await changePassword(req.user.id, { currentPassword, newPassword });
    // Every session was revoked, including this one — drop the now-dead cookie.
    res.clearCookie(env.sessionCookieName, sessionClearCookieOptions());
    return res.json({ success: true, sessionsRevoked: true });
  } catch (error) {
    if (error instanceof AuthSettingsError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    return unexpected(res, "Failed to change credential", error);
  }
});
