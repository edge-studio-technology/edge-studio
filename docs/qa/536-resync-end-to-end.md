# #536 Pi resync end-to-end verification

Date: 2026-10-09. Branch runtime: `7bdd02e0a843e030c916a271afc0e190897d1629`. Host: Raspberry Pi 5, ARM64. Scope: plan step 5, including actual backend workers, HTTPS APIs and Chromium UI. No application code changed during this verification.

## Deployment and isolation

Built frontend/backend from an archive of this workspace's committed branch on the Pi. Both images carry version `0.42.2-dev+7bdd02e` and revision `7bdd02e`. Recreated only the installed frontend/backend with `--no-deps`, preserving the existing Compose configuration, database, account and private testnet. Updated their installed source build contexts to the same branch. Retained previous image tags `edge-studio-backend:pre-536` / `edge-studio-frontend:pre-536`, a consistent SQLite backup at `/home/devpi5/edge-studio-pre-536.db`, and prior source at `/home/devpi5/edge-studio-pre-536-source.tgz`.

The existing testnet node remained at RestartCount **2**, StartedAt **2026-10-09T11:56:07.391662755Z** throughout the deployment and checks. Its solo peer, wallet, contact identity and Integritas connection were preserved. Actual resync ran on a separate fresh node, with a separate app database/account, frontend at HTTPS port 18080, and an isolated Docker network. This node used exact image `sha256:d478afc75473b842fd336fa2e7de17140565859c3604108749efe7e3d5ef3320`, RPC Core **1.1.2.6**. Disposable mainnet data was used for public-archive lifecycle checks; the existing private testnet was never pointed at the public archive.

A temporary host proxy restricted Docker service discovery/actions to that disposable node. Inspection/start requests reached the real Docker API; service labels in the list response identified the fixture as Minima. An HTTP relay forwarded RPC to the real node and recorded only mutation names and non-secret resync response fields. A TCP archive relay forwarded the public MegaMMR stream, optionally delaying each 16 KiB chunk by 250 ms. These are QA fault fixtures, not production features or simulated resync responses.

## Observed operations

| Scenario | Operation ID | Observed result |
| --- | --- | --- |
| Unreachable archive `127.0.0.1:1` | `fd77652c-fa2f-4fa5-bb3f-d1f7d702b2a2` | RPC HTTP 200 with `status:false`; failed/released after 2.08s. UI retained explicit rejection and native archive error. No process cycle. |
| Fast transfer, real shutdown disconnect | `a755d8d7-1ca9-4f88-8178-66114f0530e4` | POST 202 in 71ms; completion response lost after 22.70s. Natural cycle and usable chain recovered after 37.06s. Result recovered/unconfirmed, retaining the transport warning. |
| Transfer exceeding 30s | `475c3b37-a3f4-42df-aa13-755505244106` | Real completion envelope after 150.45s; natural cycle and readiness produced completed/released after 160.75s. No browser or forced restart. Backend continued across accidental browser/tool interruption. |
| Console start, intentional RPC disconnect, backend restart | `ee7da2dc-e053-4dc5-af52-a1d5f9d96cfd` | Console returned the accepted operation. RPC connection was cut after 1s while node work continued. Backend restart at 12:55:04 UTC resumed observation without replay. Natural cycle/readiness produced recovered/unconfirmed after 156.24s, preserving interruption and restart history. |
| Confirmed completion with auto-restart disabled | `eae8d8ff-cacc-4ff8-ad04-47a60d68b0ce` | Completion envelope after 25.86s. Backend waited for actual exit, then issued exactly one Docker start at 13:00:50 UTC; completed/released after 145.45s. No quit/forced restart. |
| Node stopped before dispatch | `1df57671-172d-40a4-91e7-3e87db8fdc1d` | Accepted DTO followed by preflight failed/released after 88ms; error identified the stopped node. No RPC resync dispatch. |
| Real automatic health-poller caller | `6e8af2c8-340f-47eb-bfd8-4fea8d324129` | Fixture-only auto-resync enabled with a 1s stall threshold. Initiation recorded requested, explicit archive rejection separately recorded failed, and the next poll skipped on cooldown with the same ID. Lifecycle audits recorded trigger auto. |

The slow and intentionally disconnected runs returned the captured Core message `MegaMMR sync fininshed.. please restart` at the node/relay boundary. The disconnected run's backend never received that envelope and correctly did not report confirmed success. Durations above are observations from timestamps, not universal upper bounds.

## Browser, conflicts and access checks

