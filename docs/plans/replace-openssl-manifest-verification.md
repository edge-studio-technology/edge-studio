# Replace OpenSSL Manifest Verification Plan

**Status:** Not started
**Created:** 2026-07-28
**Goal:** Replace `install.sh`'s host-`openssl`-dependent Ed25519 manifest signature check with a verification run inside a disposable, pinned Node container, so it works regardless of the host's OpenSSL version.

## Context

`install.sh`'s `fetch_and_verify_manifest()` verifies the Ed25519 signature on the update manifest using the host's `openssl pkeyutl -verify`. Ed25519 support in `pkeyutl` requires OpenSSL 3.x, which isn't guaranteed on older/smaller devices (e.g. Raspberry Pi OS Bullseye ships OpenSSL 1.1.1). The script already knows this is broken: when it detects OpenSSL < 3 it prints a large "SIGNATURE VERIFICATION IS DISABLED... THIS IS TEMPORARY" warning and **installs the manifest's images completely unverified**. That's the actual security hole to close, not just a version-compat annoyance.

Docker is already a hard requirement for this whole project (`verify_docker` runs before `download_app`/`resolve_images` in `main()`), so it's safe to depend on here too. The fix: run the verification inside a disposable, pinned `node:20-bookworm-slim` container (same tag already used by `backend/Dockerfile`, `frontend/Dockerfile`, `update-agent/Dockerfile`) using Node's built-in `node:crypto` `verify()` — exactly what `update-agent/src/manifest/manifest.service.ts`'s `fetchVerifiedManifest()` already does at runtime for the same manifest/signature pair. This guarantees Ed25519 verification always works regardless of host OpenSSL version, and removes the insecure bypass entirely — no more silent "install unverified" path.

**Scope decision (discussed and confirmed):** only the manifest-signature verification changes for now. `openssl rand -hex 32` (`APP_SECRET`/`CAMERA_HELPER_TOKEN` generation) and `scripts/generate-tls-cert.sh`'s `openssl req -x509` self-signed cert generation stay as-is — neither has a version-hard-requirement problem (they've worked on ancient OpenSSL for decades), so `openssl` stays in `install.sh`'s `APT_PACKAGES`. Whether to remove those too is left for a follow-up discussion, not decided here.

## Implementation

### 1. New standalone verify script: `scripts/verify-manifest.mjs`

Zero-dependency Node script, mirroring the existing style of `scripts/release/sign-manifest.mjs` (which already does the inverse operation with `node:crypto`'s `sign()`):

- Args: `<manifest-path> <signature-b64-path> <public-key-pem-path>`.
- Reads manifest bytes, reads the signature file as a base64 string and `Buffer.from(sig, "base64")` — no separate `base64 -d` shell step needed, unlike the current `.sig.bin` decode.
- Reads the PEM public key, calls `crypto.verify(null, manifestBytes, { key: pem, format: "pem" }, signatureBuffer)` — same call shape as `update-agent`'s `fetchVerifiedManifest()` in `update-agent/src/manifest/manifest.service.ts`.
- Exits `0` and prints nothing on success; exits `1` and prints a one-line error to stderr on failure (bad signature, missing/unreadable files, malformed key).

This file ships in the repo, so it's already present at `$APP_DIR/scripts/verify-manifest.mjs` by the time `fetch_and_verify_manifest` runs — `download_app` (which clones/copies the full repo into `$APP_DIR`) always runs before `resolve_images` in `main()`.

### 2. Rewrite `fetch_and_verify_manifest()` in `install.sh`

Replace the `base64 -d` decode + OpenSSL-version-detect + `openssl pkeyutl -verify` block (currently lines ~391-414) with a single `docker run`:

```bash
if ! docker run --rm --network none \
  -v "$APP_DIR/scripts/verify-manifest.mjs:/verify-manifest.mjs:ro" \
  -v "$manifest_file:/manifest.json:ro" \
  -v "$signature_file:/manifest.json.sig:ro" \
  -v "$public_key_file:/manifest-public-key.pem:ro" \
  node:20-bookworm-slim node /verify-manifest.mjs /manifest.json /manifest.json.sig /manifest-public-key.pem; then
  echo "Manifest signature verification failed. Refusing to install untrusted images."
  rm -f "$manifest_file" "$signature_file"
  exit 1
fi
```

- `node:20-bookworm-slim` matches the tag already pinned in the three project Dockerfiles — no new image version to track, and it's already something a `DEV_MODE` build on the same host would need to pull.
- `--network none`: the check only touches the three mounted files; no reason to allow the container network egress.
- `--rm`: no leftover container.
- Drop `signature_bin`/the `.sig.bin` temp file and the `base64 -d` line entirely — the Node script base64-decodes the signature itself.
- Delete the entire `openssl_major`/"SIGNATURE VERIFICATION IS DISABLED" warning branch. There is no more degraded/skip path — verification either runs (always, since it no longer depends on host OpenSSL version) or the install fails closed, matching the existing failure branch's behavior for a genuinely bad signature.
- `docker run` will pull `node:20-bookworm-slim` on first use if not already present (same implicit-pull behavior Docker already exhibits elsewhere); no explicit `docker pull` needed beforehand.

No changes to `resolve_images()`'s caller, `main()` ordering, `APT_PACKAGES`, or any other function — `verify_docker` already guarantees `docker` works before this runs.

## Docs

- `CHANGELOG.md`: add an `[Unreleased]` → `Fixed`/`Security` entry — manifest signature verification no longer silently skips on OpenSSL < 3; it always runs now via a disposable Node container, closing the previous unverified-install fallback.
- `README.md`: check for any explicit "openssl required" prerequisite line and update/remove if the manifest-verification step is called out specifically (a first pass found no such line today, so this may end up being a no-op beyond the changelog).
- No change needed to `.claude/rules/update-agent.md`/`.agents/rules/update-agent.md` — it documents manifest verification in the `update-agent` runtime context (Ed25519, embedded public key), which this plan doesn't touch; only `install.sh`'s one-time install-time check changes.

## Verification

- `bash -n install.sh` — syntax check, per `.claude/rules/verification.md`.
- Manual dry run on a dev machine with Docker installed: temporarily point `MANIFEST_URL` at a real signed manifest (or exercise `fetch_and_verify_manifest` in isolation) and confirm:
  - Valid signature → proceeds, prints `Manifest verified. frontend=... backend=... update-agent=...`.
  - Corrupted/wrong signature → prints the failure message and exits non-zero, temp files cleaned up.
  - Behavior is identical regardless of host OpenSSL version (the whole point) — nothing in the new path shells out to host `openssl` anymore.
- `npm run check` per `.claude/rules/verification.md` (unaffected by this shell-only change, but part of the required pre-finish checklist).
- `git status --short --untracked-files=all` before any commit, per `.claude/rules/verification.md`.
