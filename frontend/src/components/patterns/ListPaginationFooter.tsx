import { Pagination } from "../ui/Pagination";
import { SelectField } from "../ui/SelectField";
import { listRangeLabel } from "../../lib/paginated";
import type { ReactNode } from "react";
import { Label } from "../ui/Label";

type PageSizeOption = {
  value: string;
  label: ReactNode;
};

export function ListPaginationFooter({
  page,
  pageSize,
  total,
  totalPages,
  disabled = false,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  rowsLabel = "Rows",
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions: PageSizeOption[];
  rowsLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={
        className ? `gap-detail-close flex flex-col ${className}` : "gap-detail-close flex flex-col"
      }
    >
      <div className="gap-detail-next flex flex-wrap items-end justify-between">
        <p className="type-meta text-text-secondary pb-detail-next m-0">
          {listRangeLabel(page, pageSize, total)}
        </p>
        <div className="gap-detail-next flex items-center">
          <Label>{rowsLabel}</Label>
          <SelectField
            aria-label={rowsLabel}
            size="sm"
            className="w-28 gap-0"
            value={String(pageSize)}
            disabled={disabled}
            options={pageSizeOptions}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
            }}
          />
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        disabled={disabled}
        onPageChange={onPageChange}
      />
    </div>
  );
}
