# Security Hardening Phases 1-5 QA Sign-Off

Use this runbook to decide whether the implementation in
[Security Hardening V1.5](../plans/security/README.md) Phases 1-5 is safe to promote to the next
release channel. Run it again against the artifacts published by each channel; a pass on a source
branch does not prove that the release workflow published the same result.

This is a **Phase 1-5 promotion gate**, not final V1.5 security sign-off. Promotion to `main` also
requires the parent plan's pre-merge decision pass, Phases 6-8 done or explicitly accepted, and its
plan-wide Pi/TLS checks. Phase 9 remains outside the security sign-off bar.

## Sign-Off Rule

Choose exactly one result:

| Result | Meaning |
| --- | --- |
| **Pass** | Every mandatory check passed on the recorded commit and artifact set. Promote to the next channel. |
| **Conditional pass** | Only a documented accepted residual remains, with an owner, expiry/exit criteria, and reviewer approval. Do not use this result for `main`. |
| **Fail** | A mandatory check failed, evidence is missing, or actual behavior differs from the expected result. Do not promote. |

Do not average results. One stop-ship failure makes the candidate a fail. After a fix, rerun the
failed phase, the automated gate, and every later phase whose implementation depends on it.

## Promotion Sequence

1. Pass the source/build baseline on the candidate commit.
2. Publish that exact commit to an isolated staging/QA channel. This is artifact creation for QA,
   not approval for a wider channel.
3. Run the clean deployment and Phases 1-5 against the staging artifacts on the dedicated Pi.
4. If every gate passes, sign off promotion to the next named channel.
5. After each promotion, rerun the channel artifact/install check and clean smoke test. Before
   `main`, complete the parent plan's remaining sign-off requirements as well.

## Required Environments

Use all three:

1. A clean development checkout for static checks, builds, and automated tests.
2. A disposable, clean-`DATA_DIR` Docker Compose deployment for browser/API abuse cases. Do not run
   destructive Minima, credential, upload, or installer tests on a production Pi.
3. A dedicated Raspberry Pi using a staging manifest and staging release channel for the Phase 4
   install/update test and Phase 5 resource observations.

Use a controlled HTTP endpoint on a second LAN host for redirect, delay, gzip, large-response, and
concurrency cases. The Phase 2 policy deliberately blocks loopback, the Compose network, the
Compose gateway, and `host.docker.internal`, so hosting this endpoint inside the tested Compose
deployment would test the blocklist rather than the intended egress behavior.

## Evidence Header

Copy this into the QA ticket or PR before testing:

```text
Candidate branch:
Candidate commit (`git rev-parse HEAD`):
Base `dev` commit (`git merge-base dev HEAD`):
Release channel / manifest URL:
Published manifest version and createdAt:
Pi model / RAM / OS / architecture:
Browser and version:
Tester:
Started (UTC):
Finished (UTC):
Result: PASS | CONDITIONAL PASS | FAIL
Accepted residual approvals, if any:
Linked defects:
```

Attach command output, relevant sanitized response bodies, screenshots, container status, and
resource measurements. Never paste real passwords, tokens, private keys, session cookies, seed
phrases, or unredacted `.env` files into evidence.

## Gate 1 — Candidate And Automated Baseline

Run from a clean checkout of the exact candidate commit:

```bash
git status --short --branch --untracked-files=all
git rev-parse HEAD
git merge-base dev HEAD
git diff --check dev...HEAD
npm ci
npm run check
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix update-agent run build
bash -n install.sh
bash -n bin/edge-studio
docker compose config
docker compose build
git status --short --untracked-files=all
```

Pass when:

- the initial and final status contain no unexplained tracked or untracked files;
- `npm run check` exits zero, including type checks, threshold-enforced coverage, script tests, and
  dependency audits;
- all three packages build;
- both shell scripts parse;
- Compose renders and every image builds for the target architecture; and
- there are no skipped, focused, or todo tests in the changed test surface.

