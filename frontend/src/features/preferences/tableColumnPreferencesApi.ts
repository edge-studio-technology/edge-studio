import { getJson, putJson } from "../../lib/api";
import type { TableColumnVisibility } from "../../components/patterns/TableColumnVisibility";

export type TableColumnPreferences = Record<string, TableColumnVisibility>;

type TableColumnPreferencesResponse = {
  preferences: TableColumnPreferences;
};

export async function getTableColumnPreferences() {
  const response = await getJson<TableColumnPreferencesResponse>("/api/preferences/table-columns");
  return response.preferences;
}

export async function saveTableColumnPreferences(preferences: TableColumnPreferences) {
  const response = await putJson<TableColumnPreferencesResponse>("/api/preferences/table-columns", {
    preferences,
  });
  return response.preferences;
}
