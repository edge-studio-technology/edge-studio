import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { cx } from "../../lib/cx";

/** Shared panel shell for the empty / loading content states. Keep in sync with `LoadingState`. */
export const contentStatePanelClass =
  "border-stroke-secondary bg-surface-primary rounded-soft p-pad-relaxed gap-detail-near flex flex-col items-center justify-center border text-center";

/**
 * Empty content state: bare glyph, bold title, description, optional action button, on a
 * bordered panel. Prefer this over a bare "No X yet." string, and render it **in place of**
 * the table/list it replaces (not as a row inside it) so no empty header chrome is left behind.
 */
export function EmptyContentState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionIcon,
  actionVariant = "primary",
  actionDisabled,
  onAction,
  secondaryActionLabel,
  secondaryActionIcon,
  secondaryActionDisabled,
  onSecondaryAction,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actionLabel?: ReactNode;
  actionIcon?: ReactNode;
  actionVariant?: "primary" | "secondary";
  actionDisabled?: boolean;
  onAction?: () => void;
  secondaryActionLabel?: ReactNode;
  secondaryActionIcon?: ReactNode;
  secondaryActionDisabled?: boolean;
  onSecondaryAction?: () => void;
  className?: string;
}) {
  return (
    <div className={cx(contentStatePanelClass, className)}>
      {Icon ? <Icon className="text-icon-primary size-6 shrink-0" aria-hidden /> : null}
      <div className="gap-detail-tight flex flex-col">
        <p className="type-body-em text-text-primary m-0">{title}</p>
        {description ? <p className="type-body text-text-primary m-0">{description}</p> : null}
      </div>
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="gap-detail-next flex flex-wrap items-center justify-center">
          {actionLabel && onAction ? (
            <Button
              type="button"
              variant={actionVariant}
              iconStart={actionIcon}
              disabled={actionDisabled}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button
              type="button"
              variant="secondary"
              iconStart={secondaryActionIcon}
              disabled={secondaryActionDisabled}
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
