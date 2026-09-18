import { useEffect, useMemo, useState } from "react";
import {
  resolveColumnVisibility,
  type TableColumnDefinition,
  type TableColumnVisibility,
} from "../../components/patterns/TableColumnVisibility";
import {
  getTableColumnPreferences,
  saveTableColumnPreferences,
  type TableColumnPreferences,
} from "./tableColumnPreferencesApi";

let cachedPreferences: TableColumnPreferences | null = null;
let pendingPreferences: Promise<TableColumnPreferences> | null = null;

function loadPreferences() {
  if (cachedPreferences) return Promise.resolve(cachedPreferences);
  pendingPreferences ??= getTableColumnPreferences()
    .then((preferences) => {
      cachedPreferences = preferences;
      return preferences;
    })
    .finally(() => {
      pendingPreferences = null;
    });
  return pendingPreferences;
}

export function useTableColumnVisibility(
  tableId: string,
  columns: readonly TableColumnDefinition[],
) {
  const [savedVisibility, setSavedVisibility] = useState<TableColumnVisibility | null>(
    cachedPreferences?.[tableId] ?? null,
  );
  const visibility = useMemo(
    () => resolveColumnVisibility(columns, savedVisibility),
    [columns, savedVisibility],
  );

  useEffect(() => {
    let cancelled = false;
    loadPreferences()
      .then((preferences) => {
        if (!cancelled) setSavedVisibility(preferences[tableId] ?? null);
      })
      .catch(() => {
        if (!cancelled) setSavedVisibility(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  function setVisibility(next: TableColumnVisibility) {
    setSavedVisibility(next);
    const preferences = { ...(cachedPreferences ?? {}), [tableId]: next };
    cachedPreferences = preferences;
    void saveTableColumnPreferences(preferences).then((saved) => {
      cachedPreferences = saved;
    });
  }

  return { visibility, setVisibility };
}
