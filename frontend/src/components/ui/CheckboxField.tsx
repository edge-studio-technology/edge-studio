import { Check, Minus } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../../lib/cx";

/**
 * ESDS Checkbox Field: checkbox + label row, optional indented description.
 * Value types: unchecked / checked / indeterminate × default / disabled.
 */
export function CheckboxField({
  label,
  description,
  className,
  disabled,
  checked,
  defaultChecked,
  indeterminate = false,
  id,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "size"> & {
  label: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  className?: string;
}) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = checked !== undefined;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));
  const isChecked = isControlled ? Boolean(checked) : uncontrolledChecked;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (!isControlled) {
      setUncontrolledChecked(event.target.checked);
    }
    onChange?.(event);
  }

  const showCheck = isChecked && !indeterminate;
  const showMinus = indeterminate;

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
            ref={inputRef}
            id={controlId}
            type="checkbox"
            className="peer absolute inset-0 z-10 size-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={disabled}
            checked={isControlled ? isChecked : undefined}
            defaultChecked={isControlled ? undefined : defaultChecked}
            aria-checked={indeterminate ? "mixed" : isChecked}
            aria-describedby={descriptionId}
            onChange={handleChange}
          />
          <span
            aria-hidden
            className={cx(
              "rounded-loose pointer-events-none flex size-4 items-center justify-center overflow-clip",
              "peer-focus-visible:ring-stroke-active peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
              disabled
                ? "border-stroke-primary bg-surface-secondary border"
                : showCheck || showMinus
                  ? "bg-icon-primary"
                  : "border-stroke-primary bg-icon-inverse border",
            )}
          >
            {showMinus ? (
              <Minus
                className={cx("size-4", disabled ? "text-icon-disabled" : "text-icon-inverse")}
                strokeWidth={2}
              />
            ) : null}
            {showCheck ? (
              <Check
                className={cx("size-4", disabled ? "text-icon-disabled" : "text-icon-inverse")}
                strokeWidth={2}
              />
            ) : null}
          </span>
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
