# 0014: Egress URL Policy for Operator-Supplied URLs

**Status:** Accepted
**Date:** 2026-09-08

## Context

The V1.5 external security review found that a data source's URL is stored and fetched without any
destination check. `http://minima:9005/vault` is a legal data-source URL, and the backend resolves
it on the Compose network, so an admin-authored data source or HTTP output target reaches the
Minima RPC port — and every other internal service — from inside the trust boundary. ADR 0010 rated
this above every medium finding and below the two highs.

Four egress call sites in `dataSources.service.ts` reach an operator-supplied URL: `readJsonApiSource`,
the `healthStatusUrl` read in `checkDataSourceHealth`, `sendHttpOutput`, and `sendMultipartMediaOutput`.
The last used a bare `fetch` with no validation of any kind.

Three policy shapes were on the table:

- **A — block private ranges by default with an opt-in escape.** Preserves the common LAN case only
  if the escape is easy to reach, which is what makes it weak.
- **B — deny-by-default host allowlist.** Strongest, and what DEVICE-IO-06 originally asked for.
  Highest operator friction on an appliance whose normal job is polling LAN devices.
- **C — block the Compose-internal network, its gateway, and the container service names.**
  Narrowest; closes the documented bypass and nothing else.

## Decision

**Option C.** The finding is that internal service names are reachable, not that LAN access is
wrong in general. B stays open as a later tightening; this ADR records the choice so that
conversation does not have to be reconstructed.

Scheme is constrained unconditionally, independent of the option: `http` and `https` only.

### Protected destinations

Listed explicitly rather than leaving "internal" to the reader:

- The Compose subnet and gateway (`EDGE_STUDIO_DOCKER_SUBNET`, default `172.30.0.0/24`;
  `EDGE_STUDIO_DOCKER_GATEWAY`, default `172.30.0.1`), in IPv4 and IPv4-mapped IPv6 form.
- Compose service names: `backend`, `frontend`, `minima`, `mqtt`, `update-agent`.
- Loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`, `fe80::/10`), `0.0.0.0/8`, `::`,
  and the `host.docker.internal` alias mapped to `host-gateway`.
- The camera and sensor helper endpoints on ports `38180`/`38181`, which sit on the gateway address
  and are therefore already covered by the gateway rule.

Ordinary LAN addresses (`192.168.0.0/16`, `10.0.0.0/8`, and the rest of `172.16.0.0/12` outside the
Compose subnet) stay reachable. That is the point of Option C.

### Resolve, then check, then connect to what was checked

Validating the URL string alone is not enough. The policy resolves the host once with
`dns.lookup(host, { all: true })`, rejects if **any** returned address is protected, and then pins
those addresses to the socket so a resolver answering differently on a second lookup cannot move
the connection. Redirects are fetched with `redirect: "manual"` and every `Location` hop re-runs
the whole check — resolve and pin included — under a hop cap, because `redirect: "follow"` hands
the destination choice to the remote server.

The attack this blocks is the same finding reached more slowly: an operator legitimately configures
`api.vendor.example`, that name later answers `172.30.0.x`, and the fetch lands on `minima`.
Re-validating at fetch time narrows it to a race against our own second lookup; pinning removes the
second lookup.

### The `undici` dependency

Pinning needs control over the socket's address resolution. Node's global `fetch` does not expose a
dispatcher without the `undici` package, and `sendMultipartMediaOutput` sends a `FormData` body, so
dropping to `node:http` (whose `lookup` option would also work) means hand-building multipart.
`undici` is the cheaper path.

Costs accepted:

- A second HTTP stack to keep patched alongside Node's own. Node bundles undici internally, so the
  code was already in the process; the change is that we now track its version explicitly.
- `dataSources.service.test.ts` and `shared/http.test.ts` move their mock boundary off
  `global.fetch` onto `undici`'s `fetch` plus the resolver it validates against.
- A new `Agent` per request, so outbound connection pooling is lost on these paths. Acceptable for
  an appliance polling on a schedule; revisit if Phase 5's concurrency work makes it measurable.

### Host helpers are exempt by construction

`cameraHelperRequest` and `sensorHelperRequest` fetch `env.cameraHelperUrl` / `env.sensorHelperUrl`
— install-time `.env` values, not data-source rows — and they point at exactly the gateway ports the
list above protects. Routing them through the validator would break camera and sensor reads. The
line the policy draws is **API-writable URL versus deployment config**, so `parseJsonApiConfig`,
`parseHttpOutputConfig`, and the four egress sites are the entire surface. `minima.rpc.ts`,
`integritas.service.ts`, `feedback`, and `status` are exempt on the same grounds and keep using
`fetchJsonWithTimeout`.

## Consequences

- A data source or HTTP output target pointed at an internal service is now rejected on save, not
  silently accepted and fetched. Existing rows that violate the policy keep their stored config but
  fail at fetch time with an explicit reason, since config rows predate the validator.
- The backend needs `EDGE_STUDIO_DOCKER_SUBNET` and `EDGE_STUDIO_DOCKER_GATEWAY` in its environment.
  Both compose files pass them through with the same defaults `install.sh` uses. An operator who
  changes the subnet without restarting the backend gets a policy computed from the old default.
- **Residual, recorded rather than closed:** an operator can still point a data source at any other
  host on the LAN, including one they do not control. Option C is a deliberate narrowing, and
  DEVICE-IO-06's allowlist half stays open.

## Alternatives considered

- **Option A or B** — see Context. B remains the tightening path if the LAN threat model changes.
- **Validate the URL string only, without resolving or pinning.** Rejected: it leaves the DNS
  rebinding path open, which is the same finding with one extra step.
- **Re-validate at fetch time without pinning.** Rejected as the primary design, though it is the
  documented fallback had pinning proved infeasible: it narrows the window to a race rather than
  closing it, and would have had to be recorded as an accepted residual in `docs/security/`.
- **Rewrite the URL to the validated IP and set a `Host` header.** Rejected: it breaks TLS SNI and
  certificate validation for `https` targets.
