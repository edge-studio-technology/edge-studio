# Legacy QA Ticket Unit-Test Gap Follow-Up Plan

**Status:** Not started
**Created:** 2026-09-09
**Goal:** While retiring old PM-tool QA tickets (automation/devices/etc., written before the naming and architecture settled), catalog the specific unit-test gaps found against today's suite, so a single new ticket/branch can close them.

## Context

Old backlog tickets predate the current naming (rule → workflow, connector → device) and predate the
backend/frontend unit-test coverage push (`docs/plans/archive/backend-unit-tests.md`,
`archive/frontend-unit-tests.md`). Some of those old tickets have "Integration" in their title, but that word
just reflected uncertainty at the time about what kind of test we'd end up writing — this project's test
scope is unit tests only (`.claude/rules/testing.md`), so below, findings are described purely as unit-test
gaps regardless of a ticket's original title/naming. Don't read "Integration" in a ticket title as calling for
a separate integration/E2E suite; there is none here.

This doc is **not** a rewrite of those tickets. It only tracks the handful of genuine gaps found per ticket —
places where the described behavior has no test at any level — so the old tickets can be deprecated in favor
of one new ticket that adds the missing unit tests. Tickets with no gaps are simply not listed below.

## Gaps found

### Devices ticket (data sources)

Two gaps; everything else in that ticket (Add Connector modal per type, test action success/failure, health
status, empty state) already has a matching unit test.

1. **Delete source does not verify that `sync*DataSources()` tears down the now-orphaned watcher/client.**
   `DELETE /api/data-sources/:id` (`backend/src/features/data-sources/dataSources.routes.ts:77-84`) deletes
   the row then calls `syncMqttDataSources()` / `syncGpioDataSources()`. GPIO already has an adjacent test —
   `gpioIngestion.service.test.ts:230` "skips processing when the source has been deleted" — but that only
   asserts an in-flight GPIO edge event is ignored after deletion; it never calls `syncGpioDataSources()`
   again afterward, so it doesn't prove the spawned `gpiomon` child process actually gets killed. MQTT has no
   equivalent test at all (`grep -n "deleted" mqttIngestion.service.test.ts` — no matches). Both sync
   functions' own disabled-workflow cases (`mqttIngestion.service.test.ts` "ends the client when its workflow
   is disabled"; `gpioIngestion.service.test.ts` "kills the watcher when its workflow is disabled") prove the
   teardown mechanism works for that trigger, just never for a deleted source.
   - Add: a case per sync service — seed an active watcher/client for a source, delete the source row, call
     `syncMqttDataSources()`/`syncGpioDataSources()` again, assert the watcher/client is torn down (killed
     child process / ended MQTT client), not just that a subsequent event is ignored.
   - Files: `backend/tests/features/data-sources/mqttIngestion.service.test.ts`,
     `backend/tests/features/data-sources/gpioIngestion.service.test.ts`.

2. **Webhook receiver route has no happy-path test.** `backend/tests/app.401-smoke.test.ts:118` only pins
   that the route is public; `automation.service.test.ts:435` tests `recordPushAutomationPayload` directly.
   No test drives `POST /api/data-source-webhooks/:token` itself with a valid token and an enabled workflow
   to assert the route wires `findWebhookDataSource` → `processWebhookPayload` → `recordPushAutomationPayload`
   → JSON response correctly, or that an unknown token gives 404 and a disabled/missing workflow gives 409
   (`dataSources.routes.ts:20-37`).
   - Add: a route-level unit test hitting `dataSourcesWebhookRouter` directly with `supertest` (same pattern
     as `app.401-smoke.test.ts`), DB/repo state seeded through the normal test DB harness — no real server or
     network involved. Cases: valid token + enabled workflow (200, response shape), unknown token (404),
     valid token with no enabled workflow (409).
   - File: new `backend/tests/features/data-sources/dataSources.routes.test.ts` (no existing route test file
     for this feature besides the shared 401-smoke test).

### Diagnostics ticket (log search/tabs)

The 3 tabs are Integritas/Devices/Workflow Logs (`proofs`/`reads`/`workflow-runs` in
`frontend/src/pages/DiagnosticsPage.tsx`), each rendering `IntegritasHistoryTable`/
`DataReadsHistoryTable`/`AutomationRunsTable`. Search (`q`) and status filtering are server-side, backed by
`integritas.repository.test.ts` ("filters by q across id/hash/proof_uid/file_name"),
`dataReads.repository.test.ts` ("filters by q across source_name/source_url/hash/id/proof id"), and
`automationRuns.repository.test.ts` ("filters by q across workflow_name/trigger_type/trigger_source_id/error").
Empty states, row timestamp/status-pill rendering, and pagination footer are each covered in the three
table test files and `ListPaginationFooter.test.tsx`. One real gap, one open scoping question:

