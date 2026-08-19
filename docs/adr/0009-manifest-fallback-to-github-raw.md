# 0009: Own-Domain Manifest as Primary, GitHub Raw as Fallback

**Status:** Accepted
**Date:** 2026-08-18

## Context

ADR 0008 moved manifest delivery from a planned VPS origin straight to `raw.githubusercontent.com`,
since no VPS-side serving was ever built. A VPS-served manifest is now live at
`https://edgestudio.technology/manifest/release/manifest.json` (nginx serving a cron-pulled mirror of
the public `edge-studio-manifests` repo), giving us a domain we control for future flexibility and
branding. Relying on it alone reintroduces the single-point-of-failure risk ADR 0008 avoided: if our
server or DNS has an outage, `update-agent` can't check for updates until it's fixed.

## Decision

- `install.sh`'s `DEFAULT_MANIFEST_URL` now points at our own domain:
  `https://edgestudio.technology/manifest/release/manifest.json`.
- `update-agent/src/manifest/manifest.service.ts`'s `fetchVerifiedManifest()` tries `env.manifestUrl`
  (defaulted or operator-overridden) first. If that fetch fails for any reason, it retries once
  against a fixed constant, `MANIFEST_FALLBACK_URL`, pointed at
  `https://raw.githubusercontent.com/edge-studio-technology/edge-studio-manifests/main/edge-studio/release/manifest.json`.
  If both fail, the original (primary) error is thrown.
- The fallback URL is a hardcoded constant, not a new env var — kept minimal to ship during testing.
  Whichever source succeeds still goes through the same Ed25519 signature check (embedded public
  key) before being trusted, so the trust boundary from ADR 0008 is unchanged.
- `install.sh` gets the same fallback, since a fresh install during a primary-server outage should
  succeed too, not just already-running `update-agent` instances: `download_runtime_bundle()` retries
  the bundle download against a URL derived from `MANIFEST_FALLBACK_URL` if the primary-derived one
  fails (skipped when the operator passed an explicit `RUNTIME_BUNDLE_URL`), and
  `fetch_and_verify_manifest()` retries the manifest + `.sig` fetch against `MANIFEST_FALLBACK_URL` if
  the configured `MANIFEST_URL` fails.

## Alternatives considered

- **Env-configurable fallback URL.** Rejected for now: adds config surface (another `.env` value, another
  thing to keep in sync across installs) with no current need — the GitHub raw mirror is guaranteed to
  exist as long as releases ship. Can be added later if a real need shows up.
- **Keep GitHub raw as the sole/primary source (status quo from ADR 0008).** Rejected: doesn't use the
  domain we now have, and gives up the option to change manifest delivery independently of GitHub in
  the future.

## Consequences

- `update-agent` tolerates a temporary outage of our own manifest server without any operator action.
- One extra fetch (and one extra failure) on the slow path only; the common case (our server healthy)
  is unchanged from before this ADR.
- The GitHub raw copy must keep being kept in sync by the existing release workflow for the fallback
  to be meaningful; nothing new to maintain beyond what ADR 0008 already relies on.
- A fresh install's default manifest source changed again (VPS -> GitHub raw in ADR 0008, now back to
  our own domain as primary). Existing installs with an explicit `MANIFEST_URL` are unaffected.

## Where this lives in code

- `install.sh` — `DEFAULT_MANIFEST_URL`, `MANIFEST_FALLBACK_URL`, `download_runtime_bundle`, `fetch_and_verify_manifest`.
- `.env.example` — `MANIFEST_URL` comment.
- `update-agent/src/manifest/manifest.service.ts` — `MANIFEST_FALLBACK_URL`, `fetchManifestBytesAndSignature`, `fetchVerifiedManifest`.
