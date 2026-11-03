import { env } from "../../config/env.js";
import { db } from "../../db/database.js";
import { recordAuditEvent } from "../auth/audit.service.js";
import { getSetting, saveSetting } from "../settings/settings.repository.js";

export type MinimaRuntimeSettings = {
  healthPollIntervalSeconds: number;
  stallBlockAgeSeconds: number;
  autoResyncEnabled: boolean;
  autoResyncCooldownMinutes: number;
};

export const MINIMA_RUNTIME_LIMITS = {
  healthPollIntervalSeconds: { min: 10, max: 3600 },
  stallBlockAgeSeconds: { min: 60, max: 86400 },
  autoResyncCooldownMinutes: { min: 1, max: 10080 },
} as const;

const settingKey = "minima_runtime_settings";
const defaults: MinimaRuntimeSettings = {
  healthPollIntervalSeconds: 60,
  stallBlockAgeSeconds: 300,
  autoResyncEnabled: false,
  autoResyncCooldownMinutes: 30,
};

export class MinimaSettingsValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Check the Minima monitoring settings.");
  }
}

function validate(input: unknown): MinimaRuntimeSettings {
  const value = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  for (const [key, range] of Object.entries(MINIMA_RUNTIME_LIMITS)) {
    const number = value[key];
    if (
      typeof number !== "number" ||
      !Number.isInteger(number) ||
      number < range.min ||
      number > range.max
    ) {
      errors[key] = `Enter a whole number from ${range.min} to ${range.max}.`;
    }
  }
  if (typeof value.autoResyncEnabled !== "boolean")
    errors.autoResyncEnabled = "Choose whether automatic resync is enabled.";
  if (Object.keys(errors).length) throw new MinimaSettingsValidationError(errors);
  return {
    healthPollIntervalSeconds: value.healthPollIntervalSeconds as number,
    stallBlockAgeSeconds: value.stallBlockAgeSeconds as number,
    autoResyncEnabled: value.autoResyncEnabled as boolean,
    autoResyncCooldownMinutes: value.autoResyncCooldownMinutes as number,
  };
}

export function getMinimaRuntimeSettings(): MinimaRuntimeSettings {
  const stored = getSetting(settingKey);
  if (stored) return validate(JSON.parse(stored));

  const legacy = {
    healthPollIntervalSeconds: env.minimaHealthPollIntervalSeconds,
    stallBlockAgeSeconds: env.minimaStallBlockAgeSeconds,
    autoResyncEnabled: env.minimaAutoResync,
    autoResyncCooldownMinutes: env.minimaAutoResyncCooldownMinutes,
  };
  for (const key of Object.keys(MINIMA_RUNTIME_LIMITS) as (keyof typeof MINIMA_RUNTIME_LIMITS)[]) {
    const range = MINIMA_RUNTIME_LIMITS[key];
    if (!Number.isInteger(legacy[key]) || legacy[key] < range.min || legacy[key] > range.max) {
      console.warn(`Invalid legacy Minima setting ${key}; using its safe default.`);
      legacy[key] = defaults[key];
    }
  }
  saveSetting(settingKey, JSON.stringify(legacy));
  return legacy;
}

export function saveMinimaRuntimeSettings(input: unknown, userId?: string) {
  const settings = validate(input);
  return db.transaction(() => {
    const previous = getMinimaRuntimeSettings();
    saveSetting(settingKey, JSON.stringify(settings));
    recordAuditEvent("minima.monitoring.settings_changed", {
      userId,
      detail: JSON.stringify({ previous, settings }),
    });
    return settings;
  })();
}
