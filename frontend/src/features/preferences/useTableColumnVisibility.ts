import { useEffect, useMemo, useState } from "react";
import {
  resolveColumnOrder,
  resolveColumnVisibility,
  type TableColumnDefinition,
  type TableColumnOrder,
  type TableColumnVisibility,
} from "../../components/patterns/TableColumnVisibility";
import {
  getTableColumnPreferences,
  saveTableColumnPreferences,
  type TableColumnPreferences,
} from "./tableColumnPreferencesApi";

type NormalizedColumnPreference = {
  visibility: TableColumnVisibility | null;
  order: TableColumnOrder | null;
};

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

function normalizePreference(value: TableColumnPreferences[string] | null | undefined): NormalizedColumnPreference {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { visibility: null, order: null };
  }

  if ("visibility" in value || "order" in value) {
    return {
      visibility:
        value.visibility && typeof value.visibility === "object" && !Array.isArray(value.visibility)
          ? value.visibility
          : null,
      order: Array.isArray(value.order) ? value.order : null,
    };
  }

  return { visibility: value as TableColumnVisibility, order: null };
}

export function useTableColumnVisibility(
  tableId: string,
  columns: readonly TableColumnDefinition[],
) {
  const initialPreference = normalizePreference(cachedPreferences?.[tableId]);
  const [savedVisibility, setSavedVisibility] = useState<TableColumnVisibility | null>(initialPreference.visibility);
  const [savedOrder, setSavedOrder] = useState<TableColumnOrder | null>(initialPreference.order);
  const visibility = useMemo(
    () => resolveColumnVisibility(columns, savedVisibility),
    [columns, savedVisibility],
  );
  const columnOrder = useMemo(() => resolveColumnOrder(columns, savedOrder), [columns, savedOrder]);

  useEffect(() => {
    let cancelled = false;
    loadPreferences()
      .then((preferences) => {
        if (!cancelled) {
          const next = normalizePreference(preferences[tableId]);
          setSavedVisibility(next.visibility);
          setSavedOrder(next.order);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSavedVisibility(null);
          setSavedOrder(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  function setVisibility(next: TableColumnVisibility) {
    setSavedVisibility(next);
    const preferences = { ...(cachedPreferences ?? {}), [tableId]: { visibility: next, order: columnOrder } };
    cachedPreferences = preferences;
    void saveTableColumnPreferences(preferences).then((saved) => {
      cachedPreferences = saved;
    });
  }

  function setColumnOrder(next: TableColumnOrder) {
    setSavedOrder(next);
    const preferences = { ...(cachedPreferences ?? {}), [tableId]: { visibility, order: next } };
    cachedPreferences = preferences;
    void saveTableColumnPreferences(preferences).then((saved) => {
      cachedPreferences = saved;
    });
  }

  return { visibility, columnOrder, setVisibility, setColumnOrder };
}