- Starting DTO immediately displayed progress and disabled resync/restart. Duplicate manual resync, restart, backup, authenticated restore and enabled console resync/backup calls returned structured **409**; mutation observations confirmed no conflicting commands reached the node.
- Progress survived navigation, reload and a second tab with the same operation ID. Closing/resetting the browser during the slow run did not stop the backend. Reloading terminal progress did not replay a completion notification.
- A browser-intercepted progress GET **503** retained phase/events/warnings and showed Retry progress. Retry recovered real backend progress without a mutation or fabricated failure.
- Recovery kept elapsed time and prior events visible. Interrupted responses recovered as unconfirmed; explicit rejection remained failed; confirmed envelope plus cycle/readiness completed.
- Real unauthenticated progress GET returned **401**. A temporary non-admin role in the disposable database received **403** for progress/start, while status returned **200** with a compact summary lacking events, error details, host and worker metadata. Restored the fixture's admin role afterward.
- Disposable and installed Minima pages had no page-level horizontal overflow at widths **1280, 768 and 375**. Final browser checks recorded no application page exceptions; expected unauthorized, rejected and injected-unavailable HTTP responses were observed.
- Normal login to the installed app succeeded. Minima showed running/active with a testnet peer, Dashboard and Wallet loaded the real balance, the protected local contact remained initialized, and the manual restart confirmation cancelled without a node mutation.
- An automatic poll against the busy stopped-node-recovery operation started nothing and consumed no cooldown. The real automatic rejection check used process-only environment overrides in the disposable backend; the installed app's automatic-resync configuration was not changed.
- Backend restart after that automatic result restored its initiation timestamp/result without a new dispatch. A real ordinary restart sent one `quit compact:true`, naturally cycled at 13:04:45 UTC, and returned usable RPC/balance; no Docker restart fallback occurred. The automatic result remained visible independently of this restart.
- With real RPC reads temporarily disconnected by the relay, Wallet reached its confirmed unavailable state and disabled actions. Restoring RPC let the mounted page's next status poll remove the warning, re-enable Receive and reload balance/history without navigation or reload. No browser page exception occurred.

## Automated regression verification

`MINIMA_STATUS_URL=http://127.0.0.1:9005/status MINIMA_RPC_PORT=9005 npm run check` passed **3,554 tests**: backend 1,443, frontend 1,865, Update Agent 194, scripts 52. All typechecks/coverage thresholds passed; package dependency audits reported zero vulnerabilities. Line coverage: backend 95.67%, frontend 92.44%, Update Agent 99.77%.

This includes response/recovery deadlines, retained terminal reservations, late/obsolete callbacks, bounded/redacted diagnostics, stopped-node start failures, conflict races, startup/shutdown reconciliation, auto-poller cooldown/results, backup/restore, Docker control, auth smoke, Wallet/Dashboard and local-contact recovery regressions. Existing tests supplied the planned step-5 regression coverage; no extra test-only production hooks were needed.

Backend/frontend production builds, Compose validation and both local/Pi container builds passed. Frontend retains its existing large-chunk build warning. The sandbox initially blocked Supertest listeners; reran with listeners permitted. The local RPC URL at port 9105 also conflicted with an existing address-book test's fixed 9005 expectation; the test-only command override resolved it without editing runtime environment files or application code.

## Limits

Rare failure/deadline variants are covered by the automated boundary tests; live runs do not prove every supported future Core version or archive latency. Backup/restore checks here cover conflict rejection and existing regression suites, not a new wallet-replacement exercise. Wallet payments and real wallet replacement were not performed for this resync task. Broader mutation queues and workflow handling remain #212/#307.

## Cleanup and sign-off

Removed all three disposable containers and their anonymous volumes, the temporary Docker network, relay processes/listeners and temporary app database/account/backup files. Logged out the installed app's QA session; no temporary session was created through internal services. Preserved [non-secret runtime observations](./536-resync-runtime-observations.jsonl): six resync RPC dispatches for six dispatched operations, one backup, one ordinary-restart quit and exactly one stopped-after-completion Docker start. The unavailable-node operation dispatched no RPC. No Docker restart call occurred.

The installed frontend/backend remain healthy on the tested branch. The original node/peer remain running, with the original node process baseline unchanged. Both app databases passed integrity checks during QA. Final read-only comparison against the pre-deployment backup confirmed unchanged admin credential fields and exact contact rows. Retained only the documented rollback images/database/source and branch source/build log. MINIMA-02 and MINIMA-08 are reconciled; plan step 5 is complete. No OpenProject write, commit, push or merge was performed.