An audit failure is not silently waived. A conditional pass requires a security-owner decision in
the risk register with the exact advisory, affected dependency path, exposure assessment, owner,
and exit criteria. The parent plan requires `npm run check` to pass for final sign-off.

Useful focused reruns after a failure:

```bash
# Phase 1
npm --prefix backend run test -- tests/features/minima/minima-backup.service.test.ts tests/features/minima/minima.routes.test.ts tests/shared/redact.test.ts tests/shared/api-error.test.ts tests/shared/structured-error.test.ts

# Phase 2
npm --prefix backend run test -- tests/shared/url-policy.test.ts tests/shared/http.test.ts tests/features/data-sources/dataSources.service.test.ts tests/features/minima/minima-console.catalog.test.ts tests/features/minima/minima-console.service.test.ts tests/app.401-smoke.test.ts

# Phase 3
npm --prefix backend run test -- tests/features/auth/auth.service.test.ts tests/features/auth/auth.routes.test.ts tests/features/auth/session.service.test.ts
npm --prefix frontend run test -- tests/features/auth/ChangeCredentialPanel.test.tsx

# Phase 4
./node_modules/.bin/vitest run --config vitest.scripts.config.mts scripts/tests/install-bootstrap-trust-set.test.ts

# Phase 5
npm --prefix backend run test -- tests/config/env.test.ts tests/shared/http.test.ts tests/shared/egress-limiter.test.ts tests/features/data-sources/mqttIngestion.service.test.ts tests/features/integritas/integritas.routes.test.ts
```

## Gate 2 — Clean Deployment Smoke Test

Deploy with fresh application and Minima data directories. Complete onboarding with QA-only
credentials, then verify:

- `docker compose ps` shows all expected services healthy/running;
- `https://<pi-ip>:8080/api/health` returns `200` JSON;
- onboarding, login, logout, and login again work;
- Minima status, Integritas status, Devices, Automation, and Account pages load without new console
  errors;
- a normal Minima read, normal device read, and normal small file upload still work; and
- `docker compose logs backend frontend update-agent` has no uncaught exception, restart loop, or
  credential material.

Record this smoke result before the abuse cases. It is the control showing that a later failure is
caused by the tested boundary rather than an already-broken deployment.

## Gate 3 — Phase Acceptance Tests

Record every test ID, not just the phase total:

| Test ID | Result (`PASS` / `FAIL` / `BLOCKED`) | Sanitized evidence link | Defect / notes |
| --- | --- | --- | --- |
| P1-01 |  |  |  |

Add one row for every ID below. `BLOCKED` is not a pass; name the missing environment, artifact, or
authority and do not promote until it is resolved.

### Phase 1 — Backup Password And Error Redaction

Use a unique QA-only backup password containing punctuation, for example a value shaped like
`qa-P1:<random-marker>`. Record the marker separately and destroy the test data after QA.

| ID | Procedure | Expected result |
| --- | --- | --- |
| P1-01 | In Account > Minima backups, save the QA backup password and create a manual backup. Inspect the `POST /api/minima/backups` response in browser DevTools. | Backup succeeds. The serialized response contains the file metadata but neither the plaintext marker nor its percent-encoded form, and has no raw `command` or credential-bearing `source`. |
| P1-02 | Enable the console's `backup` write entry using re-authentication, run `backup`, and inspect `POST /api/minima/console/run`. | Backup succeeds and the serialized console response contains neither form of the password. |
| P1-03 | On the disposable deployment only, stop Minima, repeat both backup paths, then start Minima again. | Both paths fail safely. Error bodies contain neither form of the password, raw RPC command, credential-bearing URL, native cause chain, nor sensitive path. Minima recovers after restart. |
| P1-04 | Search backend logs produced by P1-01 through P1-03 for the unique marker and its encoded form. | Zero matches. Logs retain enough non-secret context to diagnose the failed dependency. |
| P1-05 | Trigger a stored device/MQTT connection error using a QA URL containing throwaway user-info. Inspect the UI/API error and the persisted read/error view. | User-info is redacted on write and on read; an old stored error cannot re-expose it. |
| P1-06 | List and download the created backup using re-authentication. | Existing backup behavior still works; `GET /api/minima/backups/password` returns only `hasPassword`. |

