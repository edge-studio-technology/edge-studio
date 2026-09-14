import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import type { Manifest } from "../manifest/manifest.service.js";
import type { ServiceUpdateResult } from "./update.types.js";

type HostRuntimeApplyResponse = {
  updated?: boolean;
  restarts?: { service?: string; ok?: boolean; message?: string | null }[];
};

export async function updateHostRuntime(hostRuntime: Manifest["hostRuntime"]): Promise<ServiceUpdateResult> {
  if (!env.hostAgentUrl) {
    return { service: "host-runtime", updated: false, reason: "HOST_AGENT_URL is not configured" };
  }
  if (!env.hostAgentToken) {
    return { service: "host-runtime", updated: false, reason: "HOST_AGENT_TOKEN is not configured" };
  }

  const response = await fetch(hostRuntime.url);
  if (!response.ok) {
    return { service: "host-runtime", updated: false, reason: `failed to fetch host runtime artifact: HTTP ${response.status}` };
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== hostRuntime.sha256.toLowerCase()) {
    return { service: "host-runtime", updated: false, reason: "host runtime artifact SHA-256 did not match manifest" };
  }

  const applyUrl = new URL("/updates/host-runtime/apply", env.hostAgentUrl).toString();
  const applyResponse = await fetch(applyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.hostAgentToken}`,
      "Content-Type": "application/gzip",
      "Content-Length": String(bytes.length)
    },
    body: bytes
  });

  if (!applyResponse.ok) {
    let message = `host-agent rejected host runtime update: HTTP ${applyResponse.status}`;
    try {
      const body = await applyResponse.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep HTTP status message
    }
    return { service: "host-runtime", updated: false, reason: message };
  }

  const applyResult = await applyResponse.json() as HostRuntimeApplyResponse;
  const failedRestart = applyResult.restarts?.find((restart) => restart.ok === false);
  if (failedRestart) {
    return {
      service: "host-runtime",
      updated: false,
      reason: failedRestart.message ? `host runtime updated but ${failedRestart.service ?? "a service"} restart failed: ${failedRestart.message}` : `host runtime updated but ${failedRestart.service ?? "a service"} restart failed`
    };
  }

  return { service: "host-runtime", updated: Boolean(applyResult.updated), reason: applyResult.updated === false ? "already up to date" : "updated host runtime" };
}
