import { Router, type Request, type Response } from "express";
import { env } from "../../config/env.js";
import { badRequest, sendApiError, unauthorized } from "../../shared/api-error.js";
import { appError, systemError } from "../../shared/structured-error.js";
import { requireRole } from "../auth/auth.middleware.js";
import {
  isDeliveryAuthorized,
  isMarketplaceConfigured,
  marketplaceRequest,
  marketplaceRoleFor,
  SYSTEM_USER_ID,
  type MarketplaceActor,
  type MarketplaceResult,
} from "./marketplace.service.js";

// Signed-in browser routes: a fixed allowlist of marketplace calls, made with the installation key on behalf of
// the session user. Never a generic proxy; the payout wallet is deliberately not reachable from here.
export const marketplaceRouter = Router();
// Called by the publisher's delivery service with MARKETPLACE_DELIVERY_SECRET; mounted before requireAuth.
export const marketplaceDeliveryRouter = Router();

const id = (value: string) => encodeURIComponent(value);

/** Answers with the marketplace's result: 2xx and 4xx as given, unreachable or 5xx as a clean 503. */
function relay(res: Response, result: MarketplaceResult) {
  if (result.status === 0 || result.status >= 500) {
    return sendApiError(res, 503, systemError({ type: "dependency_unavailable", message: "Marketplace service unavailable" }), { errorCode: "marketplace_unavailable" });
  }
  if (result.status >= 400) {
    const body = (result.body && typeof result.body === "object" ? result.body : {}) as { error?: unknown; field?: unknown; message?: unknown };
    const code = typeof body.error === "string" ? body.error : "error";
    const field = typeof body.field === "string" ? body.field : undefined;
    const message = typeof body.message === "string" ? body.message : field ? `The marketplace rejected the ${field} field.` : `The marketplace refused the request (${code}).`;
    // errorCode keeps a marketplace 401 from being read as an expired Edge Studio session by the browser.
    return sendApiError(res, result.status, appError({ type: code, message, context: field ? { field } : undefined }), { errorCode: `marketplace_${code}`, field });
  }
  return res.status(result.status).json(result.body);
}

function forward(actor: (req: Request) => MarketplaceActor, method: string, path: (req: Request) => string, body?: (req: Request) => unknown) {
  return async (req: Request, res: Response) => {
    if (!isMarketplaceConfigured()) {
      return sendApiError(res, 503, systemError({ type: "not_configured", message: "The marketplace is not configured on this installation" }), { errorCode: "marketplace_not_configured" });
    }
    return relay(res, await marketplaceRequest(method, path(req), actor(req), body?.(req)));
  };
}

const sessionActor = (req: Request): MarketplaceActor => ({ userId: req.user!.id, role: marketplaceRoleFor(req.user!.role) });

// The URL is public (Buy opens the marketplace website); the key and delivery secret never leave the backend.
marketplaceRouter.get("/status", (req, res) => {
  const configured = isMarketplaceConfigured();
  res.json({ configured, url: configured ? env.marketplaceUrl.replace(/\/+$/, "") : null, role: marketplaceRoleFor(req.user!.role) });
});

marketplaceRouter.get("/publisher/sources", forward(sessionActor, "GET", () => "/api/publisher/sources"));
marketplaceRouter.get("/publisher/listings", forward(sessionActor, "GET", () => "/api/publisher/listings"));
marketplaceRouter.get("/publisher/earnings", forward(sessionActor, "GET", () => "/api/publisher/earnings"));
marketplaceRouter.post("/publisher/listings", requireRole("admin"), forward(sessionActor, "POST", () => "/api/publisher/listings", (req) => req.body));
marketplaceRouter.patch("/publisher/listings/:id", requireRole("admin"), forward(sessionActor, "PATCH", (req) => `/api/publisher/listings/${id(req.params.id)}`, (req) => req.body));
marketplaceRouter.post(
  "/publisher/listings/:id/transitions",
  requireRole("admin"),
  forward(sessionActor, "POST", (req) => `/api/publisher/listings/${id(req.params.id)}/transitions`, (req) => ({ to: req.body?.to }))
);

marketplaceRouter.get(
  "/catalogue",
  forward(sessionActor, "GET", (req) => {
    const query = new URLSearchParams();
    for (const key of ["q", "category", "type"]) {
      if (typeof req.query[key] === "string" && req.query[key]) query.set(key, req.query[key] as string);
    }
    const search = query.toString();
    return `/api/catalogue${search ? `?${search}` : ""}`;
  })
);
marketplaceRouter.get("/catalogue/:id", forward(sessionActor, "GET", (req) => `/api/catalogue/${id(req.params.id)}`));

marketplaceDeliveryRouter.use((req, res, next) => (isDeliveryAuthorized(req.headers.authorization) ? next() : unauthorized(res)));

// Where buyers are sent is the owner's decision, so the address change is made as owner.
marketplaceDeliveryRouter.put(
  "/sources/:id/address",
  (req, res, next) => (req.body?.address === null || typeof req.body?.address === "string" ? next() : badRequest(res, "address must be an https origin or null", { field: "address" })),
  forward(() => ({ userId: SYSTEM_USER_ID, role: "owner" }), "PUT", (req) => `/api/integration/sources/${id(req.params.id)}/delivery`, (req) => ({ address: req.body.address }))
);

marketplaceDeliveryRouter.post(
  "/sources/:id/heartbeat",
  forward(() => ({ userId: SYSTEM_USER_ID, role: "publisher" }), "POST", (req) => `/api/integration/sources/${id(req.params.id)}/heartbeat`, (req) => ({
    lastDataAt: req.body?.lastDataAt,
    intervalSeconds: req.body?.intervalSeconds,
  }))
);