1. **`diagnosticsQuery.ts` has zero tests.** It's pure logic — tab parsing/fallback
   (`parseDiagnosticsTab`/`isValidDiagnosticsTab`), query parsing with page/pageSize clamping and a
   per-tab status allowlist (`parseDiagnosticsListQuery`), and URL round-tripping
   (`diagnosticsSearchParams`) — the same shape as `workflowHelpers.ts`, which has its own
   `workflowHelpers.test.ts`. No test file exists for it (`find frontend/tests -iname 'diagnosticsQuery*'`
   returns nothing), even though it lives right next to `DiagnosticsPage.tsx` and drives every checklist item
   in this ticket (tab selection, search-param sync, status/q clamping).
   - Add: `frontend/tests/pages/diagnosticsQuery.test.ts` covering invalid/missing tab fallback to `proofs`,
     out-of-range page/pageSize clamping, status values rejected outside the active tab's allowlist, `q`
     trimming/200-char truncation, and `diagnosticsSearchParams` round-tripping a query back to the same
     values.

2. **Open question, not a gap I'm assuming my way into:** the "log service unavailable" checklist item (the
   `error`/`ErrorAlert` state in `DiagnosticsPage.tsx` when a fetch throws) and the tab-switching/pagination
   wiring live in `DiagnosticsPage.tsx` itself, which has no test file — but that matches every other file
   under `frontend/src/pages/**`: none of them has a dedicated test, and `frontend/vite.config.ts`'s
   `coverage.exclude` deliberately excludes `src/pages/**` wholesale. Adding a test here would be the first
   page-level component test in the repo, not a same-pattern fill-in like item 1. Flagging for your call
   rather than adding it as a gap unilaterally.

### Integritas ticket (API failure/timeout/proof handling)

