import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { Label } from "./Label";

const textareaClass =
  "min-h-[132px] w-full rounded-loose border border-stroke-primary bg-surface-always-white px-detail-close py-3 type-body text-text-primary placeholder:text-text-disabled outline-none transition-[border-color] duration-200 focus-visible:border-stroke-active disabled:cursor-not-allowed disabled:bg-surface-primary disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-stroke-error motion-reduce:transition-none";

/** ESDS multiline text control.
 * Mirrors `Input` styling with textarea sizing.
 * Move to Textarea.tsx when needed.
 * */
export function Textarea({
  className,
  rows = 5,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={rows} className={cx(textareaClass, "resize-y", className)} />;
}

/**
 * ESDS Textarea Field: label → optional description → control → optional error.
 * Prefer this when multiline input needs the same field wrapper as `InputField`.
 */
export function TextareaField({
  label,
  description,
  error,
  className,
  id,
  disabled,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
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
      <Textarea
        {...props}
        id={controlId}
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
