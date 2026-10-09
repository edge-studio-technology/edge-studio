import { useCallback, useEffect, useRef, useState } from "react";
import type { MinimaResyncOperation } from "../../app/types";
import { describeLoadFailure } from "../../lib/errors";
import { getMinimaResyncOperation } from "./minimaApi";

export function useMinimaResync() {
  const [operation, setOperation] = useState<MinimaResyncOperation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<MinimaResyncOperation | null>(null);
  const mounted = useRef(false);
  const version = useRef(0);
  const wake = useRef<(() => void) | null>(null);
  const inFlight = useRef<{
    version: number;
    request: Promise<MinimaResyncOperation | null | undefined>;
  } | null>(null);

  const apply = useCallback((next: MinimaResyncOperation | null) => {
    const previous = current.current;
    if (
      previous &&
      (!next ||
        next.startedAt < previous.startedAt ||
        (next.id === previous.id && next.updatedAt < previous.updatedAt))
    )
      return;
    current.current = next;
    setOperation(next);
    if (next?.busy !== previous?.busy) wake.current?.();
  }, []);

  const accept = useCallback(
    (next: MinimaResyncOperation) => {
      if (!mounted.current) return;
      version.current++;
      apply(next);
      setLoading(false);
      setError(null);
    },
    [apply],
  );

  const refresh = useCallback((): Promise<MinimaResyncOperation | null | undefined> => {
    if (!mounted.current) return Promise.resolve(undefined);
    if (inFlight.current) {
      return inFlight.current.version === version.current
        ? inFlight.current.request
        : inFlight.current.request.then(() => refresh());
    }
    const requestVersion = version.current;
    const request = (async () => {
      try {
        const next = await getMinimaResyncOperation();
        if (!mounted.current || version.current !== requestVersion) return undefined;
        apply(next);
        setError(null);
        return next;
      } catch (failure) {
        if (mounted.current && version.current === requestVersion)
          setError(
            describeLoadFailure(
              failure instanceof Error ? failure.message : "Could not load resync progress",
            ),
          );
        return undefined;
      } finally {
        if (mounted.current && version.current === requestVersion) setLoading(false);
      }
    })();
    inFlight.current = { version: requestVersion, request };
    void request.finally(() => {
      if (inFlight.current?.request === request) inFlight.current = null;
    });
    return request;
  }, [apply]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let timer: number | undefined;
    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          void tick();
        },
        current.current?.busy ? 3000 : 30_000,
      );
    };
    const tick = async () => {
      await refresh();
      if (cancelled) return;
      schedule();
    };
    wake.current = schedule;
    void tick();
    return () => {
      cancelled = true;
      mounted.current = false;
      wake.current = null;
      version.current++;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refresh]);

  return { operation, loading, error, refresh, accept };
}
