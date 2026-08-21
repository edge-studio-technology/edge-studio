import { env } from "../../config/env.js";

export type HostCapabilityState = "disabled" | "applying" | "enabled" | "failed" | "needs_reboot" | "missing_prerequisites";

export type HostCapability = {
  name: "camera" | "gpio" | "sensors" | "mqtt";
  enabled: boolean;
  installed: boolean;
  available: boolean;
  state: HostCapabilityState;
  reason: string | null;
  captureDir?: string;
  helperPort?: number;
  devicePath?: string;
  publicPort?: number;
  internalUrl?: string;
};

type HostAgentListResponse = { items: HostCapability[] };
type HostAgentItemResponse = { item: HostCapability };
type HostAgentActionResponse = { capability: HostCapability; restart?: { ok: boolean; scheduled?: boolean; message?: string }; warning?: string | null };

export async function listHostCapabilities() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return fallbackCapabilities("Host agent is not configured");
  debugHostCapability("list", "/capabilities");
  return hostAgentRequest<HostAgentListResponse>("/capabilities");
}

export async function getHostCameraCapability() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return { item: fallbackCameraCapability("Host agent is not configured") };
  debugHostCapability("get", "/capabilities/camera");
  return hostAgentRequest<HostAgentItemResponse>("/capabilities/camera");
}

export async function enableHostCameraCapability() {
  debugHostCapability("post", "/capabilities/camera/apply");
  return hostAgentRequest<HostAgentActionResponse>("/capabilities/camera/apply", { method: "POST" });
}

export async function disableHostCameraCapability() {
  debugHostCapability("post", "/capabilities/camera/disable");
  return hostAgentRequest<HostAgentActionResponse>("/capabilities/camera/disable", { method: "POST" });
}

export async function getHostGpioCapability() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return { item: fallbackCapability("gpio", "Host agent is not configured") };
  debugHostCapability("get", "/capabilities/gpio");
  return hostAgentRequest<HostAgentItemResponse>("/capabilities/gpio");
}

export async function enableHostGpioCapability() {
  debugHostCapability("post", "/capabilities/gpio/apply");
  return hostAgentRequest<HostAgentActionResponse>("/capabilities/gpio/apply", { method: "POST" });
}

export async function disableHostGpioCapability() {
  debugHostCapability("post", "/capabilities/gpio/disable");
  return hostAgentRequest<HostAgentActionResponse>("/capabilities/gpio/disable", { method: "POST" });
}

export async function getHostSensorCapability() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return { item: fallbackCapability("sensors", "Host agent is not configured") };
  debugHostCapability("get", "/capabilities/sensors");
  return hostAgentRequest<HostAgentItemResponse>("/capabilities/sensors");
}

export async function getHostMqttCapability() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return { item: fallbackCapability("mqtt", "Host agent is not configured") };
  debugHostCapability("get", "/capabilities/mqtt");
  return hostAgentRequest<HostAgentItemResponse>("/capabilities/mqtt");
}

export async function enableHostMqttCapability() {
  debugHostCapability("post", "/capabilities/mqtt/apply");
  return hostAgentRequest<HostAgentActionResponse>("/capabilities/mqtt/apply", { method: "POST" });
}

export async function disableHostMqttCapability() {
  debugHostCapability("post", "/capabilities/mqtt/disable");
  return hostAgentRequest<HostAgentActionResponse>("/capabilities/mqtt/disable", { method: "POST" });
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
    debugHostCapability("response", pathname, { status: response.status, ok: response.ok, payload });
    if (!response.ok) throw new Error(payload?.error ?? `Host agent returned HTTP ${response.status}`);
    return payload as T;
  } catch (error) {
    debugHostCapability("error", pathname, { message: error instanceof Error ? error.message : String(error) });
    if (controller.signal.aborted) throw new Error("Host agent request timed out");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackCapabilities(reason: string): HostAgentListResponse {
  return { items: [fallbackCameraCapability(reason), fallbackCapability("gpio", reason), fallbackCapability("sensors", reason), fallbackCapability("mqtt", reason)] };
}

function debugHostCapability(event: string, pathname: string, details?: unknown) {
  if (!env.hostCapabilityDebug) return;
  console.log(`[host-capabilities] ${event} ${pathname}`, details ?? "");
}

function fallbackCameraCapability(reason: string): HostCapability {
  return { name: "camera", enabled: false, installed: false, available: false, state: "disabled", reason };
}

function fallbackCapability(name: HostCapability["name"], reason: string): HostCapability {
  return { name, enabled: false, installed: false, available: false, state: "disabled", reason };
}
