import { env } from "../../config/env.js";
import { sha3HashHex } from "../../shared/crypto.js";
import type { BmeSensorConfig } from "./dataSources.service.js";

export type SensorHelperCapability = {
  enabled: boolean;
  available: boolean;
  reason: string | null;
  supportedSensors?: string[];
};

export async function getSensorHelperCapability(): Promise<SensorHelperCapability> {
  if (!env.sensorsEnabled) {
    return { enabled: false, available: false, reason: "Sensor support is disabled. Set ENABLE_SENSORS=true and restart the app." };
  }

  try {
    await sensorHelperRequest("/health", undefined, 1500, false);
    const response = await sensorHelperRequest("/capabilities", undefined, 3000);
    return { enabled: true, available: Boolean(response.available), reason: typeof response.reason === "string" ? response.reason : null, supportedSensors: Array.isArray(response.supportedSensors) ? response.supportedSensors.filter((item): item is string => typeof item === "string") : undefined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return { enabled: true, available: false, reason: `Sensor helper is unavailable at ${env.sensorHelperUrl}: ${detail}` };
  }
}

export async function readBmeSensorSource(config: BmeSensorConfig) {
  if (!env.sensorsEnabled) throw new Error("Sensor support is disabled. Set ENABLE_SENSORS=true and restart the app.");
  const preview = await sensorHelperRequest("/read", config, env.sensorReadTimeoutMs);
  const canonicalBytes = `${JSON.stringify(preview, null, 2)}\n`;
  return { contentType: "application/json", bytesHash: sha3HashHex(canonicalBytes), canonicalBytes, preview, fetchedAt: new Date().toISOString() };
}

async function sensorHelperRequest(pathname: string, body?: unknown, timeoutMs = 1500, includeAuth = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(`${env.sensorHelperUrl.replace(/\/$/, "")}${pathname}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(includeAuth && env.sensorHelperToken ? { Authorization: `Bearer ${env.sensorHelperToken}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new Error("Sensor helper returned invalid JSON");
    }
  }

  if (!response.ok) {
    const message = json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : `Sensor helper returned HTTP ${response.status}`;
    throw new Error(message);
  }

  return json as Record<string, unknown>;
}
