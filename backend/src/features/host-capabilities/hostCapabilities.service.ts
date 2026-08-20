import { env } from "../../config/env.js";

export type HostCapabilityState = "disabled" | "applying" | "enabled" | "failed" | "needs_reboot" | "missing_prerequisites";

export type HostCapability = {
  name: "camera";
  enabled: boolean;
  installed: boolean;
  available: boolean;
  state: HostCapabilityState;
  reason: string | null;
  captureDir?: string;
  helperPort?: number;
};

type HostAgentListResponse = { items: HostCapability[] };
type HostAgentItemResponse = { item: HostCapability };
type HostAgentActionResponse = { capability: HostCapability; restart?: { ok: boolean; scheduled?: boolean; message?: string }; warning?: string | null };

export async function listHostCapabilities() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return fallbackCapabilities("Host agent is not configured");
  return hostAgentRequest<HostAgentListResponse>("/capabilities");
}

export async function getHostCameraCapability() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return { item: fallbackCameraCapability("Host agent is not configured") };
  return hostAgentRequest<HostAgentItemResponse>("/capabilities/camera");
}

export async function enableHostCameraCapability() {
  return hostAgentRequest<HostAgentActionResponse>("/capabilities/camera/apply", { method: "POST" });
}

export async function disableHostCameraCapability() {
  return hostAgentRequest<HostAgentActionResponse>("/capabilities/camera/disable", { method: "POST" });
}

async function hostAgentRequest<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  if (!env.hostAgentUrl || !env.hostAgentToken) throw new Error("Host agent is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${env.hostAgentUrl.replace(/\/$/, "")}${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.hostAgentToken}`, ...(init.headers ?? {}) },
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? `Host agent returned HTTP ${response.status}`);
    return payload as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Host agent request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackCapabilities(reason: string): HostAgentListResponse {
  return { items: [fallbackCameraCapability(reason)] };
}

function fallbackCameraCapability(reason: string): HostCapability {
  return { name: "camera", enabled: false, installed: false, available: false, state: "disabled", reason };
}
