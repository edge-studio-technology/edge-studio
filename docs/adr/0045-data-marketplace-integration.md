# 0045: Data Marketplace Integration Through a Backend-Held Installation Key

**Status:** Accepted
**Date:** 2026-11-18

## Context

The Edge Studio Data Marketplace is a separate service where a publisher sells data from Integritas-verified
devices. The marketplace operator issues each Edge Studio installation one secret key. Every call made with it
states the acting Edge Studio user (`X-Edge-Studio-User`) and a marketplace role
(`X-Edge-Studio-Role: owner | publisher | viewer`). The marketplace never reaches into Edge Studio: it only knows
the sources and proofs an installation pushes to it. A publisher's local delivery service reports heartbeats and
its public delivery address, but only Edge Studio holds the key.

Edge Studio has a single local role, `admin`.

## Decision

- **The key is deployment configuration.** `MARKETPLACE_URL` and `MARKETPLACE_INSTALLATION_KEY` live in `.env`
  (ADR 0041: issued credentials and service endpoints stay out of SQLite runtime settings). Only the backend reads
  them; the browser gets `{ configured, url, role }` and nothing else. The URL must be `https`, or `http` on
  `localhost`/`127.0.0.1` for development, because the key travels in a header.
- **Deployment-config egress.** The marketplace URL is not API-writable, so calls use `fetchJsonWithTimeout()`
  like Integritas and feedback, not the operator-URL egress policy (ADR 0014).
- **Role mapping.** `admin` maps to `owner`; any other role maps to `viewer`. The frontend shows create/publish
  actions only for `owner`/`publisher`. Publisher mutations also require `requireRole("admin")`.
- **Fixed allowlist, not a proxy.** The backend exposes named routes for publisher sources/listings/earnings,
  listing create/edit/transition and the public catalogue. A transition forwards only `to`. Payout-wallet routes
  are not exposed: a wallet change needs the owner's separate authorisation on the marketplace website.
- **Ids are checked before forwarding.** A path id that is only dots (or contains a slash) is refused with 400: `fetch` collapses dot segments, so `/sources/../delivery` would otherwise leave the allowlist. Requests never follow redirects, and the delivery routes are rate-limited and refuse a secret shorter than 32 characters.
- **Error mapping.** A marketplace that cannot be reached, or answers 5xx, becomes a 503
  `marketplace_unavailable`; a 4xx passes through with `errorCode: marketplace_<error>`, which also keeps a
  marketplace 401 from being read as an expired Edge Studio session.
- **Source push.** Input data sources (not `*-output` targets) are pushed with `PUT /api/integration/sources/:id`
  at start-up and when a source is created/edited/deleted or one of its Integritas proofs becomes ready; deleted
  sources and output targets are removed with `DELETE` (404 counts as done). Changes within one second share a
  push; unreachable or 5xx pushes retry every 60 seconds. Pushes act as user `edge-studio`, role `owner`.
- **Proof fields come from stored data only.** `attestations` is the number of ready Integritas proofs linked to
  the source's reads and `verified` is `attestations > 0`. The newest ready proof gives
  `reference: integritas:uid:<proof uid>`, `fingerprint` (its SHA3-256 hash) and `attestedAt` (when it was
  stamped). `nodePublicKey` is the local Minima node's Maxima public key (`maxima` RPC), the installation's node
  identity. No `coverage` is sent because Edge Studio does not record one. A source without a ready proof is
  pushed with `proof: null`. If a proof exists but the node key cannot be read, the push is retried rather than
  sent without a proof, so a node hiccup never downgrades a published source.
- **Delivery relay.** The delivery service calls `PUT /api/marketplace/delivery/sources/:id/address` and
  `POST /api/marketplace/delivery/sources/:id/heartbeat`, outside session auth, with
  `Authorization: Bearer <MARKETPLACE_DELIVERY_SECRET>`. The secret is separate from the installation key so the
  delivery service never holds the key. It is compared in constant time (SHA-256 digests with
  `timingSafeEqual`); an unset secret refuses every call. The address change is made as `owner` (where buyers are
  sent is the owner's decision), the heartbeat as `publisher`.

## Alternatives considered

- **Store the key in SQLite through the settings/secrets service with a Settings form.** Deferred: the key is
  issued per installation by the operator, like helper tokens, and a form adds a secret-entry surface no case
  requires.
- **A generic `/api/marketplace/*` pass-through.** Rejected: it would expose whatever the marketplace adds later,
  including payout-wallet changes, under Edge Studio's key.
- **Let the marketplace pull sources from Edge Studio.** Rejected by the marketplace contract; it would also need
  an inbound route on a LAN appliance.
- **Push the Integritas proof `address` or `root` as the node key.** Rejected: neither is a node public key, and
  the marketplace labels the field as the attesting node's key.
- **Reuse the installation key for the delivery service.** Rejected: a second program would then hold the key
  that lists, prices and publishes the seller's data.

## Consequences

- Edge Studio has one local role, so every signed-in user acts as marketplace `owner`. The `viewer` path exists
  in the mapping and UI, but no Edge Studio role reaches it until a second role is added.
- The push queue is in memory. A removal pending when the backend stops is lost; the start-up push re-sends
  current sources but cannot know a source that was deleted while the marketplace was unreachable.
- Deleting or archiving proof history does not trigger a push; the attestation count catches up on the next
  source change, new ready proof or restart.
- A changed key or URL needs a backend restart, like other `.env` values.

## History

- 2026-11-18: Initial decision.
