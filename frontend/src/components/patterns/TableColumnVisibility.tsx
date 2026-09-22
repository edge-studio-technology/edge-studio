import { ArrowDown, ArrowUp, Filter, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton } from "../ui/Button";
import { InputField } from "../ui/InputField";
import { Modal } from "../ui/Modal";
import { SelectField } from "../ui/SelectField";
import { SwitchField } from "../ui/SwitchField";
import { Text } from "../ui/Text";
import { cx } from "../../lib/cx";

export type TableColumnDefinition = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  dataColumn?: boolean;
  filterable?: boolean;
};

export type TableColumnVisibility = Record<string, boolean>;
export type TableColumnOrder = string[];
export type TableColumnFilterOperator = "contains" | "not_contains";
export type TableColumnFilterRule = {
  operator: TableColumnFilterOperator;
  value: string;
};
export type TableColumnFilters = Record<string, TableColumnFilterRule | undefined>;

const FILTER_OPERATOR_OPTIONS = [
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
];

export function resolveColumnVisibility(
  columns: readonly TableColumnDefinition[],
  saved: TableColumnVisibility | null | undefined,
) {
  return Object.fromEntries(
    columns.map((column) => [column.id, saved?.[column.id] ?? column.defaultVisible !== false]),
  ) as TableColumnVisibility;
}

export function visibleColumnIds(
  columns: readonly TableColumnDefinition[],
  visibility: TableColumnVisibility,
) {
  return columns.filter((column) => visibility[column.id]).map((column) => column.id);
}

export function resolveColumnOrder(
  columns: readonly TableColumnDefinition[],
  saved: TableColumnOrder | null | undefined,
) {
  const knownIds = new Set(columns.map((column) => column.id));
  const savedKnownIds = (saved ?? []).filter((id) => knownIds.has(id));
  const missingIds = columns
    .map((column) => column.id)
    .filter((id) => !savedKnownIds.includes(id));
  return [...savedKnownIds, ...missingIds];
}

export function orderedColumns(
  columns: readonly TableColumnDefinition[],
  columnOrder: TableColumnOrder,
) {
  const byId = new Map(columns.map((column) => [column.id, column]));
  return columnOrder
    .map((id) => byId.get(id))
    .filter((column): column is TableColumnDefinition => Boolean(column));
}

export function resolveColumnFilters(
  columns: readonly TableColumnDefinition[],
  saved: TableColumnFilters | null | undefined,
) {
  const filterableIds = new Set(columns.filter((column) => column.filterable).map((column) => column.id));
  const filters: TableColumnFilters = {};
  for (const [columnId, filter] of Object.entries(saved ?? {})) {
    if (!filterableIds.has(columnId)) continue;
    const value = filter?.value?.trim() ?? "";
    if (!value) continue;
    filters[columnId] = {
      operator: filter?.operator === "not_contains" ? "not_contains" : "contains",
      value,
    };
  }
  return filters;
}

export function activeColumnFilters(
  columns: readonly TableColumnDefinition[],
  filters: TableColumnFilters,
) {
  return columns
    .filter((column) => filters[column.id]?.value.trim())
    .map((column) => ({ column, filter: filters[column.id] as TableColumnFilterRule }));
}

export function applyColumnFilters<T>(
  items: T[],
  filters: TableColumnFilters,
  accessors: Record<string, (item: T) => string | null | undefined>,
) {
  const activeFilters = Object.entries(filters).filter(([, filter]) => filter?.value.trim());
  if (activeFilters.length === 0) return items;
  return items.filter((item) =>
    activeFilters.every(([columnId, filter]) => {
      if (!filter) return true;
      const haystack = (accessors[columnId]?.(item) ?? "").toLowerCase();
      const needle = filter.value.trim().toLowerCase();
      const contains = haystack.includes(needle);
      return filter.operator === "not_contains" ? !contains : contains;
    }),
  );
}

function filterLabel(filter: TableColumnFilterRule) {
  return filter.operator === "not_contains" ? "does not contain" : "contains";
}

