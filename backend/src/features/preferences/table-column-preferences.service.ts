import { getSetting, saveSetting } from "../settings/settings.repository.js";

const TABLE_COLUMN_PREFERENCES_KEY = "ui.tableColumnPreferences";

export type TableColumnPreferences = Record<string, Record<string, boolean>>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTableColumnPreferences(value: unknown): TableColumnPreferences {
  if (!isPlainRecord(value)) return {};

  const preferences: TableColumnPreferences = {};
  for (const [tableId, tableValue] of Object.entries(value)) {
    if (!isPlainRecord(tableValue)) continue;
    const columns: Record<string, boolean> = {};
    for (const [columnId, visible] of Object.entries(tableValue)) {
      if (typeof visible === "boolean") columns[columnId] = visible;
    }
    preferences[tableId] = columns;
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
