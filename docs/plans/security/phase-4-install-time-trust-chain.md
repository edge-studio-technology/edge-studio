[← Back to index](./README.md)

# Phase 4 — Fix the install-time trust chain

**Status: done** (2026-09-09). Decisions recorded in
[adr/0016](../../adr/0016-install-time-bootstrap-trust-set.md).

**Covers:** [1] (high), [4].

These are distinct failures with distinct fixes; ADR 0010 explains why collapsing them loses the
more persistent one.

- **[1] The bundle supplies its own verifier and trust anchor.** `install.sh` extracts
  `edge-studio-runtime.tar.gz` with no signature or digest check, and that archive ships both
  `scripts/verify-manifest.mjs` and `update-agent/manifest-public-key.pem`. Compromise of
  `edgestudio.technology` alone is then sufficient and persistent. Four parts, in order:
  1. **Embed `manifest-public-key.pem` in `install.sh` itself** — the key stops travelling with
     the artifact it authenticates. Small, and it makes the bundle's integrity verifiable.
  2. **Sign the bundle** and verify it **before extraction** — `install.sh:465` is a bare
     `tar -xzf` today. Verifying after extraction is not equivalent: the extraction is itself the
     untrusted operation. Anchored on (1), since the verifier must not come from the bundle.
  3. **Pin the verifier's runtime.** The signature check runs `node:20-bookworm-slim` by mutable
     tag (`install.sh:535`). It is `--network none` with read-only mounts, so the realistic attack
     is a substituted image exiting `0` on a bad signature rather than exfiltration — but it is the
     one process whose verdict the rest of the chain rests on. Pin it by digest, or drop the
     container and verify on the host, so the bootstrap trust set is one key plus one pinned
     digest.
  4. **Validate archive entries** — reject absolute paths, `..` components, and links resolving
     outside the extraction directory, so a hostile bundle cannot write outside `$tmp_dir` even
     before its signature is judged.
  Do (1) first; it is the load-bearing change. Then (2)-(4).
  Coordinate with `plans/replace-openssl-manifest-verification.md` before touching the verifier.
- **[4] `curl | sudo bash` — mitigated, then accepted, not closed.** A checksum served from the
  same host as the script closes nothing: whoever can change the script can change the checksum.
  Real closure needs an immutable, versioned installer URL with a detached signature and a key
  distributed independently of `edgestudio.technology` — release infrastructure, not a plan step.
  For V1.5: document a download-inspect-run path in `README.md` alongside the one-liner, publish
  the checksum for that path, and record the one-liner in `SECURITY.md` as an **accepted residual
  risk** with the conditions above as its exit criteria. Do not tick [4] as fixed in the register.

**Verification:** `bash -n install.sh`, plus a real install against a staging manifest. This phase
is the one most likely to break installs — do not merge it on static checks alone.

**How it landed.** `install.sh` carries the whole bootstrap trust set: the Ed25519 public key and the
verifier source as embedded heredocs written to a private `mktemp -d` on start and removed on exit,
and `VERIFIER_IMAGE` pinned to the `node:20-bookworm-slim` multi-arch index digest. One
`verify_ed25519_signature()` now serves both artifacts. CI signs `edge-studio-runtime.tar.gz` with the
same key as the manifest and publishes `edge-studio-runtime.tar.gz.sig`; `install.sh` fetches both,
verifies before `tar -xzf`, and fails closed if either is missing. `assert_safe_archive_entries()`
then rejects absolute paths, `..` components, and anything that is not a regular file or directory.

`scripts/verify-manifest.mjs` is deleted and both it and `manifest-public-key.pem` are out of
`runtime-bundle-files.json` — the verifier and the trust anchor no longer travel with anything they
authenticate, and there is no second copy in `$APP_DIR` to reach for by mistake. Keeping the standalone
file as a byte-diff fixture was considered and dropped: `scripts/tests/install-bootstrap-trust-set.test.ts`
extracts the embedded verifier and tests what it *does* (accepts a signed binary artifact, rejects a
modified one, rejects another key's signature, exits non-zero on unreadable input), plus asserts the
digest pin, the key matching `update-agent/manifest-public-key.pem`, and the bundle list.

**Installs fail closed against pre-Phase-4 bundles.** Every release channel needs one release through
the updated workflow before an installer carrying this change can install from it.

[4] is mitigated and accepted, not closed: the release pipeline publishes `install.sh.sha256` into the
manifest repo (a different repository from the `main`-branch raw URL the one-liner uses), `README.md`
documents a tag-pinned download-verify-read-run path, and `SECURITY.md` plus
`docs/security/host-and-infrastructure.md` record the one-liner as an accepted residual with an
immutable signed installer URL as its exit criteria.