Stop ship if any secret or encoded secret appears in a response, Docker log, persisted error, audit
detail, command, source URL, or cause chain. Do not attach the leaking value to a shared ticket;
reproduce with another disposable marker and sanitize the evidence.

### Phase 2 — Minima RPC Bypass, URL Policy, Admin Gates, Console Catalog

The deterministic DNS multi-answer, IPv4-mapped IPv6, address-pinning, redirect-hop, and stale-row
cases are mandatory automated evidence from Gate 1. Manual DNS rebinding is not a reliable browser
test.

| ID | Procedure | Expected result |
| --- | --- | --- |
| P2-01 | Save and read a JSON API input on the controlled LAN endpoint over `http` or `https`. Add a health URL, an HTTP output, and a multipart media output pointing at the same controlled endpoint. | Save and all four egress paths work, proving ordinary LAN/public egress was not accidentally disabled. |
| P2-02 | Try saving each path with `http://minima:9005/vault`, `http://backend:3000`, the configured Compose gateway/helper ports, `127.0.0.1`, `[::1]`, an IPv4-mapped loopback address, `host.docker.internal`, `file://`, and `gopher://`. | Every save is rejected with a safe validation error and no request reaches the destination. |
| P2-03 | Have the controlled endpoint return a redirect whose `Location` is `http://minima:9005/status`; exercise all applicable egress paths. | The redirect is not followed to Minima. The operation fails with a safe destination-policy error. |
| P2-04 | Confirm the focused URL/HTTP tests cover a hostname whose second answer is protected and a resolver that changes after validation. | Any protected answer rejects the request; the connection uses the already-validated address and does not perform an attacker-controlled second resolution. |
| P2-05 | With the default console whitelist, run `status`, `tokens`, `tokens action:import`, `tokens action:somethingnew`, `maxcontacts action:add`, `cointrack`, `quit`, and an unknown verb. | Read commands work. Mutating/unknown action forms select disabled write entries. `cointrack` is write-only. Permanently excluded and unknown verbs never reach Minima. |
| P2-06 | Review the `app.401-smoke` result and route assertions for data-source health, Minima config/resync, and Integritas stamp/history mutation routes. | No unauthenticated request passes; the changed routes require admin. Session-only history read/export behavior remains unchanged. |

The accepted residual from ADR 0014 is that other LAN hosts remain reachable. Treating that known
policy as a test failure would be incorrect; reaching Edge Studio's protected destinations is a
stop-ship failure. MQTT broker allowlists and per-target rate limits are still outside Phase 2 as
DEVICE-IO-06b.

### Phase 3 — Session Lifecycle

Use two different browser profiles, A and B, logged in as the same QA admin.

| ID | Procedure | Expected result |
| --- | --- | --- |
| P3-01 | In A, attempt a password change with the wrong current credential. | The request is rejected, no clear-cookie header is sent, and both A and B remain logged in. |
| P3-02 | In A, change to a valid QA password. Inspect the response and `Set-Cookie`, then navigate in both profiles. | Response says `sessionsRevoked: true`; A receives an expired/empty session cookie and returns to login; B is rejected on its next authenticated request and returns to login. |
| P3-03 | Attempt login with the old and new passwords. | Old password fails; new password succeeds. Restore the original QA password afterward and confirm that restoration revokes the new session too. |
| P3-04 | Review the audit history/database through an approved diagnostic path. | `settings.password_changed` exists without storing either password. No extra, misleading revocation audit event is required. |
| P3-05 | Review the scheduler test result and restart the backend once on the disposable deployment. | Expired-session cleanup runs immediately at startup and hourly in the automated fake-timer test; backend restart is clean. |

