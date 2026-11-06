# 0042: Separate Node Readiness From Resource Telemetry

**Status:** Accepted
**Date:** 2026-11-03

## Context

Three read-only Pi samples measured median Minima RPC status at 11 ms, application node status at 2,018 ms, Dashboard status at 2,035 ms and overview at 4,029 ms. Node status sampled every app container, then overview repeated the same Docker collection. Normal non-streaming CPU sampling took 1–2 seconds. Page-local state was also discarded on navigation. A previous broad shared-polling rewrite regressed operation feedback.

## Decision

- Fetch current container lifecycle state independently of resource sampling. Node readiness still uses current Docker state, RPC and operation state; telemetry never authorizes a mutation.
- Share one in-flight normal two-sample resource collection and retain its last successful result for 30 seconds. Node reads start cold/stale telemetry asynchronously, match samples to current container IDs and return pending/observed-at metadata. Missing, failed or replaced-container telemetry never blocks readiness. A failed background collection waits before another attempt. Overview starts its collection alongside readiness and shares that work.
- Preserve normal two-sample CPU delta calculations. One-shot measured 5–11 ms but does not supply an equivalent two-sample interval by itself; switching blindly could report misleading CPU usage.
- Keep existing frontend pollers. Selected node/device/overview/wallet reads reuse successful results for at most 30 seconds, reduced to 3 seconds during restart/resync or pending telemetry. A fast follow-up fills cold telemetry. Last results paint immediately on navigation; failed reads do not renew cache age. Device/workflow/activity list snapshots support immediate display but their requests remain live, preserving existing manual/proof refresh behavior.
- Bound the in-memory read cache to 32 query keys, with a 512 KiB estimated snapshot budget and a 10,000-value traversal guard per result. Oversized results are returned intact but not retained; inspection avoids serializing full history payloads a second time. Store no cache in browser persistence. Clear it before and after JSON/form mutations and on authentication changes/expiry. Identity checks compare cache entries so requests from an invalidated session cannot repopulate the cache. Mounted status pollers refresh after application mutations; authentication/setup flows clear snapshots without triggering extra status requests so their confirmation/logout navigation remains in control; explicit manual/operation refreshes bypass reuse. Cache state is presentation only; backend mutation checks remain authoritative.
- Mount collapsed Minima settings and backups on first opening, preserving their form state on later closing. Continue to load live resync progress separately.

## Alternatives considered

- Five-minute caches: unnecessarily stale for wallet/operation feedback and do not remove cold-request sampling waits.
- Cache Docker lifecycle state with metrics: could report a stopped/replaced node as running. Only telemetry is reused by readiness.
- Replace existing pollers with a shared application store: broader than the measured bottleneck and repeats a previously regressed approach.
- Reuse list responses indiscriminately: would delay proof polling and manual list refreshes. Those reads retain snapshots but still request fresh data.

## Consequences

Cold node readiness is no longer gated by CPU/RAM sampling. First telemetry can arrive on a short subsequent poll; sampled fields may be older than readiness, with their own observation timestamp. Independent pages still poll, but equal in-flight requests and recent values are reused. Resource collection remains process-local and starts on demand; startup/restart clears it. Wallet history synchronization is unchanged and may still contribute latency independently. Candidate Pi measurements use a separate diagnostic process and do not constitute deployment or browser navigation verification.
