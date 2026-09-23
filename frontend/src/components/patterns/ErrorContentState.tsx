import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { contentStatePanelClass } from "./EmptyContentState";
import { cx } from "../../lib/cx";

/**
 * Failed content state: `AlertCircle`, bold title, description, optional raw `detail`, and an
 * optional retry action, on the same panel as `EmptyContentState` / `LoadingState`. Use it when a
 * fetch failure leaves a whole table/list/region with nothing to show; use `ErrorAlert` when the
 * surrounding page still works and only one slice degraded. Same placement rule as the sibling
 * states: render it **in place of** the content it replaces, along with that content's own
 * toolbar/pager chrome.
 */
export function ErrorContentState({
  title,
  description,
  detail,
  retryLabel = "Retry",
  retryDisabled,
  onRetry,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  detail?: ReactNode;
  retryLabel?: ReactNode;
  retryDisabled?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cx(contentStatePanelClass, className)} role="status" aria-live="polite">
      <AlertCircle className="text-icon-error size-6 shrink-0" aria-hidden />
      <div className="gap-detail-tight flex flex-col">
        <p className="type-body-em text-text-primary m-0">{title}</p>
        {description ? <p className="type-body text-text-primary m-0">{description}</p> : null}
        {detail ? <p className="type-meta text-text-tertiary m-0 break-words">{detail}</p> : null}
      </div>
      {onRetry ? (
        <Button type="button" variant="secondary" disabled={retryDisabled} onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
