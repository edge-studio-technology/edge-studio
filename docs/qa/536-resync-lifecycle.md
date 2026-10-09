# #536 disposable Minima resync lifecycle

Date: 2026-10-09. Host: Linux AMD64. No existing node, wallet, app database, or Pi data mounted. Nodes had fresh writable container layers, RPC enabled, MDS disabled, loopback-only ports 19365/19366, and Docker `unless-stopped`. No published P2P port. Images were cached, not pulled; tag names below do not establish the currently deployed Pi version.

## Image identity

| Compose use | Image | Digest | RPC Core version |
| --- | --- | --- | --- |
| Source | `minimaglobal/minimacore:latest` | `sha256:c621ef1cd76b0e2dccb1f6d6b5398b27753801b3feb9a255c7e9507717edd45d` | `1.1.2.4` |
| Release generator | `minimaglobal/minima:dev` | `sha256:be9b2a2d75073131975ef718c70653cce82ec1adad6ad6e159f07c6e77743948` | `1.0.49.4` |

Both images are AMD64. The compose image discrepancy predates this ticket; no image configuration changed. The development Pi was then inspected read-only: ARM64 `minimaglobal/minimacore@sha256:d478afc75473b842fd336fa2e7de17140565859c3604108749efe7e3d5ef3320`, Core **1.1.2.6**. A separate disposable container used that exact image, fresh container-layer data and loopback RPC port 19367. The original `edge-studio-minima-1` was not resynced/restarted; RestartCount stayed 0 and StartedAt stayed `2026-10-08T12:16:15.163168064Z`.

## Captured results

The non-secret RPC envelopes are in `backend/tests/fixtures/minima/resync-lifecycle.json`.

1. Unreachable host (`127.0.0.1:1`): both versions returned HTTP 200 with `status: false`, `pending: false`, and top-level `error: "Could not connect to Archive host! @ 127.0.0.1:1"`. Release version elapsed 2.018152 seconds. Transport `ok` is insufficient.
2. Quick public-host resync on Core 1.1.2.4: HTTP 200, elapsed 9.095963 seconds, `status: true`, message `MegaMMR sync fininshed.. please restart`, `coins: 0`. Docker restart count went from 0 to 1 and StartedAt from `08:20:26.501372951Z` to `08:21:10.050184602Z`. No restart command was sent. RPC subsequently returned block 2357067, chain length 4402, block timestamp 08:18:18 UTC. Recovery status was sampled at approximately 08:21:23, not continuously: this is not an exact restart/readiness latency measurement or proof of sustained advancing chain health.
3. Client-aborted resync on the same Core 1.1.2.4 node: curl timed out after 1.001917 seconds with no response bytes. Node logs continued through connection check at 08:21:56, cascade import, and database save/shutdown at 08:22:03. This directly establishes continued work after client abort. A shutdown log is not process-exit or RPC recovery evidence.
4. Slow-host case on Core 1.0.49.4: disposable Python TCP relay forwarded to `megammr.minima.global:9001`, delaying every received 16 KiB chunk by 250 ms. Node host was the relay's isolated Docker address. Request timed out at 30.002461 seconds without response bytes. Node logged connection success/network shutdown at 08:22:06 and cascade deletion at 08:22:07; status connections reset while RPC was unavailable. This exercises a real node under an artificially throttled archive transfer; it is not a production latency estimate.

The supported `help command:megammrsync` response on Core 1.1.2.4 lists only `action:mydetails` and `action:resync`. It does not document a read-only progress/completion action. `mydetails` includes wallet search identities and is not a lifecycle probe. No claim is made about undocumented commands or newer versions.

## Natural recovery after abort

Both AMD64 timeout cases recovered without another command. Core 1.1.2.4 increased RestartCount from 1 to 2, StartedAt `08:24:08.761531184Z`, and RPC server returned at 08:24:23. Its “All saved” log at 08:22:03 preceded process relaunch by roughly 126 seconds. Core 1.0.49.4 completed cascade import at 08:24:20, database save at 08:24:31, and restarted at `08:24:32.479017144Z` (count 0 to 1); RPC server returned at 08:24:41. The throttled operation took roughly 147 seconds to restart. Later status reads showed both nodes at block 2357071, newer than the first recovered block 2357067.

