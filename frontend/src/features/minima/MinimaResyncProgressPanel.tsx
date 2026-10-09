import { useEffect, useState } from "react";
import type { MinimaResyncOperation } from "../../app/types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Disclosure } from "../../components/ui/Disclosure";
import { Pill } from "../../components/ui/Pill";
import { ScrollArea } from "../../components/ui/ScrollArea";
import { EmptyContentState } from "../../components/patterns/EmptyContentState";
import { ErrorAlert } from "../../components/patterns/ErrorAlert";
import { ErrorContentState } from "../../components/patterns/ErrorContentState";
import { ErrorDetailPanel } from "../../components/patterns/ErrorDetailPanel";
import { LoadingState } from "../../components/patterns/LoadingState";
import { formatLocalDateTime, formatLocalTime } from "../../lib/time";
import { resyncPhaseLabel, resyncPhaseTone } from "./minimaResync";

export function MinimaResyncProgressPanel({
  operation,
  loading,
  error,
  onRetry,
}: {
  operation: MinimaResyncOperation | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!operation?.busy) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [operation?.busy]);
  const elapsed = operation
    ? Math.max(
        0,
        Math.floor(
          ((operation.busy ? now : Date.parse(operation.finishedAt ?? operation.updatedAt)) -
            Date.parse(operation.startedAt)) /
            1000,
        ),
      )
    : 0;
  return (
    <div className="w-full min-w-0" role="region" aria-label="Resync progress">
      <Card className="gap-detail-close grid w-full min-w-0">
        <h2 className="type-title text-text-primary m-0">Resync progress</h2>
        {operation ? (
          <>
            <div
              className="gap-detail-next flex flex-wrap items-center"
              role="status"
              aria-live="polite"
            >
              <Pill className="!h-auto min-h-6 max-w-full" indicator tone={resyncPhaseTone(operation.phase)}>
                {resyncPhaseLabel[operation.phase]}
              </Pill>
              {operation.recovered ? <Pill tone="good">Node recovered</Pill> : null}
              {operation.busy ? (
                <span className="type-meta text-text-secondary">Node actions paused</span>
              ) : null}
            </div>
            <p className="type-body text-text-primary m-0 break-words">{operation.message}</p>
            <p className="type-meta text-text-tertiary m-0">
              Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s · Last observation{" "}
              <time dateTime={operation.updatedAt}>{formatLocalDateTime(operation.updatedAt)}</time>
            </p>
            {error ? (
              <ErrorAlert
                title="Progress update unavailable"
                action={
                  <Button size="sm" variant="secondary" onClick={onRetry}>
                    Retry progress
                  </Button>
                }
              >
                {error} Showing the last observed operation.
              </ErrorAlert>
            ) : null}
            <Disclosure title="Progress events" defaultOpen>
              <ScrollArea className="max-h-64" tabIndex={0} aria-label="Resync events">
                <ol className="gap-detail-next m-0 grid list-none p-0">
                  {operation.events.map((event, index) => (
                    <li key={`${event.at}-${index}`} className="gap-detail-tight grid break-words">
                      <p className="type-body text-text-primary m-0">
                        <time className="type-meta text-text-tertiary" dateTime={event.at}>
                          {formatLocalTime(event.at)}
                        </time>{" "}
                        · {event.message}
                      </p>
                      {event.errorDetails ? (
                        <Disclosure title="Event details" defaultOpen={false}>
                          <ErrorDetailPanel error={event.errorDetails} />
                        </Disclosure>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </ScrollArea>
            </Disclosure>
            {operation.errorDetails ? (
              <Disclosure title="Recovery and error details" defaultOpen={false}>
                <ErrorDetailPanel error={operation.errorDetails} />
              </Disclosure>
            ) : null}
          </>
        ) : error ? (
          <ErrorContentState
            title="Resync progress isn't available"
            description={error}
            onRetry={onRetry}
          />
        ) : loading ? (
          <LoadingState title="Loading resync progress" />
        ) : (
          <EmptyContentState
            title="No resync recorded"
            description="Progress from the next resync will appear here."
          />
        )}
      </Card>
    </div>
  );
}
