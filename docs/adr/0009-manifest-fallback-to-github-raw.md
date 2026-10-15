# 0009: Manifest Delivery — Own Domain, GitHub Raw Fallback

**Status:** Accepted
**Date:** 2026-08-17

## Context

`update-agent` and `install.sh` fetch a signed manifest (`manifest.json` + `.sig`) and the runtime
bundle. The release workflow pushes all three into the public `edge-studio-manifests` repo on every
release. The Ed25519 signature check is the trust boundary; where the manifest is fetched from
does not affect trust.

A VPS pull model was originally planned (CI pushes to the manifest repo via a GitHub App, a VPS
cron job pulls it, nginx serves it), but the VPS side was never built. A VPS mirror at
`edgestudio.technology` later went live.

## Decision

- Default `MANIFEST_URL` is our own domain:
  `https://edgestudio.technology/manifest/release/manifest.json`.
- `update-agent`'s `fetchVerifiedManifest()` tries `MANIFEST_URL` first, then once against the
  hardcoded `MANIFEST_FALLBACK_URL` on `raw.githubusercontent.com`. If both fail, the primary
  error is thrown. Either source passes the same signature check.
- `install.sh` has the same fallback for the manifest and `.sig`, and for the runtime bundle unless
  the operator set `RUNTIME_BUNDLE_URL`.

## Alternatives considered

- **GitHub raw only.** Used from 2026-08-17 to 08-18. Works with no infrastructure, but gives up
  the option to change delivery independently of GitHub.
- **Own domain only.** Reintroduces a single point of failure on our server or DNS.
- **The original VPS pull plan without GitHub raw.** Cron, pull script, and nginx to maintain for a
  job a public repo already does.
- **Private manifest repo via the authenticated contents API.** Devices would need a GitHub
  credential to read files whose integrity is already signature-verified; the repo holds nothing
  secret.
- **Env-configurable fallback URL.** More config surface with no current need.

## Consequences

- An outage of our manifest server needs no operator action.
- `raw.githubusercontent.com` caches for a few minutes and caps blobs near 100 MB with no LFS; fine
  for the current manifest and bundle sizes and the 30-minute poll.
- The release workflow must keep the GitHub copy in sync.
- Installs with an explicit `MANIFEST_URL` are unaffected by default changes.

## History

- 2026-08-17: Default moved from the never-built VPS plan to GitHub raw (was ADR 0008).
- 2026-08-18: Own domain primary, GitHub raw as fallback.
