import type { ReactNode } from "react";
import { SpinnerAlt } from "../ui/SpinnerAlt";
import { contentStatePanelClass } from "./EmptyContentState";
import { cx } from "../../lib/cx";

/**
 * Fetching content state: `SpinnerAlt`, bold title, description, on the same panel as
 * `EmptyContentState`. Render it **in place of** the table/list it replaces (not as a row
 * inside it) so the two states swap cleanly while the first load is in flight.
 */
export function LoadingState({
  title,
  description,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(contentStatePanelClass, className)} role="status" aria-live="polite">
      <SpinnerAlt size="md" />
      {title ? (
        <div className="gap-detail-tight flex flex-col">
          <p className="type-body-em text-text-primary m-0">{title}</p>
          {description ? <p className="type-body text-text-primary m-0">{description}</p> : null}
        </div>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
