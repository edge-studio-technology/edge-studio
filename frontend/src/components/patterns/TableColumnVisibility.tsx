import { ArrowDown, ArrowUp, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SwitchField } from "../ui/SwitchField";
import { Text } from "../ui/Text";
import { cx } from "../../lib/cx";

export type TableColumnDefinition = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  dataColumn?: boolean;
};

export type TableColumnVisibility = Record<string, boolean>;
export type TableColumnOrder = string[];

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

export function TableColumnVisibilityButton({
  tableLabel,
  columns,
  visibility,
  columnOrder,
  onChange,
  onOrderChange,
  disabled = false,
}: {
  tableLabel: string;
  columns: readonly TableColumnDefinition[];
  visibility: TableColumnVisibility;
  columnOrder?: TableColumnOrder;
  onChange: (next: TableColumnVisibility) => void;
  onOrderChange?: (next: TableColumnOrder) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [movedColumnId, setMovedColumnId] = useState<string | null>(null);
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
          bodyStableGutter={false}
        >
          <div className="gap-detail-near grid">
            <div className="divide-stroke-secondary divide-y">
              {orderedColumnDefinitions.map((column, index) => {
                const checked = visibility[column.id];
                const disabledToggle =
                  column.dataColumn !== false && checked && visibleDataCount <= 1;
                return (
                  <div
                    key={column.id}
                    className={cx(
                      "gap-detail-next grid grid-cols-[auto_auto_minmax(0,1fr)] items-center py-detail-next first:pt-0 last:pb-0",
                      movedColumnId === column.id && "table-column-option-moved",
                    )}
                    onAnimationEnd={() => {
                      if (movedColumnId === column.id) setMovedColumnId(null);
                    }}
                  >
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
                    <SwitchField
                      label={column.label}
                      checked={checked}
                      disabled={disabledToggle}
                      description={
                        disabledToggle ? "At least one data column must stay visible." : undefined
                      }
                      onChange={() => toggleColumn(column)}
                    />
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