TOTP is dormant and its product future is outside this branch. Do not enable it in a release build
just to exercise P3. Its reset-revocation path is covered by the automated service and route tests.
An idle-expired session that has not reached absolute expiry is still removed on next validation;
that documented residual is not a Phase 3 regression.

### Phase 4 — Install-Time Trust Chain

This phase cannot pass on source tests alone. Run the full installer as root on a dedicated Pi
against staging artifacts. The installer changes `/opt/edge-studio`, host packages, services, and
containers; do not point it at an in-use device.

Before testing the installer, publish one complete release through the updated workflow to the
staging channel. Confirm that the channel contains one coherent set of:

- `manifest.json` and `manifest.json.sig`;
- `edge-studio-runtime.tar.gz` and `edge-studio-runtime.tar.gz.sig`; and
- `install.sh.sha256` matching the tag-pinned candidate installer.

| ID | Procedure | Expected result |
| --- | --- | --- |
| P4-01 | Download the tag-pinned installer, verify it against the checksum from the separate manifest repository, inspect it, and run it with the staging `MANIFEST_URL`. | The runtime bundle signature is verified before extraction; manifest verification passes; containers start; health and login pass. |
| P4-02 | Rerun the same installer as an update after creating recognizable QA application/Minima data. | Existing `.env`, SQLite data, Minima data, and update-agent state survive; the candidate version is recorded and services return healthy. |
| P4-03 | Publish or serve an otherwise valid bundle with its detached signature missing. | Installer exits non-zero before extraction and does not start an unverified candidate. |
| P4-04 | Modify one byte of a signed bundle without replacing its signature. | Installer reports signature verification failure, exits non-zero before extraction, and leaves no partial candidate installation. |
| P4-05 | Exercise archive validation with purpose-built absolute-path, `..`, symlink, hardlink, non-regular, and valid archives. Review the committed bootstrap test evidence for embedded-key equality, bundle contents, and the verifier image reference. | Every unsafe archive is rejected and the valid archive is accepted; embedded key matches update-agent; verifier/key are absent from the bundle; verifier image uses a digest and pulls on the Pi architecture. |
| P4-06 | Repeat P4-01 against the actual artifact set after promotion to each channel. | The channel's installer, manifest, signatures, bundle, and images work together; no channel still serves a pre-Phase-4 unsigned bundle. |

Channel sequencing is a hard gate: a hardened installer intentionally refuses an older unsigned
bundle. Do not promote the installer to a channel before that channel has a bundle/signature pair
from the updated workflow. The documented `curl | sudo bash` path remains an accepted residual,
not a closed finding; the preferred QA path is download, checksum, inspect, then run.

### Phase 5 — Resource Limits

First test defaults. Then, on the disposable environment only, lower limits to make boundaries
quick to exercise, for example 64 KiB egress, 1 MiB upload, 1 KiB MQTT, one active egress request,
one queued request, and a 1 second deadline. Recreate the backend after editing `.env` and record
the effective Compose configuration. Restore defaults before the Pi observation run.

