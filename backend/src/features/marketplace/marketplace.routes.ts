import { Router, type Request, type RequestParamHandler, type Response } from "express";
import { env } from "../../config/env.js";
import { badRequest, sendApiError, unauthorized } from "../../shared/api-error.js";
import { appError, systemError } from "../../shared/structured-error.js";
import { requireRole } from "../auth/auth.middleware.js";
import fs from "node:fs";
import { deliveryReadRateLimiter, fileOperationRateLimiter, webhookRateLimiter } from "../auth/rate-limit.middleware.js";
import { upload } from "../integritas/upload.middleware.js";
import { submitQuestDelivery } from "./questDelivery.service.js";
import { listSourceReadingsAfter } from "../data-reads/dataReads.repository.js";
import { getDataSource } from "../data-sources/dataSources.repository.js";
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

// Ids are checked before anything is forwarded. Encoding makes most characters harmless, but not a segment that
// is only dots: fetch would collapse it, so "/sources/../delivery" could reach a path outside the allowlist.
const validId: RequestParamHandler = (_req, res, next, value: string) =>
  value.length > 0 && value.length <= 128 && !/^\.+$/.test(value) && !/[/\\]/.test(value) ? next() : badRequest(res, "Invalid id", { field: "id" });
marketplaceRouter.param("id", validId);
marketplaceDeliveryRouter.param("id", validId);

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

