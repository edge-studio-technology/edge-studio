import { useCallback, useEffect, useRef } from "react";
import type { MinimaNodeStatus } from "../../app/types";
import { getMinimaNodeStatus } from "./minimaApi";
import { subscribeReadCacheInvalidation } from "../../lib/readCache";

const DEFAULT_INTERVAL_MS = 30_000;
const RESTARTING_INTERVAL_MS = 3_000;

function formatRefreshError(error: unknown): string | null {
  if (error instanceof Error) {
    if (
      /fetch failed|aborted|temporarily unreachable/i.test(error.message) ||
      error.name === "AbortError"
    ) {
      return null;
    }
    return error.message;
  }
  return "Could not load Minima status";
}

export function useMinimaStatusRefresh(
  onStatus: (status: MinimaNodeStatus) => void,
  onError: (message: string) => void,
  options?: { intervalMs?: number; enabled?: boolean; reportTransientErrors?: boolean },
) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const enabled = options?.enabled ?? true;
  const reportTransientErrors = options?.reportTransientErrors ?? false;
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);
  const requestVersion = useRef(0);

  onStatusRef.current = onStatus;
  onErrorRef.current = onError;

  const refresh = useCallback(
    async (force = true) => {
      const version = ++requestVersion.current;
      try {
        const status = await getMinimaNodeStatus(force ? { force: true } : undefined);
        if (version === requestVersion.current) onStatusRef.current(status);
        return status;
      } catch (error) {
        const message = formatRefreshError(error);
        if (version === requestVersion.current && (message || reportTransientErrors)) {
          onErrorRef.current(
            message ?? (error instanceof Error ? error.message : "Could not load Minima status"),
          );
        }
        return null;
      }
    },
    [reportTransientErrors],
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: number | undefined;
    let tickVersion = 0;

    const tick = (force = false) => {
      const version = ++tickVersion;
      if (timer) window.clearTimeout(timer);
      void refresh(force).then((status) => {
        if (cancelled || version !== tickVersion) return;
        const nextDelay =
          status?.state === "restarting" ||
          status?.resync?.busy ||
          status?.container?.metricsPending
            ? RESTARTING_INTERVAL_MS
            : intervalMs;
        timer = window.setTimeout(() => tick(), nextDelay);
      });
    };

    tick();
    const unsubscribe = subscribeReadCacheInvalidation(() => tick(true));

    return () => {
      cancelled = true;
      ++requestVersion.current; // eslint-disable-line react-hooks/exhaustive-deps -- request generation counter
      unsubscribe();
      if (timer) window.clearTimeout(timer);
    };
  }, [enabled, intervalMs, refresh]);

  return { refresh };
}
