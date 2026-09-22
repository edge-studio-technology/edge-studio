# 0022: Error State Scope Tiers

**Status:** Accepted
**Date:** 2026-09-22

## Context

Every load failure in the app rendered the same component: `ErrorAlert`, a red-stroked, red-washed
banner with `role="alert"`. It was used at three different scopes at once — a degraded slice of a
working Dashboard, a whole missing table on Wallet / Devices / Workflows / Diagnostics, and
form-level validation — so nothing in the UI distinguished "one metric is stale" from "this list
didn't load."

Three effects compounded on a single backend outage:

- A red-washed box sitting where a table belongs reads as a thrown exception, not as absent data.
  The same absence rendered as `EmptyContentState` reads as "nothing here yet."
- The body text was the raw `TypeError` from `fetch` — `Failed to fetch` — which names nothing an
  operator can act on and is the strongest crash signal on the screen.
- The failure was announced many times over. One unreachable backend produced two banners plus six
  `MetricCard` values in `text-text-error` on the Dashboard alone, implying eight independent
  faults.

The product's actual failure mode is a service being down or restarting — a Pi prototype with a
Minima node, an Integritas API, and host helpers that legitimately go away and come back. That
should read as unavailability, not as the app crashing.

Loading and empty already had a shared, calm content-state vocabulary (`LoadingState`,
`EmptyContentState`, both on the exported `contentStatePanelClass`). Failure did not, so it
borrowed the banner.

## Decision

Error presentation is chosen by **scope** — how much of the surface the failure removed — not by
severity of the underlying cause:

| Scope                                                | Component                                      |
| ---------------------------------------------------- | ---------------------------------------------- |
| A table/list/region has nothing to show               | `ErrorContentState`, in place of that content  |
| Page still works, one slice degraded                  | `ErrorAlert` banner                            |
| Transient action failure                              | toast                                          |
| Per-control validation                                | field `error`                                  |

`ErrorContentState` shares `contentStatePanelClass` with the loading and empty states, so the three
swap cleanly in one slot. Severity is carried by an `AlertCircle` in `icon-error` alone — no fill
wash — because the page is not broken, only empty.

It announces with `role="status"` / `aria-live="polite"`, not `role="alert"`. It replaces content
that was already being awaited, so it is the resolution of a pending `LoadingState` rather than an
interruption; assertive announcement is reserved for the banner, which fires against content the
user is already reading.

Call sites hide the failed content's own toolbar, filter bar, and pager along with it. Leaving them
implies data that isn't there — Wallet's `Showing 0 of 0` under a failed fetch actively asserts an
empty result set, which is a different and wrong claim.

`describeLoadFailure()` (`frontend/src/lib/errors.ts`) maps bare browser transport text
(`Failed to fetch`, `NetworkError…`, `Load failed`, `fetch failed`) to a service-unreachable
sentence and passes everything else through untouched. Real backend messages are already
operator-readable; only the transport layer's own text is not.

Dashboard metric cards that read `Unavailable` use `neutral`, not `error`. The banner above them
already states the failure once.

## Alternatives rejected

**Recolour `ErrorAlert` (softer tint, or `warning` status) and keep one component.** Leaves
`Failed to fetch` as the body text, so the crash signal survives the restyle; and it would drag the
banner's tone down at the Dashboard call site, where a saturated alert is correct.

**Add a `muted` / `tertiary` tone to `MetricCard` for unavailable values.** `Status` is a shared
union (`app/types.ts`) used by `Pill` and `StatusRow` too, so a new member ripples well past the one
surface that wanted it. `neutral` already removes the false multiplicity; a dedicated muted tone can
follow if the flat-black `Unavailable` proves too assertive in practice.

**Normalize `Failed to fetch` centrally in `lib/api.ts`.** That text is also surfaced in toasts and
`ErrorDetailPanel`, where the literal native message is worth keeping for diagnosis. Mapping at the
presentation call site keeps the raw value intact everywhere else.
