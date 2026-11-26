type ConditionIdentity = { operator?: unknown; source?: unknown; variableName?: unknown; fieldPath?: unknown; value?: unknown };

/** Stable across JSON property ordering and unrelated block settings. */
export function conditionBaselineKey(value: unknown) {
  const config = value as ConditionIdentity | null;
  return JSON.stringify([config?.operator, config?.source ?? "trigger", config?.source === "variable" ? config.variableName : config?.fieldPath, config?.value]);
}

export function evaluateNumericChange(actual: unknown, threshold: unknown, previous: number | null) {
  if (typeof actual !== "number" || !Number.isFinite(actual)) throw new Error("Changed by at least requires a finite numeric input");
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold <= 0) throw new Error("Change threshold must be a finite number greater than zero");
  const difference = previous === null ? null : Math.abs(actual - previous);
  const matched = difference === null || difference >= threshold || (difference > 0 && threshold - difference <= Number.EPSILON * Math.max(difference, threshold) * 4);
  return { actual, previousValue: previous, difference, threshold, firstReading: previous === null, matched };
}

export type PendingConditionBaseline = { blockId: string; configJson: string; key: string; value: number };
