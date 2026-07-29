import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib/cx";

/**
 * ESDS Switch Field: label + 40×24 switch row, optional full-width description.
 * Value types: off / on × default / disabled.
 */
export function SwitchField({
  label,
  description,
  className,
  disabled,
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "size" | "role"> & {
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;

  return (
    <div className={cx("gap-detail-fine flex min-w-[120px] flex-col items-start", className)}>
      <label
        htmlFor={controlId}
        className={cx(
          "gap-detail-next flex w-full items-center",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        {label != null && label !== "" ? (
          <span
            className={cx(
              "type-body min-w-px flex-1 [overflow-wrap:anywhere]",
              disabled ? "text-text-disabled" : "text-text-primary",
            )}
          >
            {label}
          </span>
        ) : null}
        <span className="relative h-6 w-10 shrink-0">
          <input
            {...props}
            id={controlId}
            type="checkbox"
            role="switch"
            className="peer absolute inset-0 z-10 h-6 w-10 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={disabled}
            aria-describedby={descriptionId}
          />
          <span
            aria-hidden
            className={cx(
              "pointer-events-none flex h-6 w-10 items-center rounded-full border p-[3px]",
              "peer-focus-visible:ring-stroke-active peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
              "peer-checked:[&>span]:translate-x-[16px]",
              disabled
                ? "border-stroke-primary bg-surface-secondary [&>span]:bg-icon-disabled"
                : "border-stroke-primary bg-icon-inverse [&>span]:bg-icon-tertiary peer-checked:border-transparent peer-checked:bg-icon-primary peer-checked:[&>span]:bg-icon-inverse",
            )}
          >
            <span className="size-[18px] rounded-full transition-transform" />
          </span>
        </span>
      </label>
      {description ? (
        <p
          id={descriptionId}
          className={cx(
            "type-body m-0 w-full [overflow-wrap:anywhere]",
            disabled ? "text-text-disabled" : "text-text-secondary",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
