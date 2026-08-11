import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib/cx";

/**
 * ESDS Radio Field: radio + label row, optional indented description.
 * Value types: unselected / selected × default / disabled.
 * Group radios with a shared `name`; selection is the field value.
 */
export function RadioField({
  label,
  description,
  className,
  disabled,
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "size"> & {
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <div className={cx("gap-detail-fine flex flex-col items-start", className)}>
      <label
        htmlFor={controlId}
        className={cx(
          "gap-detail-next flex min-w-[120px] items-center",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <span className="relative size-4 shrink-0">
          <input
            {...props}
            id={controlId}
            type="radio"
            className="peer absolute inset-0 z-10 size-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={disabled}
            aria-describedby={descriptionId}
          />
          <span
            aria-hidden
            className={cx(
              "pointer-events-none flex size-4 items-center justify-center overflow-clip rounded-full border",
              "peer-focus-visible:ring-stroke-active peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
              "peer-checked:border-2 after:size-2 after:scale-0 after:rounded-full after:content-[''] peer-checked:after:scale-100",
              disabled
                ? "border-stroke-primary bg-surface-secondary after:bg-icon-disabled"
                : "border-stroke-primary bg-icon-inverse peer-checked:border-icon-primary after:bg-icon-primary",
            )}
          />
        </span>
        <span
          className={cx(
            "type-body min-w-px flex-1 [overflow-wrap:anywhere]",
            disabled ? "text-text-tertiary" : "text-text-primary",
          )}
        >
          {label}
        </span>
      </label>
      {description ? (
        <div className="gap-detail-next flex min-w-[120px] items-center">
          <span aria-hidden className="size-4 shrink-0" />
          <p
            id={descriptionId}
            className={cx(
              "type-body m-0 min-w-px flex-1 [overflow-wrap:anywhere]",
              disabled ? "text-text-disabled" : "text-text-secondary",
            )}
          >
            {description}
          </p>
        </div>
      ) : null}
    </div>
  );
}
