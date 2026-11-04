import type { UiError } from "./errors";
import { normalizeError } from "./errors";
import { clearReadCache, peekReadCache, readCached, type ReadOptions } from "./readCache";

const cachedPaths = new Set([
  "/api/minima/status",
  "/api/status",
  "/api/status/overview",
  "/api/wallet",
  "/api/wallet/history",
  "/api/data-sources",
  "/api/automation/workflows",
  "/api/integritas/history",
  "/api/data-reads",
]);
const reusedPaths = new Set([
  "/api/minima/status",
  "/api/status",
  "/api/status/overview",
  "/api/wallet",
  "/api/wallet/history",
]);

export function getCachedJson<T>(url: string): T | null {
  return peekReadCache<T>(url);
}

export type ApiError = Error & { status?: number; errorCode?: string; details?: UiError };

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

function isPublicAuthPath(url: string) {
  return (
    url.includes("/api/auth/login") || url.includes("/api/auth/me") || url.includes("/api/setup/")
  );
}

function shouldForceLogin(status: number, url: string, parsed: Record<string, unknown>) {
  if (status !== 401 || isPublicAuthPath(url)) return false;
  // Integritas and other app errors carry errorCode — not an expired browser session.
  if (typeof parsed.errorCode === "string") return false;
  return true;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 401 && typeof parsed.errorCode !== "string") clearReadCache();
    if (onUnauthorized && shouldForceLogin(response.status, response.url, parsed)) {
      onUnauthorized();
    }
    const details = normalizeError(parsed, `HTTP ${response.status}`);
    const error = new Error(
      typeof parsed.error === "string"
        ? parsed.error
        : typeof parsed.message === "string"
          ? parsed.message
          : details.message,
    ) as ApiError;
    error.status = response.status;
    error.details = details;
    if (typeof parsed.errorCode === "string") error.errorCode = parsed.errorCode;
    throw error;
  }
  return parsed as T;
}

const defaultInit: RequestInit = {
  credentials: "include",
};

export async function getJson<T>(url: string, options?: ReadOptions): Promise<T> {
  const load = async () => parseResponse<T>(await fetch(url, defaultInit));
  if (!cachedPaths.has(url.split("?")[0])) return load();
  const snapshot = peekReadCache<{
    state?: string;
    resync?: { busy?: boolean };
    container?: { metricsPending?: boolean };
    node?: { state?: string };
  }>(url);
  const fast =
    snapshot?.state === "restarting" ||
    snapshot?.resync?.busy ||
    snapshot?.container?.metricsPending ||
    snapshot?.node?.state === "restarting";
  return readCached(
    url,
    load,
    reusedPaths.has(url.split("?")[0]) ? (fast ? 3000 : 30000) : 0,
    options,
  );
}

async function mutation<T>(url: string, init: RequestInit): Promise<T> {
  clearReadCache();
  try {
    return await parseResponse<T>(await fetch(url, { ...defaultInit, ...init }));
  } finally {
    clearReadCache(!url.startsWith("/api/auth/") && !url.startsWith("/api/setup/"));
  }
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  return mutation<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return mutation<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function putJson<T>(url: string, body: unknown): Promise<T> {
  return mutation<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteJson<T>(url: string, body?: unknown): Promise<T> {
  return mutation<T>(url, {
    method: "DELETE",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  return mutation<T>(url, {
    method: "POST",
    body: form,
  });
}