Rate-limit handling and proof-generation-failure status are already fully covered: backend classifies
`429`/`502`/`503` as transient and retries (`integritas.service.test.ts` — `pollProofStatus` "retries a
transient 503", "gives up after exhausting all attempts", "treats an AbortError as transient and retries";
`requestProofUid` shares the same retry helper), `applyPollResultToRecord` marks records failed without
throwing ("marks the record failed when the matching status item reports an error" / "...status is explicitly
false"), and the frontend error-toast mapping has its own dedicated test file
(`frontend/tests/features/integritas/integritasErrors.test.ts`, covering `rate_limited`/`unauthorized`/
`upstream_unavailable`/unknown codes).

One real gap, and three checklist items that don't match anything the app actually does (not gaps — the
ticket describes behavior that isn't part of the built feature):

1. **`status.routes.ts` (the connection-card data source) has zero test file.** The "Integritas API" card on
   the dashboard (`frontend/src/features/dashboard/DashboardDevices.tsx`) gets its `integritasConnected`
   value from `getIntegritasConnectionCheck()` in `backend/src/features/status/status.routes.ts` — this is
   what actually turns an invalid/rejected API key into whatever the card displays, and it has no test at all
   (`find backend/tests/features/status -type f` only shows `device.service`/`docker.control`/
   `docker.service` tests, nothing for `status.routes.ts`). The frontend side is covered
   (`DashboardDevices.test.tsx` — "shows integritas as unreachable when integritasConnected is false" /
   "...not configured when integritasConnected is null"), but nothing proves a 401/403 from Integritas
   actually produces that `false`. **This is already tracked as open item DS-05 in `docs/qa/gaps.md`**
   ("Route tests — `status.routes.ts` authenticated 200, unauthenticated 401") — not duplicating it here as a
   new item, just cross-referencing so it isn't missed when this ticket is retired.

2. **"Unsupported file type — validation error" doesn't exist as a feature.** `upload.middleware.ts` is bare
   `multer({ dest: uploadDir })` — no `fileFilter`, no size limit, no mimetype check. Stamping hashes
   arbitrary bytes by design (matches the "no arbitrary app-level file/data limits" project rule), so there's
   no unsupported-file-type path to test.

3. **"Shows retry option" isn't a UI feature.** Stamp failures surface through `integritasErrorToast` (tested)
   rendered as a toast in `IntegritasPage.tsx`; there's no retry button/action anywhere in
   `frontend/src/features/integritas/` (`grep -rln "retry\|Retry" frontend/src/features/integritas` only
   matches the rate-limit toast copy, not an actual control) — retrying means the user clicks Stamp again.

4. **"Attestation list when API unavailable — shows cached/empty state" is just normal list behavior, not a
   special state.** The Integritas history list (`listProofRecords`) always reads from local SQLite, never
   live from the Integritas API — Integritas reachability only affects whether *pending* records get new poll
   updates, not whether the list renders. There's no separate "API unavailable" list state to build or test.

### Wallet Security ticket

Two checklist items already have solid coverage: the non-admin gate on `POST /api/wallet/send-payment`
(`app.401-smoke.test.ts:78,126-133`) and the no-auth-token pen test (`/api/wallet` sits in the protected-prefix
matrix, `app.401-smoke.test.ts:49-50`). Two real gaps, plus four checklist items that describe behavior the
app doesn't implement — not gaps, since there's nothing to test.

1. **Backup download/restore reauth isn't route-level tested for rejection.** `verifyCurrentPassword` is
   unit-tested directly in `minima-backup.service.test.ts:125-151` (wrong password -> 401, correct ->
   resolves), and `POST /api/minima/backups/:fileName/download` / `POST /api/minima/backups/restore` both call
   it before touching the file (`minima.routes.ts:240-253`, `:255-282`). But `minima.routes.test.ts:98-152`
   only exercises the leak-prevention path (raw RPC command never returned) — no case sends a wrong
   `currentPassword` to either route and asserts the request is rejected before the file is read/returned.
   - Add: a case per route in `minima.routes.test.ts` — valid session, wrong `currentPassword`, assert
     rejection and that no file is read/returned.
   - File: `backend/tests/features/minima/minima.routes.test.ts`.

2. **Wallet import route has no test asserting the phrase is absent from the response.** `POST
   /api/wallet/import` (`wallet.routes.ts:85-100`) never logs the phrase (redaction pinned by
   `redact.test.ts:66-68`), and `ImportWalletResult` has no phrase field by construction, but no test drives
   the route and inspects the JSON response body for the submitted phrase string.
   - Add: a route-level case — POST a valid phrase, assert the response body doesn't contain the phrase
     substring (same style as `minima.routes.test.ts:51-55`'s leak-check assertions).
   - File: `backend/tests/features/wallet/wallet.routes.test.ts` (doesn't exist yet — only
     `wallet.service.test.ts`/`wallet.parse.test.ts` do).

3. **"Wallet creation with passphrase, encrypted at rest" isn't a feature.** There's no create-wallet
   endpoint; wallet key material is owned by the Minima node, not the backend (`wallet.service.ts` only has
   `import`/`send`/`receive-address`/`balance`/`history`). Nothing to test.

4. **"Send payment: wrong passphrase / cancellation / double-send prevention" isn't implemented.**
   `sendPayment` (`wallet.service.ts:30-36`) is a bare RPC call with amount/address validation only (tested,
   `wallet.service.test.ts:63-89`) — no per-send passphrase step, no cancellation flow, and no
   idempotency/double-send guard exists to test.

5. **"Generate address: unique per call" contradicts the actual design.** `getReceiveAddress`
   (`wallet.service.ts:20-22`) explicitly returns one of 64 pre-created addresses at random and is documented
   as NOT creating new key material — the opposite of "unique per call." The existing test
   (`wallet.service.test.ts:43-61`) covers parsing/QR generation, not format validation. Flag to whoever owns
   this ticket rather than writing a test against a false assumption.

6. **"Operator role cannot send payment" has no real Operator role to test against.** `UserRole` has one
   member (`admin`) — the 403 coverage noted above is driven by a stubbed non-admin session
   (`app.401-smoke.test.ts:6-8`), not a real role. Fine as regression coverage for the gate itself, but there's
   no second role to build a genuine operator-permission test around until one exists.

### Node Failure Mode Testing ticket

Backend restart-failure handling is solid already: `minima.service.test.ts:115-126` covers the RPC-fails-but-
container-stopped case, and `:328-341` covers clearing the operation marker when a background restart fails.
Everything else has at least one real frontend gap, plus two checklist items that don't match anything built.

1. **No frontend test feeds a stopped/exited/error container state into the Minima Core UI.**
   `MinimaContainerCard.tsx` and `DashboardDevices.tsx`'s `deviceNodeStatus()`
   (`frontend/src/features/dashboard/DashboardDevices.tsx:24-29`) both branch on `stopped`/`error`, but
   `MinimaContainerCard.test.tsx` only exercises `null` and `running` containers, and `DashboardDevices.test.tsx`
   only covers `restarting` (around lines 141-150) for the node card — never `stopped` or `error`.
   - Add: cases in `MinimaContainerCard.test.tsx` for `state: "stopped"`/`"exited"`/`"error"`, asserting card
     copy/styling; a case in `DashboardDevices.test.tsx` for `node.state: "stopped"`/`"error"` asserting the
     mapped status pill.
   - Files: `frontend/tests/features/minima/MinimaContainerCard.test.tsx`,
     `frontend/tests/features/dashboard/DashboardDevices.test.tsx`.

2. **Restart button disabled→re-enable cycle has no test, and its real owner (`MinimaPage.tsx`) has no test
   file at all.** The button's `disabled={busy}` prop is only tested by manually re-rendering with `busy`
   forced true/false (`MinimaContainerCard.test.tsx:74-86`) — no test clicks restart, asserts immediate
   disable, then simulates the status poll resolving and asserts re-enable. The state itself lives in
   `MinimaPage.tsx:42` (`useState`), which has zero test coverage.
   - Add: click restart, assert button disabled immediately, resolve the mocked status poll, assert
     re-enabled.
   - File: new `frontend/tests/pages/MinimaPage.test.tsx` (doesn't exist).

3. **Restart failure has no route-level backend test and no frontend toast test.** `POST /api/minima/restart`'s
   failure path (`minima.routes.ts:102-114`) has zero test references in `minima.routes.test.ts` (only the
   service-level failure is tested, not the route). On the frontend, `MinimaPage.tsx:90-95` catches and toasts
   when `restartMinimaContainer()` throws, but again `MinimaPage.tsx` has no test file to exercise it.
   - Add: a route-level case in `minima.routes.test.ts` for restart failure (mock the service to reject,
     assert the error response shape); a case in the new `MinimaPage.test.tsx` asserting the toast fires on a
     rejected restart call.
   - Files: `backend/tests/features/minima/minima.routes.test.ts`, `frontend/tests/pages/MinimaPage.test.tsx`.

4. **Dashboard metrics under "stopped"/"error" node state are untested.** `DashboardDevices.test.tsx` covers
   `restarting` (wallet marked unavailable, wallet fetch skipped) and Integritas unreachable, but never Minima
   `node.state: "stopped"` or `"error"` — the actual "node offline" cases this checklist item is asking about.
   - Add: cases for `node.state: "stopped"`/`"error"`, asserting wallet/metrics sections degrade the same way
     as `restarting`.
   - File: `frontend/tests/features/dashboard/DashboardDevices.test.tsx`.

5. **"Degraded" isn't a real state — checklist item doesn't map cleanly onto what exists.** There's no
   `degraded` value anywhere in the codebase. What exists instead: a binary `rpc.ok`/`rpc.error` (well
   covered — `minimaStatusDisplay.test.ts`, `MinimaHealthCard.test.tsx:101-121`) and a separate
   `monitoring.stallDetected` flag for a stalled-but-still-connected node. No test combines "unreachable" +
   "stalled" the way "degraded" implies, because the UI doesn't model them as one combined state. Flag to
   whoever wrote the checklist rather than writing a test against a state that doesn't exist.

6. **"Diagnostics screen when node logs unavailable" isn't a feature.** `DiagnosticsPage.tsx`'s three tabs are
   Integritas/Data Reads/Workflow Runs (`TAB_DESCRIPTION`, lines 52-56) — there's no "node logs" tab or
   concept, and (as already noted in the Diagnostics ticket section above) `DiagnosticsPage.tsx` has no test
   file at all, matching every other page-level component.

Checklist item 7 ("Unit and integration tests") is satisfied by convention, not a gap: this project is
unit-tests-only (`.claude/rules/testing.md`), no separate integration suite exists or is expected.

<!-- Add "### <short ticket topic>" sections here only when a legacy ticket turns up a real gap. -->

## Docs

- Once the follow-up branch closes these, update `CHANGELOG.md` only if it changes user-facing behavior (it
  shouldn't — this is test-only). No `README.md`/`SECURITY.md` changes expected.
- Reconcile `docs/TASKS.md`: remove this plan's `## Next` line once done, and note in session notes which
  legacy PM tickets were deprecated in favor of it.

## Verification

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Coverage floor (`.claude/rules/testing.md`) should not regress; these are additive tests only.