| ID | Procedure | Expected result |
| --- | --- | --- |
| P5-01 | Return valid JSON just below and just above the egress cap, once with `Content-Length` and once chunked. | Below-cap reads succeed. Above-cap reads fail with an explicit size error without buffering the full response; backend stays healthy. |
| P5-02 | Return a small gzip response that expands below the cap, then one that expands above it. | Limit applies to decoded bytes: the first succeeds and the second aborts mid-stream with a size error. |
| P5-03 | Delay the controlled endpoint beyond the configured deadline. | Request fails near the deadline, including time spent waiting for an egress slot; no request remains stuck. |
| P5-04 | Hold one request open, queue a second, then start a third with concurrency/queue set to 1/1. | First runs, second queues within the same deadline, third fails fast as queue-full. Slots are released after success, failure, and abort. |
| P5-05 | Upload files immediately below and above the configured limit to Integritas stamp, proof verification, and Minima restore paths. Also send too many files/fields. | Allowed requests retain normal behavior. Oversize returns JSON `413`; file/field-count failures return JSON `400`, never an HTML `500`. |
| P5-06 | Count files in `/tmp/edge-studio-uploads` and `/tmp/edge-studio-minima-uploads` before and after rejected uploads and the missing-Integritas-key paths. | Counts return to baseline; no temporary upload is orphaned. |
| P5-07 | With an enabled QA MQTT workflow, publish valid JSON below and above the MQTT cap. | Below-cap event runs normally. Above-cap event does not run the workflow and creates a failed read with `invalid_payload` and byte-limit context. Backend stays healthy. |
| P5-08 | Set each limit below its floor, above its hard maximum, and to a non-number; rerun the env tests. | Values clamp to their documented floor/maximum or fall back to defaults. Upload byte size has a 1 MiB floor and intentionally no product maximum. |
| P5-09 | On the Pi with default limits, run representative reads/uploads plus a short concurrent egress burst while recording `docker stats`, latency, errors, and recovery. | No OOM/restart, runaway memory, unbounded queueing, or persistent degradation. Record measurements under DEVICE-IO-09; do not describe unmeasured defaults as Pi-validated. |

The cap does not apply to deployment-config HTTP calls such as large Minima RPC responses. Verify a
normal Minima coin/balance/status workload after the limit tests so the hardening has not imposed a
data-source-sized cap on the internal RPC client.

## Gate 4 — Cross-Phase Regression Pass

After all phase tests, restore default configuration and rerun:

- clean deployment smoke tests from Gate 2;
- one successful backup and restore;
- one allowed external JSON read and HTTP output;
- one password change followed by fresh login;
- one installer update using the final staging artifact set; and
- `npm run check`, package builds, `docker compose config`, and `docker compose build` at the exact
  commit being signed off.

Review the final diff against `dev` and confirm each production change maps to Phases 1-5, its ADR,
risk-register entry, tests, and operator documentation. Unrelated behavior changes or undocumented
security defaults block promotion until separated or reviewed.

## Stop-Ship Conditions

Do not promote if any of these occur:

- a backup password, credential-bearing URL, token, header, sensitive path, or cause chain appears
  in a client response, log, persisted error, or audit record;
- any protected URL reaches an Edge Studio internal service, including through DNS or redirect;
- a mutating Minima command runs through a read-enabled catalog entry, or an admin gate is bypassed;
- any session remains usable after a successful credential change;
- an unsigned, tampered, missing-signature, or unsafe runtime bundle is extracted or started;
- a release channel lacks a coherent signed bundle/manifest set before receiving the installer;
- a response, upload, MQTT message, concurrency burst, or timeout bypasses its configured bound;
- rejected uploads leave files behind, or return an HTML/500 response instead of the API contract;
- the backend becomes unhealthy, restarts, OOMs, or fails to recover after a boundary test;
- a mandatory command fails, expected evidence is absent, or a residual risk has no explicit owner
  and exit criteria.

## Final Sign-Off Record

```text
Automated baseline: PASS | FAIL
Clean deployment smoke: PASS | FAIL
Phase 1: PASS | FAIL — evidence link:
Phase 2: PASS | FAIL — evidence link:
Phase 3: PASS | FAIL — evidence link:
Phase 4: PASS | FAIL — evidence link:
Phase 5: PASS | FAIL — evidence link:
Cross-phase regression: PASS | FAIL
Open accepted residuals and approvals:
Stop-ship defects:
Promotion decision: PASS | CONDITIONAL PASS | FAIL
Approved target channel:
QA signer / date:
Security reviewer / date:
Release owner / date:
```

For promotion to `main`, append the completed parent-plan sign-off checklist. A Phase 1-5 pass by
itself is not authorization to merge the unfinished V1.5 security work to `main`.
