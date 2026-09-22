import { useEffect, useMemo, useState } from "react";
import {
  resolveColumnOrder,
  resolveColumnFilters,
  resolveColumnVisibility,
  type TableColumnDefinition,
  type TableColumnOrder,
  type TableColumnFilters,
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
  filters: TableColumnFilters | null;
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
    return { visibility: null, order: null, filters: null };
  }

  if ("visibility" in value || "order" in value || "filters" in value) {
    return {
      visibility:
        value.visibility && typeof value.visibility === "object" && !Array.isArray(value.visibility)
          ? value.visibility
          : null,
      order: Array.isArray(value.order) ? value.order : null,
      filters:
        value.filters && typeof value.filters === "object" && !Array.isArray(value.filters)
          ? value.filters
          : null,
    };
  }

  return { visibility: value as TableColumnVisibility, order: null, filters: null };
}

export function useTableColumnVisibility(
  tableId: string,
  columns: readonly TableColumnDefinition[],
) {
  const initialPreference = normalizePreference(cachedPreferences?.[tableId]);
  const [savedVisibility, setSavedVisibility] = useState<TableColumnVisibility | null>(initialPreference.visibility);
  const [savedOrder, setSavedOrder] = useState<TableColumnOrder | null>(initialPreference.order);
  const [savedFilters, setSavedFilters] = useState<TableColumnFilters | null>(initialPreference.filters);
  const visibility = useMemo(
    () => resolveColumnVisibility(columns, savedVisibility),
    [columns, savedVisibility],
  );
  const columnOrder = useMemo(() => resolveColumnOrder(columns, savedOrder), [columns, savedOrder]);
  const filters = useMemo(() => resolveColumnFilters(columns, savedFilters), [columns, savedFilters]);

  useEffect(() => {
    let cancelled = false;
    loadPreferences()
      .then((preferences) => {
        if (!cancelled) {
          const next = normalizePreference(preferences[tableId]);
          setSavedVisibility(next.visibility);
          setSavedOrder(next.order);
          setSavedFilters(next.filters);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSavedVisibility(null);
          setSavedOrder(null);
          setSavedFilters(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  function setVisibility(next: TableColumnVisibility) {
    setSavedVisibility(next);
    const preferences = { ...(cachedPreferences ?? {}), [tableId]: { visibility: next, order: columnOrder, filters } };
    cachedPreferences = preferences;
    void saveTableColumnPreferences(preferences).then((saved) => {
      cachedPreferences = saved;
    });
  }

  function setColumnOrder(next: TableColumnOrder) {
    setSavedOrder(next);
    const preferences = { ...(cachedPreferences ?? {}), [tableId]: { visibility, order: next, filters } };
    cachedPreferences = preferences;
    void saveTableColumnPreferences(preferences).then((saved) => {
      cachedPreferences = saved;
    });
  }

  function setFilters(next: TableColumnFilters) {
    const resolvedFilters = resolveColumnFilters(columns, next);
    setSavedFilters(resolvedFilters);
    const preferences = { ...(cachedPreferences ?? {}), [tableId]: { visibility, order: columnOrder, filters: resolvedFilters } };
    cachedPreferences = preferences;
    void saveTableColumnPreferences(preferences).then((saved) => {
      cachedPreferences = saved;
    });
  }

  return { visibility, columnOrder, filters, setVisibility, setColumnOrder, setFilters };
}