These timings are log-resolution observations rather than upper bounds. In particular, “All saved” must not trigger a force restart on the assumption that the JVM has already exited.

## Deployed ARM64 version

Core 1.1.2.6 returned the same unreachable-host envelope in 2.005478 seconds. Its quick public-host resync returned the same completion envelope in 21.873760 seconds, then naturally restarted (count 0 to 1, StartedAt `08:27:28.811733196Z`). Recovered status showed block 2357077.

The second run used a temporary Python relay bound only to the Pi Docker bridge `172.17.0.1:19368`, with the same 16 KiB/250 ms delay as the AMD64 run. Dispatch began at 08:27:55, connection passed at 08:27:58, and the client timed out at 30.002689 seconds. Status reads reset during resync. No second resync/restart/quit was issued.

Core 1.1.2.6 command help likewise documents only `mydetails` and `resync`, without a read-only lifecycle action.

The ARM64 slow run continued after abort: cascade saved at 08:30:11, coin proofs imported at 08:30:14, databases saved at 08:30:15. Docker restarted naturally at `08:30:16.082055058Z` (count 1 to 2), roughly **141 seconds after dispatch**, and RPC server returned at 08:30:23. Recovered status showed block 2357079, newer than 2357077 before the run.

## Checkpoint decisions

| Boundary | Initial budget | Behavior on expiry |
| --- | --- | --- |
| RPC response | 5 minutes | Record uncertain transport outcome and continue observation. |
| Shutdown/cycle observation | 5 minutes after completion evidence, or after uncertain RPC timeout | Mark unconfirmed if evidence remains insufficient. |
| RPC readiness after a confirmed cycle | 2 minutes | Report unavailable/unconfirmed recovery. |

These initial budgets give margin over the observed 141–147-second transfers, 126-second post-save process-exit delay, and 8–15-second RPC startup. They bound observation; they are not measured universal maxima and never authorize resync replay or force restart. They were selected independently of ADR 0001's ordinary restart policy. Observe Docker concurrently with RPC.

After a lost completion envelope, cycle plus usable RPC proves recovery, not resync success: record unconfirmed with recovered node state. Release reservation only after that cycle/readiness reconciliation or definite rejection. Healthy status without a cycle is insufficient for an uncertain dispatched operation. Otherwise retain ownership. Operator recovery requires host diagnostics and confirmed cessation/completion before starting a stopped container. Do not add an in-app clear/force shortcut solely because the observation budget expired; an override needs a separate evidence/confirmation contract.

## Regression scope

Parser tests use both captured envelopes. RPC tests preserve HTTP success versus RPC rejection, and use the real request deadline with fake timers at `global.fetch` to exercise timeout followed by a healthy status read without another resync command. That status only proves reachability, not rebuild completion.

A service regression asserts that a dispatched resync timeout retains operation ownership. It is marked `it.fails`: the existing service clears ownership, and Vitest confirms the expected assertion failure. Remove that modifier when step 2 fixes ownership. The RPC timeout-to-healthy-read test passes, but does not claim the existing service owns terminal recovery; that integration regression belongs with the worker in steps 2–3.

## Verification and limits

Focused suites: 41 passed and one explicitly expected-failing #536 ownership regression. Full `npm run check` passed package typechecks, coverage thresholds, tests (including that expected failure), scripts, and dependency audits. Backend/frontend builds and Compose validation passed. No application runtime change, browser validation, image configuration change, or deployment was included.

Observed versions returned the same completion message, including the legacy spelling; no other successful variant was observed. Timing budgets require final QA on other supported versions and slower hosts. No disconnected completion response was reconstructed from healthy status alone. Worker terminal integration tests remain for steps 2–3.

## Cleanup

Removed all three local ticket-labelled disposable containers and the separate Pi container, including their anonymous volumes. Stopped the verified temporary Pi relay process and removed its temporary files. Original Pi frontend/backend remained healthy; Minima remained running with RestartCount 0 and its original StartedAt. No test node, relay listener, or data mount was left on the Pi.
