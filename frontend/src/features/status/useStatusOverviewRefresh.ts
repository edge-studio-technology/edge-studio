import { useCallback, useEffect, useRef, useState } from "react";
import type { StatusOverview } from "../../app/types";
import { getStatusOverview } from "./statusApi";
import { getCachedJson } from "../../lib/api";
import { subscribeReadCacheInvalidation } from "../../lib/readCache";

const INTERVAL_MS = 30_000;

export function useStatusOverviewRefresh() {
  const [overview, setOverview] = useState(() =>
    getCachedJson<StatusOverview>("/api/status/overview"),
  );
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const status = await getStatusOverview();
      if (version !== requestVersion.current) return;
      setOverview(status);
      setError(null);
    } catch (err) {
      // Keep the last known-good overview on screen; just flag it as stale.
      if (version === requestVersion.current)
        setError(err instanceof Error ? err.message : "Could not refresh status");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), INTERVAL_MS);
    const unsubscribe = subscribeReadCacheInvalidation(() => void refresh());
    return () => {
      ++requestVersion.current; // eslint-disable-line react-hooks/exhaustive-deps -- request generation counter
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [refresh]);

  return { overview, error };
}
