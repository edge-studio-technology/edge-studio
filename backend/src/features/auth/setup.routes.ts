import { Router } from "express";
import { env } from "../../config/env.js";
import { apiErrorFromStatus, unexpected } from "../../shared/api-error.js";
import { getLocalAdminCredentialType } from "./auth.repository.js";
import { authRateLimiter } from "./rate-limit.middleware.js";
import {
  completeSetup,
  isLocalAdminCreated,
  isSetupComplete,
  SetupError,
} from "./setup.service.js";
import { sessionCookieOptions } from "./session.service.js";

export const setupRouter = Router();

setupRouter.get("/status", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    localAdminCreated: isLocalAdminCreated(),
    setupComplete: isSetupComplete(),
    credentialType: getLocalAdminCredentialType(),
  });
});

setupRouter.post("/complete", authRateLimiter, async (req, res) => {
  try {
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    const result = await completeSetup({ password });
    res.cookie(env.sessionCookieName, result.sessionToken, sessionCookieOptions());
    return res.json({ success: true, user: result.user });
  } catch (error) {
    if (error instanceof SetupError) {
      return apiErrorFromStatus(res, error.status, error.message);
    }
    return unexpected(res, "Failed to complete setup", error);
  }
});
