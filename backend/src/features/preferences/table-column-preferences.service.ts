import { getSetting, saveSetting } from "../settings/settings.repository.js";

const TABLE_COLUMN_PREFERENCES_KEY = "ui.tableColumnPreferences";

export type TableColumnPreferenceEntry = {
  visibility: Record<string, boolean>;
  order: string[];
};

export type TableColumnPreferences = Record<string, TableColumnPreferenceEntry>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTableColumnPreferences(value: unknown): TableColumnPreferences {
  if (!isPlainRecord(value)) return {};

  const preferences: TableColumnPreferences = {};
  for (const [tableId, tableValue] of Object.entries(value)) {
    if (!isPlainRecord(tableValue)) continue;
    const rawVisibility = isPlainRecord(tableValue.visibility) ? tableValue.visibility : tableValue;
    const visibility: Record<string, boolean> = {};
    for (const [columnId, visible] of Object.entries(rawVisibility)) {
      if (typeof visible === "boolean") visibility[columnId] = visible;
    }
    const order = Array.isArray(tableValue.order)
      ? tableValue.order.filter((columnId): columnId is string => typeof columnId === "string")
      : [];
    preferences[tableId] = { visibility, order };
  }
  return preferences;
}

export function getTableColumnPreferences(): TableColumnPreferences {
  const raw = getSetting(TABLE_COLUMN_PREFERENCES_KEY);
  if (!raw) return {};

  try {
    return parseTableColumnPreferences(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveTableColumnPreferences(preferences: unknown): TableColumnPreferences {
  const parsed = parseTableColumnPreferences(preferences);
  saveSetting(TABLE_COLUMN_PREFERENCES_KEY, JSON.stringify(parsed));
  return parsed;
}
