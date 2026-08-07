import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../ui/Button";

/**
 * Quieter alternative to `OptionCard`: bare glyph, title, short description, and a real
 * action Button as the only click target (the card surface itself is not pressable).
 * Prefer this for dense choice grids where each option needs one explicit action.
 */
export function AltOptionCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onClick,
  disabled,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actionLabel: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "border-stroke-secondary bg-surface-primary rounded-soft p-pad-tight gap-detail-close flex h-full flex-col border",
        className,
      )}
    >
      {Icon ? <Icon className="text-icon-primary size-6 shrink-0" aria-hidden /> : null}
      <div className="gap-detail-tight flex flex-col">
        <h3 className="type-body-em text-text-primary m-0">{title}</h3>
        {description ? <p className="type-body text-text-secondary m-0">{description}</p> : null}
      </div>
      {children}
      <Button className="mt-auto" disabled={disabled} onClick={onClick}>
        {actionLabel}
      </Button>
    </div>
  );
}
