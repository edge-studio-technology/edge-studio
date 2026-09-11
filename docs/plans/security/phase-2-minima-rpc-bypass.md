[← Back to index](./README.md)

# Phase 2 — Close the Minima RPC bypass

**Status: done** (2026-09-08). Decisions recorded in
[adr/0014](../../adr/0014-egress-url-policy-for-operator-supplied-urls.md) (URL policy) and
[adr/0015](../../adr/0015-minima-console-mutating-subcommands.md) (console subcommands).

**Covers:** SSRF, [10], GAP-12, MINIMA-06/07, DEVICE-IO-06 (partial).

**Was blocked on a decision, and needed its own ADR.** Validation over operator-supplied URLs is a
behavioral change for anyone legitimately pointing a data source at another LAN host. Decide
before writing code:

- **Option A — block private ranges by default, with an opt-in escape.** Preserves the common LAN
  case only if the escape is easy, which weakens it.
- **Option B — deny-by-default allowlist of hosts.** Strongest; most operator friction. This is
  what DEVICE-IO-06 originally asked for.
- **Option C — block only the Compose-internal network and container names.** Narrowest; closes
  the documented bypass and nothing else. Cheapest, and defensible for a LAN appliance.

Recommendation: **C now, with the decision recorded so B stays open.** The finding is that internal
service names are reachable, not that LAN access is wrong in general.

**Protected destinations under C.** The ADR lists these explicitly rather than leaving "internal"
to the reader:

- The Compose subnet and gateway (`EDGE_STUDIO_DOCKER_SUBNET`, default `172.30.0.0/24`;
  `EDGE_STUDIO_DOCKER_GATEWAY`, default `172.30.0.1`), in both IPv4 and IPv4-mapped IPv6
  (`::ffff:a.b.c.d`) form.