/** A list from the marketplace, read whole: it answers in pages (at most 100), linked by X-Next-Cursor. Up to 50 pages. */
function forwardList(actor: (req: Request) => MarketplaceActor, path: (req: Request) => string) {
  return async (req: Request, res: Response) => {
    if (!isMarketplaceConfigured()) {
      return sendApiError(res, 503, systemError({ type: "not_configured", message: "The marketplace is not configured on this installation" }), { errorCode: "marketplace_not_configured" });
    }
    const base = path(req);
    const all: unknown[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 50; page++) {
      const url: string = `${base}${base.includes("?") ? "&" : "?"}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const result = await marketplaceRequest("GET", url, actor(req));
      if (result.status !== 200 || !Array.isArray(result.body)) return relay(res, result);
      all.push(...result.body);
      cursor = result.next ?? null;
      if (!cursor) break;
    }
    return relay(res, { status: 200, body: all });
  };
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

// The marketplace answers lists in pages; these read them whole (forwardList).
marketplaceRouter.get("/publisher/sources", forwardList(sessionActor, () => "/api/publisher/sources"));
marketplaceRouter.get("/publisher/listings", forwardList(sessionActor, () => "/api/publisher/listings"));
// The earnings answer is one document (transactions, totals, payout credit), not a paged list.
marketplaceRouter.get("/publisher/earnings", forward(sessionActor, "GET", () => "/api/publisher/earnings"));
// The marketplace's rights-to-sell declaration (its X-05), shown before a listing is published.
marketplaceRouter.get("/publisher/rights-declaration", forward(sessionActor, "GET", () => "/api/publisher/rights-declaration"));
marketplaceRouter.post("/publisher/listings", requireRole("admin"), forward(sessionActor, "POST", () => "/api/publisher/listings", (req) => req.body));
marketplaceRouter.patch("/publisher/listings/:id", requireRole("admin"), forward(sessionActor, "PATCH", (req) => `/api/publisher/listings/${id(req.params.id)}`, (req) => req.body));
marketplaceRouter.post(
  "/publisher/listings/:id/transitions",
  requireRole("admin"),
  // Only the target state, and for a publish the version of the rights declaration the user accepted (a whole number).
  forward(sessionActor, "POST", (req) => `/api/publisher/listings/${id(req.params.id)}/transitions`, (req) => ({
    to: req.body?.to,
    ...(Number.isInteger(req.body?.acceptDeclaration) && { acceptDeclaration: req.body.acceptDeclaration }),
  }))
);

marketplaceRouter.get(
  "/catalogue",
  // Only the catalogue's own filters are passed on (several values of one filter allowed); every page is read.
  forwardList(sessionActor, (req) => {
    const query = new URLSearchParams();
    for (const key of ["q", "category", "type", "country", "format"]) {
      for (const value of ([] as unknown[]).concat(req.query[key] ?? [])) if (typeof value === "string" && value) query.append(key, value);
    }
    const search = query.toString();
    return `/api/catalogue${search ? `?${search}` : ""}`;
  })
);
marketplaceRouter.get("/catalogue/:id", forward(sessionActor, "GET", (req) => `/api/catalogue/${id(req.params.id)}`));

// Funded data quests (#1380): open quests, the publisher's own requests for slots, and the publisher's actions on a
// slot (ask for one with a source, say collection has started, open a dispute). Only the fields each needs are sent.
marketplaceRouter.param("slot", (_req, res, next, value: string) => (/^[1-9]\d{0,2}$/.test(value) ? next() : badRequest(res, "Invalid slot", { field: "slot" })));
marketplaceRouter.get("/quests", forwardList(sessionActor, () => "/api/quests"));
marketplaceRouter.get("/quests/claims/mine", forwardList(sessionActor, () => "/api/quests/claims/mine"));
marketplaceRouter.get("/quests/:id", forward(sessionActor, "GET", (req) => `/api/quests/${id(req.params.id)}`));
marketplaceRouter.post(
  "/quests/:id/claims",
  requireRole("admin"),
  forward(sessionActor, "POST", (req) => `/api/quests/${id(req.params.id)}/claims`, (req) => ({ sourceId: req.body?.sourceId, idempotencyKey: req.body?.idempotencyKey }))
);
marketplaceRouter.post(
  "/quests/:id/slots/:slot/collection",
  requireRole("admin"),
  forward(sessionActor, "POST", (req) => `/api/quests/${id(req.params.id)}/slots/${req.params.slot}/collection`)
);
// The publisher's delivery for a slot: the uploaded file is fingerprinted, counted per device, signed by this node
// and submitted (questDelivery.service.ts). The answer includes the delivery service's file entry for it.
marketplaceRouter.post("/quests/:id/slots/:slot/deliveries", requireRole("admin"), fileOperationRateLimiter, upload.single("file"), async (req, res, next) => {
  const uploaded = req.file;
  try {
    if (!uploaded) return badRequest(res, "A delivery file is required", { field: "file" });
    if (typeof req.body?.sourceId !== "string" || !req.body.sourceId) return badRequest(res, "sourceId is required", { field: "sourceId" });
    if (!isMarketplaceConfigured()) {
      return sendApiError(res, 503, systemError({ type: "not_configured", message: "The marketplace is not configured on this installation" }), { errorCode: "marketplace_not_configured" });
    }
    const outcome = await submitQuestDelivery(
      { questId: req.params.id, slot: Number(req.params.slot), sourceId: req.body.sourceId, fileName: uploaded.originalname, bytes: fs.readFileSync(uploaded.path) },
      sessionActor(req)
    );
    if (outcome.status === "relay") return relay(res, outcome.result);
    if (outcome.status === 201) return res.status(201).json(outcome.body);
    return sendApiError(res, outcome.status, appError({ type: outcome.status === 422 ? "invalid_delivery" : "node_unavailable", message: outcome.error }), {
      errorCode: outcome.status === 422 ? "marketplace_invalid_delivery" : "marketplace_node_unavailable",
    });
  } catch (error) {
    next(error); // a disk error (no space, no permission) answers 500 instead of hanging the request
  } finally {
    if (uploaded) fs.rmSync(uploaded.path, { force: true }); // the upload's temporary copy
  }
});
marketplaceRouter.post(
  "/quests/:id/slots/:slot/disputes",
  requireRole("admin"),
  forward(sessionActor, "POST", (req) => `/api/quests/${id(req.params.id)}/slots/${req.params.slot}/disputes`, (req) => ({ reason: req.body?.reason }))
);

// Token-authenticated like the device webhooks, so rate-limited like them.
// Stream reads (GET) are polled often and limited on their own, so they can never use up the heartbeats' limit.
marketplaceDeliveryRouter.use((req, res, next) => (req.method === "GET" ? deliveryReadRateLimiter(req, res, next) : webhookRateLimiter(req, res, next)));
marketplaceDeliveryRouter.use((req, res, next) => (isDeliveryAuthorized(req.headers.authorization) ? next() : unauthorized(res)));

// FR-17 live streams: the delivery service polls a source's new readings (in recorded order) and delivers them to
// subscribed buyers in batches. Only a source of this installation; the delivery secret is required (above).
marketplaceDeliveryRouter.get("/sources/:id/reads", (req, res) => {
  const source = getDataSource(req.params.id);
  // Output targets are not data, and a camera's reading is only its local file's metadata: neither is a stream.
  if (!source || source.type.endsWith("-output") || source.type === "pi-camera") return res.status(404).json({ error: "not_found" });
  const after = typeof req.query.after === "string" ? req.query.after : undefined;
  return res.json(listSourceReadingsAfter(req.params.id, after));
});

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
