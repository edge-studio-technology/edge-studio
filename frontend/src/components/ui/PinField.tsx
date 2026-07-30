import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Label } from "./Label";

type PinFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "onChange" | "type"
> & {
  value: string;
  onChange: (nextValue: string) => void;
  length?: number;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
};

function digitsOnly(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

/**
 * Keeps the same label / description / error stack as `InputField`.
 */
export function PinField({
  value,
  onChange,
  length = 6,
  label,
  description,
  error,
  className,
  id,
  disabled,
  name,
  autoComplete,
  autoFocus,
  onBlur,
  onFocus,
  ...props
}: PinFieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const normalizedValue = digitsOnly(value, length);
  const slots = Array.from({ length }, (_, index) => normalizedValue[index] ?? "");
  const [focused, setFocused] = useState(false);
  const activeIndex = normalizedValue.length >= length ? length - 1 : normalizedValue.length;

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
      <div className="relative">
        <input
          {...props}
          id={controlId}
          name={name}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={autoComplete ?? "one-time-code"}
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore
          data-bwignore
          data-lpignore="true"
          value={normalizedValue}
          disabled={disabled}
          autoFocus={autoFocus}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onChange={(event) => onChange(digitsOnly(event.target.value, length))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="absolute inset-0 h-full w-full cursor-text opacity-0 outline-none disabled:cursor-not-allowed"
        />
        <div aria-hidden="true" className="gap-detail-next flex">
          {slots.map((digit, index) => {
            const isFilled = digit !== "";
            const isActive = !disabled && focused && index === activeIndex;

            return (
              <div
                key={`${controlId}-${index}`}
                className={cx(
                  "rounded-loose bg-surface-always-white px-detail-next type-body flex h-[44px] min-w-0 flex-1 items-center justify-center border text-center leading-none transition-colors duration-200 motion-reduce:transition-none",
                  disabled
                    ? "border-stroke-primary bg-surface-primary text-text-disabled"
                    : error
                      ? "border-stroke-error text-text-primary"
                      : isActive
                        ? "border-stroke-active text-text-primary"
                        : "border-stroke-primary text-text-primary",
                )}
              >
                <span
                  className={cx(
                    "inline-flex items-center justify-center",
                    isFilled ? "text-text-primary" : "text-text-disabled",
                  )}
                >
                  {isFilled ? <span className="size-2 rounded-full bg-current" /> : "−"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="type-meta text-text-error m-0 leading-none">
          {error}
        </p>
      ) : null}
    </div>
  );
}
