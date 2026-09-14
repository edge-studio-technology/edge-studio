import { useEffect, useState, type ReactNode } from "react";
import { InputField } from "../ui/InputField";
import { SelectField } from "../ui/SelectField";

type ListFilterBarOption = {
  value: string;
  label: string;
};

export type ListFilterBarProps = {
  filter?: string;
  q: string;
  filterOptions?: readonly ListFilterBarOption[];
  searchPlaceholder?: string;
  onFilterChange?: (filter: string) => void;
  onQueryChange: (q: string) => void;
  disabled?: boolean;
  /** Primary action button(s) beside search; full-width under the fields below `md`. */
  actions?: ReactNode;
};

export function ListFilterBar({
  filter,
  q,
  filterOptions,
  searchPlaceholder = "Hash, UID, or source name",
  onFilterChange,
  onQueryChange,
  disabled = false,
  actions,
}: ListFilterBarProps) {
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput !== q) onQueryChange(searchInput);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput, q, onQueryChange]);

  const fields = (
    <div className="flex w-full min-w-0 flex-wrap items-end gap-3">
      {filterOptions && onFilterChange ? (
        <div className="gap-detail-tight flex w-full min-w-0 flex-col sm:w-40 sm:shrink-0">
          <SelectField
            label="Filter"
            className="w-full min-w-0"
            value={filter ?? ""}
            disabled={disabled}
            options={filterOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
            onChange={(event) => onFilterChange(event.target.value)}
          />
        </div>
      ) : null}

      <InputField
        label="Search"
        type="search"
        placeholder={searchPlaceholder}
        value={searchInput}
        disabled={disabled}
        className="w-full min-w-0 flex-1 basis-48"
        onChange={(event) => setSearchInput(event.target.value)}
      />
    </div>
  );

  if (!actions) {
    return <div className="gap-detail-close flex flex-col">{fields}</div>;
  }

  return (
    <div className="gap-detail-close flex w-full flex-col md:flex-row md:items-end">
      <div className="w-full min-w-0 flex-1">{fields}</div>
      <div className="gap-detail-next flex w-full shrink-0 flex-col sm:flex-row sm:items-center md:w-auto [&_button]:w-full md:[&_button]:w-auto">
        {actions}
      </div>
    </div>
  );
}
