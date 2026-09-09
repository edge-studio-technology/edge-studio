# 0016: Install-Time Bootstrap Trust Set

**Status:** Accepted
**Date:** 2026-09-09

## Context

The V1.5 external security review, finding [1] (high): `install.sh` downloaded
`edge-studio-runtime.tar.gz` over HTTPS and extracted it with a bare `tar -xzf`, no signature and no
digest. That archive shipped both `scripts/verify-manifest.mjs` and
`update-agent/manifest-public-key.pem` — the verifier and the trust anchor — which `install.sh` then
used to judge the signed image manifest served from the same origin. Whoever controlled that origin
controlled the verdict. The legitimate manifest signing key was not needed, and the result persisted
across updates because the substituted bundle also carries the Compose files, the CLI, and the host
helper scripts.

Finding [4] (medium) is the layer above it: the documented install and upgrade command pipes
`raw.githubusercontent.com/.../main/install.sh` straight into `sudo bash`, from a mutable branch,
with no pinned version and no detached signature.

ADR 0010 ordered [1] as one of the two highs. This is Phase 4 of
[plans/security-hardening-v1-5.md](../plans/security-hardening-v1-5.md).

## Decision

### The bootstrap trust set lives in `install.sh`

`install.sh` now carries three things that previously came out of the bundle or off a mutable tag:

1. The Ed25519 public key, as an embedded heredoc.
2. The verifier source, as an embedded heredoc, written to a private `mktemp -d` at start of run and
   removed on exit.
3. The verifier's runtime, pinned to the `node:20-bookworm-slim` multi-arch index digest rather than
   the tag.

`scripts/verify-manifest.mjs` is deleted and both it and `manifest-public-key.pem` are dropped from
`runtime-bundle-files.json`. The verifier and the key no longer travel with any artifact they
authenticate, and there is no second copy in `$APP_DIR` for a future change to reach for by mistake.

We considered keeping `scripts/verify-manifest.mjs` as the canonical source with a byte-diff test
against the embedded copy. Deleting it is better: one copy cannot drift, and the test can assert what
the embedded verifier *does* — accepts a correctly signed binary artifact, rejects a modified one,
rejects a signature from another key, exits non-zero rather than throwing on unreadable input —
instead of asserting that two files are the same.

### The runtime bundle is signed, and verified before extraction

CI signs `edge-studio-runtime.tar.gz` with the same Ed25519 key that signs the manifest and publishes
`edge-studio-runtime.tar.gz.sig` beside it. `install.sh` downloads both, fails if either is missing,
and verifies before `tar -xzf`. Verifying after extraction would not be equivalent: extraction is
itself the untrusted operation, and the bundle's contents include shell and Python the installer goes
on to run as root.

One key, not two. The manifest and the bundle are published by the same pipeline from the same
secret, in the same release step; a second keypair would double the rotation and storage surface
without separating any trust domain that is actually separate.

### Archive entries are validated behind the signature

After the signature passes and before extraction, `install.sh` rejects any entry with an absolute
path or a `..` component, and any entry that is not a regular file or a directory. The bundle is
built from a flat list of regular files, so symlinks, hardlinks, and device nodes are refused
outright rather than having their targets resolved — a stricter rule that is also a simpler one. This
is defense in depth against a bundle signed with a compromised key or a malformed release, not
against the case the signature already covers.

### Verification runs in a pinned container, not on the host

The check stays inside `docker run --rm --network none` with read-only mounts, and gains a digest.
Host-side verification was reconsidered and rejected for the same reason
[plans/replace-openssl-manifest-verification.md](../plans/replace-openssl-manifest-verification.md)
moved it into a container: Raspberry Pi OS Bullseye ships OpenSSL 1.1.1, whose `pkeyutl` cannot do
Ed25519, and a host Node is not a dependency this installer has. Docker is already a hard requirement
checked before this point.

With `--network none` and three read-only file mounts, the realistic attack on an unpinned tag was
never exfiltration — it was a substituted image exiting `0` on a bad signature. That is the one
verdict the rest of the chain rests on, so it gets pinned. The pin is the multi-arch OCI index digest,
which resolves per-platform, so one value covers arm64, armv7, and amd64.

### `curl | sudo bash` is accepted, not closed

Publishing a checksum next to the script on the same host closes nothing: whoever can change one can
change the other. Real closure needs an immutable, versioned installer URL with a detached signature
and a key distributed independently of the repository — release infrastructure, not a plan step.

For V1.5: the release pipeline publishes `install.sh.sha256` into the manifest repo, a different
repository and path from the `main`-branch raw URL the one-liner uses, and `README.md` documents a
download-verify-read-run path against a tag-pinned installer URL. The one-liner stays, and is recorded
in `SECURITY.md` and `docs/security/host-and-infrastructure.md` as an **accepted residual risk** with
those conditions as its exit criteria. It is not ticked as fixed.

## Consequences

- The install-time trust set is one embedded key, one embedded verifier, and one pinned digest.
  `install.sh` itself remains the trust root; that residual is [4], now stated rather than implied.
- **Installs fail closed against unsigned bundles.** An installer carrying this change cannot install
  from a release channel whose latest `edge-studio-runtime.tar.gz` was published before it. Every
  channel needs one release through the updated workflow before installs from it work again.
- Key rotation now touches two files: `update-agent/manifest-public-key.pem` and the embedded PEM in
  `install.sh`. `scripts/tests/install-bootstrap-trust-set.test.ts` fails the build if they drift, and
  `scripts/release/generate-signing-key.mjs` prints the reminder.
- The verifier image digest is bumped by hand at release. A stale pin means verification runs on an
  older Node in a network-less container that reads three files — acceptable to let age between
  deliberate bumps.
- `$APP_DIR/scripts/` now holds only `generate-tls-cert.sh` after a bundle install. `DEV_MODE=true`
  still clones the full repo and still skips manifest verification; the bundle path is the only one
  this ADR governs.
