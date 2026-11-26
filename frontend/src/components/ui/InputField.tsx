import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Input, type InputSize } from "../Input";
import { Label } from "./Label";

export function InputField({
  label,
  description,
  descriptionBelow = false,
  error,
  className,
  id,
  disabled,
  type = "text",
  size = "md",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "size"> & {
  label?: ReactNode;
  description?: ReactNode;
  descriptionBelow?: boolean;
  error?: ReactNode;
  className?: string;
  size?: InputSize;
}) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  const descriptionNode = description ? (
    <p
      id={descriptionId}
      className={cx(
        "type-meta m-0 leading-none",
        disabled ? "text-text-disabled" : "text-text-secondary",
      )}
    >
      {description}
    </p>
  ) : null;

  return (
    <div className={cx("gap-detail-next flex flex-col", className)}>
      {label ? (
        <Label htmlFor={controlId} disabled={disabled}>
          {label}
        </Label>
      ) : null}
      {!descriptionBelow && descriptionNode}
      <Input
        {...props}
        id={controlId}
        type={type}
        size={size}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {descriptionBelow && descriptionNode}
      {error ? (
        <p id={errorId} role="alert" className="type-meta text-text-error m-0 leading-none">
          {error}
        </p>
      ) : null}
    </div>
  );
}
