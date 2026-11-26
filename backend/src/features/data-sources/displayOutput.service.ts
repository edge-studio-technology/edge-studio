import { env } from "../../config/env.js";
import { getDataSource } from "./dataSources.repository.js";
import { parseSpiDisplayConfig } from "./dataSources.service.js";

export type DisplayCapability = { enabled: boolean; available: boolean; reason: string | null; supportedModels?: string[] };

export async function getDisplayCapability(): Promise<DisplayCapability> {
  if (!env.displaysEnabled) return { enabled: false, available: false, reason: "SPI displays are disabled. Enable them in Devices -> Hardware support." };
  try {
    const result = await displayRequest("/capabilities");
    return { enabled: true, available: result.available === true, reason: typeof result.reason === "string" ? result.reason : null, supportedModels: Array.isArray(result.supportedModels) ? result.supportedModels.filter((model): model is string => typeof model === "string") : [] };
  } catch {
    return { enabled: true, available: false, reason: "Display helper is unavailable. Check or repair SPI displays in Hardware support." };
  }
}

export async function displayText(input: { targetId: string; payload: unknown }) {
  if (!env.displaysEnabled) throw new Error("SPI displays are disabled. Enable them in Devices -> Hardware support.");
  const target = getDataSource(input.targetId);
  if (!target || target.type !== "spi-display") throw new Error("Display output requires a configured SPI display target");
  const config = parseSpiDisplayConfig(JSON.parse(target.config) as unknown);
  const content = input.payload as { title?: unknown; text?: unknown } | null;
  if (!content || typeof content !== "object" || Array.isArray(content) || typeof content.text !== "string" || !content.text.trim() || content.text.length > 512) throw new Error("Display payload.text must contain 1 to 512 characters");
  if (content.title !== undefined && (typeof content.title !== "string" || content.title.length > 32 || /[\r\n]/.test(content.title))) throw new Error("Display payload.title must be a single line of at most 32 characters");
  const payload = { title: content.title ?? "", text: content.text };
  await displayRequest("/display", { config, content: payload });
  return { targetId: target.id, targetName: target.name, action: "display_text", ...payload, updatedAt: new Date().toISOString() };
}

async function displayRequest(pathname: string, payload?: unknown): Promise<Record<string, unknown>> {
  if (!env.displayHelperToken) throw new Error("Display helper is not configured. Repair SPI displays in Hardware support.");
  const response = await fetch(`${env.displayHelperUrl.replace(/\/$/, "")}${pathname}`, {
    method: payload === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${env.displayHelperToken}`, ...(payload === undefined ? {} : { "Content-Type": "application/json" }) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : `Display helper returned HTTP ${response.status}`);
  return result;
}
