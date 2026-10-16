# 0016: Install-Time Trust Chain

**Status:** Accepted
**Date:** 2026-09-09

## Context

External security review finding [1] (high): `install.sh` downloaded `edge-studio-runtime.tar.gz`
and extracted it with a bare `tar -xzf`, no signature, no digest. That archive shipped the manifest
verifier and the public key, which `install.sh` then used to judge the manifest from the same
origin. Whoever controlled the origin controlled the verdict, and the substituted bundle persisted
across updates because it also carries the Compose files, CLI, and host helpers.

Once the bundle was signed, a second gap remained: it was selected independently of the signed
manifest, so any bundle ever signed by the release key could be paired with a newer manifest, and
application files were replaced before the manifest was known to be valid.

Finding [4] (medium) sits above both: the documented one-liner pipes `main`'s `install.sh` into
`sudo bash`.

## Decision

1. **The bootstrap trust set lives in `install.sh`:** the Ed25519 public key and the verifier
   source as embedded heredocs (the verifier written to a private `mktemp -d` and removed on exit),
   and the verifier runtime pinned to the `node:22-bookworm-slim` multi-arch index digest. Neither
   the key nor the verifier travels in any artifact they authenticate.
2. **Verification runs in that pinned container** with `--network none` and read-only mounts.
   Raspberry Pi OS Bullseye's OpenSSL 1.1.1 can't do Ed25519 and a host Node isn't a dependency;
   Docker is already required. The digest is pinned because a substituted image exiting `0` on a
   bad signature is the one verdict the chain rests on.
3. **Manifest first.** In release mode `install.sh` verifies and parses the signed manifest (JSON
   parsed by an embedded helper in the same pinned image, requiring an HTTP(S) `hostRuntime.url` and
   a hex `hostRuntime.sha256`) before downloading the bundle.
4. **Bundle bound to the manifest.** The bundle is signed with the same key (`.sig` beside it), and
   every candidate must pass its signature and match the manifest's SHA-256. `RUNTIME_BUNDLE_URL`
   may replace the source for QA but never the hash. The GitHub raw bundle stays the transport
   fallback (ADR 0009). Signature URLs append `.sig` to the pathname, preserving query strings.
5. **Archive checks before extraction:** entries with absolute paths or `..`, and anything that is
   not a regular file or directory, are rejected.
6. **Nothing touches `APP_DIR` until every check passes.** Download, verification, and extraction
   happen in private temp directories.
7. **`curl | sudo bash` is an accepted residual risk.** The release pipeline publishes
   `install.sh.sha256` into the manifest repo, and `README.md` documents a download-verify-read-run
   path against a tag-pinned URL. Exit criteria are recorded in `SECURITY.md`.

## Alternatives considered

- **Keep `scripts/verify-manifest.mjs` with a byte-diff test against the embedded copy.** Two copies
  can drift; one embedded copy with behaviour tests (accept, reject modified, reject other key,
  non-zero on unreadable input) can't.
- **Verify after extraction.** Extraction is itself the untrusted operation.
- **A second keypair for the bundle.** Same pipeline, same secret, same step; doubles rotation
  surface without separating a real trust domain.
- **Rely on the bundle signature alone.** Proves who signed it, not which release names it.
- **Let `RUNTIME_BUNDLE_URL` override the hash.** Removes the binding on exactly the path that
  exercises alternate delivery.
- **Drop the GitHub raw bundle fallback.** A primary outage should stay recoverable.
- **Parse the manifest with shell tools.** Structure and types must be validated before values
  reach shell variables.
- **A checksum next to the script on the same host** for finding [4]. Whoever can change one can
  change the other; real closure needs an immutable, signed, versioned installer URL.

## Consequences

- Installs fail closed against unsigned bundles: every release channel needs one release through
  the updated workflow before installs from it work.
- A signed bundle from another release or channel, or mirror lag, fails closed.
- Manifest, signature, hash, and archive failures leave an existing installation untouched.
- Key rotation touches `update-agent/manifest-public-key.pem` and the embedded PEM;
  `scripts/tests/install-bootstrap-trust-set.test.ts` fails the build if they drift.
- The verifier image digest is bumped by hand.
- `install.sh` itself remains the trust root; that is finding [4], stated rather than implied.
- `DEV_MODE=true` clones source and stays outside this flow.

## History

- 2026-09-16: Bundle bound to the signed manifest's SHA-256; manifest verified first; nothing
  written to `APP_DIR` until all checks pass (was ADR 0020).
