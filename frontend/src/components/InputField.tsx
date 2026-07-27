import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { Input } from "./Input";

/**
 * ESDS Input Field: label → description → control → error.
 * Default form control for login and other labeled text fields.
 */
export function InputField({
  label,
  description,
  error,
  className,
  id,
  disabled,
  type = "text",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  /** Outer stack class. */
  className?: string;
}) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("gap-detail-next flex flex-col", className)}>
      {label ? (
        <label
          htmlFor={controlId}
          className={cx(
            "type-meta block leading-none",
            disabled ? "text-text-tertiary" : "text-text-primary",
          )}
        >
          {label}
        </label>
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
      <Input
        {...props}
        id={controlId}
        type={type}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <p id={errorId} role="alert" className="type-meta text-text-error m-0 leading-none">
          {error}
        </p>
      ) : null}
    </div>
  );
}
