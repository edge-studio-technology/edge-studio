import { env } from "../../config/env.js";
import { getDataSource } from "./dataSources.repository.js";
import { parseSpiDisplayConfig } from "./dataSources.service.js";

export type DisplayCapability = { enabled: boolean; available: boolean; reason: string | null; supportedModels?: string[] };

export function displayContentErrors(payload: unknown) {
  const { title, text } = (payload ?? {}) as { title?: unknown; text?: unknown };
  return {
    text: typeof text !== "string" || !text.trim() ? "Enter the text to display."
      : text.length > 512 ? "Use 512 characters or fewer for the display text." : undefined,
    title: title !== undefined && (typeof title !== "string" || /[\r\n]/.test(title))
      ? "Use a single line for the title."
      : typeof title === "string" && title.length > 32 ? "Use 32 characters or fewer for the title." : undefined,
  };
}

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
  const errors = displayContentErrors(input.payload);
  if (errors.text || errors.title) throw new Error(errors.text ?? errors.title);
  const content = input.payload as { title?: string; text: string };
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
