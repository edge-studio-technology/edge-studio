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
const HOST_AGENT_READ_TIMEOUT_MS = 5000;
const HOST_AGENT_ACTION_TIMEOUT_MS = 60000;

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
  return hostAgentActionRequest("/capabilities/camera/apply");
}

export async function disableHostCameraCapability() {
  debugHostCapability("post", "/capabilities/camera/disable");
  return hostAgentActionRequest("/capabilities/camera/disable");
}

export async function getHostGpioCapability() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return { item: fallbackCapability("gpio", "Host agent is not configured") };
  debugHostCapability("get", "/capabilities/gpio");
  return hostAgentRequest<HostAgentItemResponse>("/capabilities/gpio");
}

export async function enableHostGpioCapability() {
  debugHostCapability("post", "/capabilities/gpio/apply");
  return hostAgentActionRequest("/capabilities/gpio/apply");
}

export async function disableHostGpioCapability() {
  debugHostCapability("post", "/capabilities/gpio/disable");
  return hostAgentActionRequest("/capabilities/gpio/disable");
}

export async function getHostSensorCapability() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return { item: fallbackCapability("sensors", "Host agent is not configured") };
  debugHostCapability("get", "/capabilities/sensors");
  return hostAgentRequest<HostAgentItemResponse>("/capabilities/sensors");
}

export async function enableHostSensorCapability() {
  debugHostCapability("post", "/capabilities/sensors/apply");
  return hostAgentActionRequest("/capabilities/sensors/apply");
}

export async function disableHostSensorCapability() {
  debugHostCapability("post", "/capabilities/sensors/disable");
  return hostAgentActionRequest("/capabilities/sensors/disable");
}

export async function getHostMqttCapability() {
  if (!env.hostAgentUrl || !env.hostAgentToken) return { item: fallbackCapability("mqtt", "Host agent is not configured") };
  debugHostCapability("get", "/capabilities/mqtt");
  return hostAgentRequest<HostAgentItemResponse>("/capabilities/mqtt");
}

export async function enableHostMqttCapability() {
  debugHostCapability("post", "/capabilities/mqtt/apply");
  return hostAgentActionRequest("/capabilities/mqtt/apply");
}

export async function disableHostMqttCapability() {
  debugHostCapability("post", "/capabilities/mqtt/disable");
  return hostAgentActionRequest("/capabilities/mqtt/disable");
}

function hostAgentActionRequest(pathname: string) {
  return hostAgentRequest<HostAgentActionResponse>(pathname, { method: "POST" }, HOST_AGENT_ACTION_TIMEOUT_MS);
}

async function hostAgentRequest<T>(pathname: string, init: RequestInit = {}, timeoutMs = HOST_AGENT_READ_TIMEOUT_MS): Promise<T> {
  if (!env.hostAgentUrl || !env.hostAgentToken) throw new Error("Host agent is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
