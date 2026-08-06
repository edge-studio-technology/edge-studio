import { useEffect, useState } from "react";
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
  filterLabel?: string;
  searchPlaceholder?: string;
  onFilterChange?: (filter: string) => void;
  onQueryChange: (q: string) => void;
  disabled?: boolean;
};

export function ListFilterBar({
  filter,
  q,
  filterOptions,
  filterLabel = "Filter",
  searchPlaceholder = "Hash, UID, or source name",
  onFilterChange,
  onQueryChange,
  disabled = false,
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

  return (
    <div className="gap-detail-close flex flex-col">
      <div className="flex flex-wrap items-end gap-3">
        {filterOptions && onFilterChange ? (
          <div className="gap-detail-tight flex min-w-40 flex-col">
            <SelectField
              label={filterLabel}
              size="sm"
              className="min-w-0"
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
          size="sm"
          placeholder={searchPlaceholder}
          value={searchInput}
          disabled={disabled}
          className="min-w-56 flex-1"
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>
    </div>
  );
}
