import { type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "../../components/ui/Button";
import { cx } from "../../lib/cx";

const accentClass: Record<"good" | "warn" | "error", string> = {
  good: "border-l-stroke-success",
  warn: "border-l-stroke-warning",
  error: "border-l-stroke-error",
};

export function ResultShell({
  title,
  description,
  ariaLabel,
  tone,
  badge,
  onClose,
  children,
  actions,
}: {
  title: string;
  description?: string;
  ariaLabel: string;
  tone: "good" | "warn" | "error";
  badge: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cx(
        "border-stroke-secondary bg-surface-always-white rounded-soft gap-detail-close p-pad-tight relative flex flex-col border border-l-4",
        accentClass[tone],
      )}
    >
      <IconButton
        variant="ghost"
        size="compact"
        aria-label={`Dismiss ${ariaLabel.toLowerCase()}`}
        onClick={onClose}
        className="top-detail-next right-detail-next enabled:hover:border-stroke-primary absolute border-transparent"
      >
        <X aria-hidden />
      </IconButton>

      <div className="gap-detail-tight flex min-w-0 flex-col pr-10">
        <div className="gap-detail-next flex min-w-0 items-center justify-between">
          <h3 className="type-body-em text-text-primary m-0 min-w-0">{title}</h3>
          {badge}
        </div>
        {description ? <p className="type-body text-text-secondary m-0">{description}</p> : null}
      </div>
      {children}
      {actions ? (
        <div className="gap-detail-close pt-detail-tight flex flex-col">{actions}</div>
      ) : null}
    </section>
  );
}