- Compose service names: `backend`, `frontend`, `minima`, `mqtt`, `update-agent`.
- Loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`, `fe80::/10`), `0.0.0.0`, `[::]`,
  and the `host.docker.internal` alias mapped to `host-gateway`.
- The camera and sensor helper endpoints on the gateway (ports `38180`/`38181`), which are
  token-protected host services reachable from the Compose network.

1. New `backend/src/shared/url-policy.ts` — one validator, so the rule is not re-implemented per
   call site. Enforce scheme (`http`/`https` only) unconditionally, regardless of which option wins.
2. `backend/src/features/data-sources/dataSources.service.ts` — `parseJsonApiConfig` and
   `parseHttpOutputConfig` call it at parse time, so bad URLs are rejected on save, not on fetch.
3. Re-validate at fetch time on **all four** egress call sites, not two: `readJsonApiSource`,
   `sendHttpOutput`, `sendMultipartMediaOutput` (`dataSources.service.ts:297` — bare `fetch`, no
   validation today, and the path the first draft of this plan missed), and the `healthStatusUrl`
   read in `dataSources.service.ts:239`. Config rows predate the validator and DNS answers change
   between save and fetch.
4. **Resolve, then check, then connect to what you checked.** Validating the URL string alone is
   not enough:
   - Resolve once with `dns.lookup(host, { all: true })` and reject if **any** returned A/AAAA
     address is protected, not just the first.
   - **Pin the validated address to the socket.** Route all four call sites through one egress
     helper in `backend/src/shared/http.ts` that connects to the address already validated, so a
     resolver answering differently on a second lookup cannot move the connection. Concretely: add
     `undici` as a direct dependency and use its `fetch` with `new Agent({ connect: { lookup } })`,
     where `lookup` yields only the validated address. `node:http`'s own `lookup` option would
     also work, but `sendMultipartMediaOutput` sends a `FormData` body, so dropping to `node:http`
     means hand-building multipart — undici is the cheaper path. Costs to accept in the ADR: a
     second HTTP stack to keep patched alongside Node's own, and `dataSources.service.test.ts` /
     `shared/http.test.ts` moving their mock boundary off `global.fetch`.
   - Fetch with `redirect: "manual"` and re-run the whole check — resolve and pin included — on
     every `Location` hop, with a hop cap. `redirect: "follow"` hands the destination choice to the
     remote server.
   - **Why this is not deferrable under Option C.** The attack it blocks is this phase's own
     finding reached more slowly: an operator legitimately configures `api.vendor.example`, that
     name later answers `172.30.0.x`, and the fetch lands on `minima` or `backend`. Re-validating
     at fetch time narrows it to a race against our own second lookup; pinning removes the second
     lookup. If pinning proves infeasible in review, the fallback is to record the TOCTOU as an
     accepted residual in the ADR **and** in `docs/security/` — not to leave it unstated.
5. Admin-gate asymmetries on the same primitives: `GET /api/data-sources/:id/health` has no
   `requireRole("admin")` while `POST /:id/read` does. Same pattern in
   `POST /api/minima/megammrsync/resync` and `POST /api/minima/config` (MINIMA-06/07), and across
   Integritas stamp/history routes (GAP-12). Audit all of `app.ts`'s mounts and align them; this is
   one review pass, not four separate tickets.
6. [10]: `minima-console.catalog.ts` — `parseVerb` whitelists on the first token only, so a
   read-enabled `tokens`/`cointrack`/`maxcontacts` entry accepts its mutating subcommand forms.
   Either constrain the accepted argument shape per entry, or default those three to disabled.
   Constraining is better; disabling is acceptable if it is recorded as a deliberate V1.5 call.

**The host helpers are exempt by construction.** `cameraHelperRequest`
(`cameraCapture.service.ts:80`) and `sensorHelperRequest` (`sensorHelper.service.ts:40`) fetch
`env.cameraHelperUrl` / `env.sensorHelperUrl` — install-time `.env` values, not data-source rows —
and they point at exactly the gateway ports the list above protects. Do not route them through the
validator; that breaks camera and sensor reads. The line the policy draws is API-writable URL
versus deployment config, so `parseJsonApiConfig`/`parseHttpOutputConfig` plus the four egress
sites are the entire surface.

**DEVICE-IO-06 is only partly closed here.** Its text asks for broker/URL allowlists *and*
per-target rate limits across HTTP and MQTT outputs. This phase does HTTP URL validation. MQTT
broker allowlists and per-target rate limits stay open — split the ID in `docs/qa/gaps.md` rather
than ticking it, with the MQTT half pointing at [Phase 0](./phase-0-product-decision-gate.md)'s
broker-auth decision.

**Tests:** `http://minima:9005/vault` rejected at save and at fetch, on each of the four call
sites; `file://`, `gopher://`, a hostname whose *second* A record is internal, `::ffff:127.0.0.1`,
and a `Location` header pointing at an internal host (asserted on the manual redirect, not a
followed one) all rejected; an ordinary external HTTPS URL still accepted. One test must cover the
pinning specifically: a stubbed resolver that returns a public address on the first call and an
internal one on the second must not produce a connection to the internal address. Add a console test per
catalog entry changed, and extend the existing non-public-route smoke test to assert the admin-role
matrix.

**How it landed.** `backend/src/shared/url-policy.ts` is the one validator; `fetchExternalJson` in
`backend/src/shared/http.ts` is the one egress path, using `undici`'s `Agent` with a fixed `lookup`
to pin the validated address and `redirect: "manual"` to re-check each hop. Both parse functions
validate at save time and all four egress sites re-validate at fetch time. `fetchJsonWithTimeout`
is unchanged and still serves the deployment-config callers (`minima.rpc.ts`, `integritas`,
`feedback`, `status`), which must reach internal services.

Writing the IPv6 tests surfaced a real hole in the first draft: `new URL()` re-serializes
`::ffff:127.0.0.1` as `::ffff:7f00:1`, so the textual check for the dotted form missed the address it
existed to catch. The validator now expands IPv6 literals to bytes rather than pattern-matching them.

Option C's residual — an operator can still reach any other LAN host — is recorded as accepted in
`docs/security/data-sources-and-automation.md`, not ticked as closed.

For [10], classification became per accepted argument shape: `tokens` and `maxcontacts` each gained
a default-disabled sibling entry claiming every `action:` outside an explicit read allowlist, so an
action the catalog has never seen fails closed. `cointrack` has no read form and is now `write`
outright.

DEVICE-IO-06 was split in `docs/qa/gaps.md` rather than ticked: **06a** (HTTP URL validation) is
closed, **06b** (MQTT broker allowlists, per-target rate limits) stays open and points at
[Phase 0](./phase-0-product-decision-gate.md)'s broker-auth decision and
[Phase 7](./phase-7-retention-redaction-budgets.md)'s budgets.
