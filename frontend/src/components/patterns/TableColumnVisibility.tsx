import { Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SwitchField } from "../ui/SwitchField";
import { Text } from "../ui/Text";

export type TableColumnDefinition = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  dataColumn?: boolean;
};

export type TableColumnVisibility = Record<string, boolean>;

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

export function TableColumnVisibilityButton({
  tableLabel,
  columns,
  visibility,
  onChange,
  disabled = false,
}: {
  tableLabel: string;
  columns: readonly TableColumnDefinition[];
  visibility: TableColumnVisibility;
  onChange: (next: TableColumnVisibility) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
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
          bodyClassName="min-h-0 flex-1"
        >
          <div className="gap-detail-near grid">
            {columns.map((column) => {
              const checked = visibility[column.id];
              const disabledToggle =
                column.dataColumn !== false && checked && visibleDataCount <= 1;
              return (
                <SwitchField
                  key={column.id}
                  label={column.label}
                  checked={checked}
                  disabled={disabledToggle}
                  description={
                    disabledToggle ? "At least one data column must stay visible." : undefined
                  }
                  onChange={() => toggleColumn(column)}
                />
              );
            })}
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