export function TableColumnVisibilityButton({
  tableLabel,
  columns,
  visibility,
  columnOrder,
  filters,
  onChange,
  onOrderChange,
  onFiltersChange,
  disabled = false,
}: {
  tableLabel: string;
  columns: readonly TableColumnDefinition[];
  visibility: TableColumnVisibility;
  columnOrder?: TableColumnOrder;
  filters?: TableColumnFilters;
  onChange: (next: TableColumnVisibility) => void;
  onOrderChange?: (next: TableColumnOrder) => void;
  onFiltersChange?: (next: TableColumnFilters) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [movedColumnId, setMovedColumnId] = useState<string | null>(null);
  const [expandedFilterColumnId, setExpandedFilterColumnId] = useState<string | null>(null);
  const resolvedColumnOrder = useMemo(
    () => resolveColumnOrder(columns, columnOrder),
    [columns, columnOrder],
  );
  const orderedColumnDefinitions = useMemo(
    () => orderedColumns(columns, resolvedColumnOrder),
    [columns, resolvedColumnOrder],
  );
  const visibleDataCount = useMemo(
    () => columns.filter((column) => column.dataColumn !== false && visibility[column.id]).length,
    [columns, visibility],
  );

  function toggleColumn(column: TableColumnDefinition) {
    const currentlyVisible = visibility[column.id];
    const isLastDataColumn =
      column.dataColumn !== false && currentlyVisible && visibleDataCount <= 1;
    if (isLastDataColumn) return;
    onChange({ ...visibility, [column.id]: !currentlyVisible });
  }

  function resetToDefaultView() {
    onChange(resolveColumnVisibility(columns, null));
    onOrderChange?.(resolveColumnOrder(columns, null));
    onFiltersChange?.({});
  }

  function moveColumn(columnId: string, direction: -1 | 1) {
    if (!onOrderChange) return;
    const index = resolvedColumnOrder.indexOf(columnId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= resolvedColumnOrder.length) return;
    const next = [...resolvedColumnOrder];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setMovedColumnId(columnId);
    onOrderChange(next);
  }

  function setColumnFilter(columnId: string, next: TableColumnFilterRule | undefined) {
    if (!onFiltersChange) return;
    const nextFilters = { ...(filters ?? {}) };
    if (!next || !next.value.trim()) delete nextFilters[columnId];
    else nextFilters[columnId] = { operator: next.operator, value: next.value };
    onFiltersChange(nextFilters);
  }

  return (
    <>
      <IconButton
        type="button"
        variant="secondary"
        aria-label={`Choose columns for ${tableLabel}`}
        title={`Choose columns for ${tableLabel}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden />
      </IconButton>
      {open ? (
        <Modal
          title={`Choose columns for ${tableLabel}`}
          description="Choose which table columns are shown. At least one data column must remain visible."
          onClose={() => setOpen(false)}
          bodyClassName="min-h-0"
          bodyScrollable={false}
          bodyStableGutter={false}
        >
          <div className="gap-detail-near grid">
            <div className="divide-stroke-secondary divide-y">
              {orderedColumnDefinitions.map((column, index) => {
                const checked = visibility[column.id];
                const disabledToggle =
                  column.dataColumn !== false && checked && visibleDataCount <= 1;
                const activeFilter = filters?.[column.id];
                const filterOpen = expandedFilterColumnId === column.id;
                return (
                  <div
                    key={column.id}
                    className={cx("py-detail-next first:pt-0 last:pb-0", movedColumnId === column.id && "table-column-option-moved")}
                    onAnimationEnd={() => {
                      if (movedColumnId === column.id) setMovedColumnId(null);
                    }}
                  >
                    <div className="gap-detail-next grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center">
                      <div className="gap-detail-tight flex items-center">
                        <IconButton
                          type="button"
                          variant="secondary"
                          size="compact"
                          aria-label={`Move ${column.label} up`}
                          title={`Move ${column.label} up`}
                          disabled={!onOrderChange || index === 0}
                          onClick={() => moveColumn(column.id, -1)}
                        >
                          <ArrowUp aria-hidden />
                        </IconButton>
                        <IconButton
                          type="button"
                          variant="secondary"
                          size="compact"
                          aria-label={`Move ${column.label} down`}
                          title={`Move ${column.label} down`}
                          disabled={!onOrderChange || index === orderedColumnDefinitions.length - 1}
                          onClick={() => moveColumn(column.id, 1)}
                        >
                          <ArrowDown aria-hidden />
                        </IconButton>
                      </div>
                      <span className="type-meta text-text-secondary min-w-5 text-right tabular-nums">
                        {index + 1}.
                      </span>
                      <span className={cx("type-body min-w-px [overflow-wrap:anywhere]", disabledToggle ? "text-text-disabled" : "text-text-primary")}>{column.label}</span>
                      <div className="gap-detail-next grid grid-cols-[2rem_2.5rem] items-center justify-end">
                        <div className="grid size-8 place-items-center">
                          {column.filterable && onFiltersChange ? (
                            <IconButton
                              type="button"
                              variant={activeFilter ? "primary" : "secondary"}
                              size="compact"
                              aria-label={`Filter ${column.label}`}
                              title={`Filter ${column.label}`}
                              onClick={() => setExpandedFilterColumnId(filterOpen ? null : column.id)}
                            >
                              <Filter aria-hidden />
                            </IconButton>
                          ) : null}
                        </div>
                        <SwitchField
                          label={null}
                          aria-label={column.label}
                          checked={checked}
                          disabled={disabledToggle}
                          className="min-w-0"
                          onChange={() => toggleColumn(column)}
                        />
                      </div>
                      {disabledToggle ? (
                        <p className="type-body text-text-disabled col-start-3 m-0 w-full [overflow-wrap:anywhere]">
                          At least one data column must stay visible.
                        </p>
                      ) : null}
                    </div>
                    {filterOpen ? (
                      <div className="border-stroke-secondary bg-surface-primary gap-detail-next mt-detail-next grid rounded-soft border p-pad-close sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-end">
                        <SelectField
                          label="Rule"
                          size="sm"
                          value={activeFilter?.operator ?? "contains"}
                          options={FILTER_OPERATOR_OPTIONS}
                          onChange={(event) =>
                            setColumnFilter(column.id, {
                              operator: event.currentTarget.value as TableColumnFilterOperator,
                              value: activeFilter?.value ?? "",
                            })
                          }
                        />
                        <InputField
                          label="Text"
                          size="sm"
                          value={activeFilter?.value ?? ""}
                          placeholder={`Filter ${column.label}`}
                          onChange={(event) =>
                            setColumnFilter(column.id, {
                              operator: activeFilter?.operator ?? "contains",
                              value: event.currentTarget.value,
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!activeFilter}
                          onClick={() => setColumnFilter(column.id, undefined)}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-start">
              <Button type="button" variant="secondary" size="sm" onClick={resetToDefaultView}>
                Reset to default view
              </Button>
            </div>
            <Text.Muted className="m-0">Changes are saved for this Edge Studio device.</Text.Muted>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function TableColumnFilterSummary({
  columns,
  filters,
  onRemove,
  onClear,
}: {
  columns: readonly TableColumnDefinition[];
  filters: TableColumnFilters;
  onRemove: (columnId: string) => void;
  onClear: () => void;
}) {
  const active = activeColumnFilters(columns, filters);
  if (active.length === 0) return null;

  return (
    <div className="border-stroke-secondary bg-surface-primary gap-detail-next rounded-soft p-pad-close flex flex-wrap items-center border">
      <span className="type-meta text-text-secondary">Column filters:</span>
      {active.map(({ column, filter }, index) => (
        <span
          key={column.id}
          className="border-stroke-secondary bg-surface-always-white gap-detail-tight rounded-loose type-meta inline-flex min-h-8 items-center border px-detail-next text-text-primary"
        >
          {index > 0 ? <span className="text-text-secondary">AND</span> : null}
          <span>
            {column.label} {filterLabel(filter)} "{filter.value}"
          </span>
          <button
            type="button"
            className="text-text-secondary hover:text-text-primary cursor-pointer border-0 bg-transparent p-0"
            aria-label={`Remove ${column.label} filter`}
            onClick={() => onRemove(column.id)}
          >
            x
          </button>
        </span>
      ))}
      {active.length > 1 ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear column filters
        </Button>
      ) : null}
    </div>
  );
}
