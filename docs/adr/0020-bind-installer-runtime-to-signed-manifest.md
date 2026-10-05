# 0020: Bind Installer Runtime to the Signed Manifest

**Status:** Accepted
**Date:** 2026-09-16

## Context

The release installer verified the update manifest and runtime bundle with detached Ed25519
signatures, but selected the bundle independently from the signed manifest. Any bundle previously
signed by the release key could therefore be combined with a newer signed manifest. The installer
also replaced application files before discovering that the manifest was missing, invalid, or
untrusted.

Release manifests already contain the URL and SHA-256 of the exact runtime bundle produced by the
same workflow. The installer needed to enforce that existing binding without removing the explicit
runtime URL override used for QA or the GitHub Raw transport fallback.

## Decision

In release mode, `install.sh` verifies and parses the signed manifest before downloading the runtime
bundle. Manifest JSON is parsed by an embedded helper running in the same digest-pinned Node image as
the signature verifier. It requires an HTTP(S) `hostRuntime.url` and a 64-character hexadecimal
`hostRuntime.sha256`.

The signed runtime URL is the default download source. An explicit `RUNTIME_BUNDLE_URL` may replace
that source for QA, but it never replaces the signed SHA-256. The fixed GitHub Raw bundle remains the
transport fallback when no explicit override was provided. Every downloaded candidate must pass its
detached signature check and match the signed manifest hash.

Manifest and bundle files stay in private temporary directories. Archive validation and extraction
also complete there. Only after all checks pass does the installer create, clean, or copy files into
`APP_DIR`.

Artifact signature URLs append `.sig` to the URL pathname with the pinned Node URL parser, preserving
query strings used by authenticated mirrors or QA servers.

## Alternatives considered

- **Rely on the bundle's detached signature alone.** Rejected because it authenticates who signed the
  bundle, not which signed release manifest names it.
- **Let `RUNTIME_BUNDLE_URL` override the expected hash.** Rejected because a URL-and-hash override
  would remove the manifest binding precisely on the QA path most likely to exercise alternate
  delivery infrastructure.
- **Remove the GitHub Raw bundle fallback.** Rejected because release manifests mirrored to GitHub
  still name the primary-domain bundle, and a primary delivery outage should remain recoverable.
- **Parse the manifest with shell text tools.** Rejected because JSON structure and types must be
  validated before values cross into shell variables.

## Consequences

- A signed bundle from another release or channel is rejected when its bytes do not match the signed
  manifest digest.
- Mirror lag fails closed instead of silently combining artifacts from different releases.
- Manifest, signature, hash, and archive failures leave an existing application directory untouched.
- Release-mode installation performs additional short-lived invocations of the pinned Node image for
  JSON and URL parsing.
- `DEV_MODE=true` continues to clone source and intentionally remains outside this release-artifact
  trust flow.

## Where this lives in code

- `install.sh` — bootstrap manifest parser, signature URL resolver, manifest-first release flow, and
  runtime SHA-256 enforcement.
- `scripts/tests/install-bootstrap-trust-set.test.ts` — embedded parser and URL resolver behavior.
- `.github/workflows/release.yml` — runtime SHA-256 creation and signed manifest publication.
