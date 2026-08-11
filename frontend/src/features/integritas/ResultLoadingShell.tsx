import { LoadingDots } from "../../components/ui/LoadingDots";

export function ResultLoadingShell({
  title,
  description,
  ariaLabel,
}: {
  title: string;
  description?: string;
  ariaLabel: string;
}) {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel}
      className="border-stroke-secondary bg-surface-always-white rounded-soft gap-detail-close border-l-stroke-secondary p-pad-tight relative flex flex-col border border-l-4"
    >
      <div className="gap-detail-tight flex min-w-0 flex-col">
        <div className="gap-detail-next flex min-w-0 items-center justify-between">
          <h3 className="type-body-em text-text-primary m-0 min-w-0">{title}</h3>
          <LoadingDots />
        </div>
        {description ? <p className="type-body text-text-secondary m-0">{description}</p> : null}
      </div>
    </section>
  );
}
