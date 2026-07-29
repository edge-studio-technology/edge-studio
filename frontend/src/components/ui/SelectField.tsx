import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "../../lib/cx";
import { Label } from "./Label";

const selectClass =
  "h-[44px] min-w-[120px] w-full appearance-none rounded-loose border border-stroke-primary bg-surface-always-white py-0 pl-detail-close pr-10 type-body text-text-primary outline-none transition-[border-color] duration-200 focus-visible:border-stroke-active disabled:cursor-not-allowed disabled:bg-surface-primary disabled:text-text-disabled aria-invalid:border-stroke-error motion-reduce:transition-none";

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

function Select({
  className,
  disabled,
  value,
  defaultValue,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const isPlaceholder = value === "" || (value === undefined && defaultValue === "");

  return (
    <div className="relative w-full min-w-[120px]">
      <select
        {...props}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        className={cx(selectClass, isPlaceholder && "text-text-disabled", className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cx(
          "right-detail-close pointer-events-none absolute top-1/2 size-4 -translate-y-1/2",
          disabled ? "text-icon-disabled" : "text-icon-primary",
        )}
      />
    </div>
  );
}

/**
 * ESDS Select Field: label → optional description → control → optional error.
 * Prefer this for single-choice dropdowns that need the same field wrapper as `InputField`.
 */
export function SelectField({
  label,
  description,
  error,
  className,
  id,
  disabled,
  options,
  placeholder,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "children"> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
  options: SelectOption[];
  placeholder?: string;
}) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("gap-detail-next flex flex-col", className)}>
      {label ? (
        <Label htmlFor={controlId} disabled={disabled}>
          {label}
        </Label>
      ) : null}
      {description ? (
        <p
          id={descriptionId}
          className={cx(
            "type-meta m-0 leading-none",
            disabled ? "text-text-disabled" : "text-text-secondary",
          )}
        >
          {description}
        </p>
      ) : null}
      <Select
        {...props}
        id={controlId}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        {placeholder != null ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </Select>
      {error ? (
        <p id={errorId} role="alert" className="type-meta text-text-error m-0 leading-none">
          {error}
        </p>
      ) : null}
    </div>
  );
}
