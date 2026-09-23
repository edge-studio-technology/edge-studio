import rateLimit from "express-rate-limit";
import { tooManyRequests } from "../../shared/api-error.js";
import { sha256Hex } from "../../shared/crypto.js";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
  skipSuccessfulRequests: true
});

// Traffic-volume limits, process-local. See docs/adr/0022-bound-external-automation-effects.md.
export const TRAFFIC_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const WEBHOOK_RATE_LIMIT_MAX = 60;
export const AUTOMATION_WRITE_RATE_LIMIT_MAX = 30;
export const INTEGRITAS_STAMP_RATE_LIMIT_MAX = 10;

function trafficRateLimiter(max: number, options: Pick<Parameters<typeof rateLimit>[0] & object, "keyGenerator" | "skip"> = {}) {
  return rateLimit({
    windowMs: TRAFFIC_RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      tooManyRequests(res, "Too many requests. Try again later.");
    },
    ...options
  });
}

/** Keyed by client IP and a hash of the webhook token, so the store never holds the raw token. */
export const webhookRateLimiter = trafficRateLimiter(WEBHOOK_RATE_LIMIT_MAX, {
  keyGenerator: (req) => `${req.ip}:${sha256Hex(String(req.params.token ?? ""))}`
});

/** Mutations and manual runs only; reads and per-edit draft validation are not throttled. */
export const automationWriteRateLimiter = trafficRateLimiter(AUTOMATION_WRITE_RATE_LIMIT_MAX, {
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.path === "/workflows/validate-draft"
});

export const integritasStampRateLimiter = trafficRateLimiter(INTEGRITAS_STAMP_RATE_LIMIT_MAX);
