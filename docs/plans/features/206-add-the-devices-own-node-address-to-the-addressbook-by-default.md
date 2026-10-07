# Local Device Address Book Contact Plan

**Status:** Steps 1–4 implemented and locally verified; completed branch deployed on the Pi on 2026-10-07 with healthy services and automatic contact creation; deployed Minima lacks `checkrestore`, requiring a compatibility fix before wallet-replacement acceptance and final signoff
**Created:** 2026-10-06
**Branch:** `task/206-add-the-devices-own-node-address-to-the-addressbook-by-default`
**Audit baseline:** `e3c52cf8` (clean working tree before this planning session)
**Goal:** Automatically add one clearly identified, app-managed contact for the local Minima wallet while preserving user-created contacts and preventing repeated automatic additions.

## Context

[OpenProject #206](https://openproject.privateprivate.org/work_packages/206), “Add the devices own node address to the addressbook by default”, is an In progress task under #322 Wallet Service. Its description requires automatic insertion during device/address-book initialization, duplicate prevention, and identification as the local device. The ticket has no attachments, dependency relations, or substantive implementation discussion. Its current estimate is 1 hour / 1 story point.

The current contact policy, approved on 2026-10-07, is **managed contact; name and notes editable; address and local-device marker protected; cannot be removed.** This supersedes the earlier notes-only policy. Newly created contacts copy the dashboard device hostname once; existing names remain unchanged. The persistence/parser foundation, automatic backend initialization/API protections, and frontend identity/control presentation are implemented.

After reviewing step 1, the user clarified the initialization rule: **check whether this feature's app-created self-contact exists; if present, skip creation; otherwise create it; never touch manually added contacts.** The existence check uses the stored app-owned marker, not a matching address or label on a user contact. Restrictions apply only to the app-created managed contact. Sharing a destination with a manual contact is explicitly allowed. Step 1 now implements this rule and migrates global address uniqueness to ordinary-contact-only uniqueness. [ADR 0030](../../adr/0030-app-owned-local-address-book-contact.md) records the decision.

“Node address” is interpreted as a spendable Minima wallet receive address, consistent with the address book's payment-recipient role. It is not the node's RPC/P2P network endpoint, Maxima contact address, or Edge Studio device UUID. Minima has a pool of default wallet addresses, so this contact represents one stable receive address belonging to this device.

## Current project audit

| Area | Existing implementation | Work needed |
| --- | --- | --- |
| Persistence | Audit baseline: `address_book` had a globally unique `address` plus `id`, `label`, optional `notes`, and `created_at`. | Add a durable marker and scope address uniqueness to ordinary contacts; preserve existing rows and references. |
| Repository | `backend/src/features/address-book/address-book.repository.ts` supports list, lookup, insert, update, and delete. Lookup and uniqueness compare address text exactly. | Create/reuse only the app-managed contact and enforce at most one local marker; never adopt user contacts. |
| API | `address-book.routes.ts`, registered at `/api/wallet/address-book` in `app.ts`, returns a JSON array and allows admin create/update/delete. Reads are authenticated. | Return identity metadata and enforce managed-contact protections on the backend. |
| Address validation | `backend/src/shared/minima-address.ts` validates hexadecimal addresses and checksummed Mx addresses; it already contains Mx decoding. | Validate parser address pairs and deterministically order initial candidates without comparing against or changing user contacts. |
| Wallet RPC | `wallet.service.ts:getReceiveAddress()` calls `getaddress`, parses it, and generates a QR image. `parseAddressResponse()` accepts either address representation. | Use a narrow public-address discovery helper with strict success/shape checks; no QR generation is needed for seeding. |
| Startup | `backend/src/index.ts` validates APP_SECRET and imports `startup.ts`; `startup.ts` runs migrations, ensures a device UUID, and starts the Minima health poller. | Initialization belongs after migrations through the existing poller, rather than a new blocking startup dependency or setup-wizard requirement. |
| Retry lifecycle | `minima-poll.service.ts` runs immediately and then every configured health interval (default 60 seconds), with overlap prevention. | Initialize a missing app contact when the node is running; isolate initialization failures from stall/resync monitoring. |
| Address-book UI | `AddressBookPanel.tsx` provides table filtering/pagination, copy/view, editable contact fields, and confirmed removal. It loads once on mount or explicit error retry. | Show persistent local identity, protect the label/address, hide removal, and account for initialization after node recovery. |
| Payment consumers | `SendPaymentModal.tsx` and workflow recipient selectors consume the same address-book API. Workflow execution resolves `recipientAddressBookId` at runtime. | Show local identity in selectors without changing recipient IDs or payment behavior. |
| Automation defaults | `workflowHelpers.ts:defaultEditBlockConfig()` currently selects `addressBook[0]` for a new payment block in the editor. | Avoid implicitly selecting the newly seeded local contact; keep a blank recipient when it is the only entry. |
| Existing tests | SQLite repository tests, address validation tests, wallet service/parser tests, health-poller tests, and frontend table/payment/automation tests are available. | Extend these around initialization, protection, aliases, retry, and restore behavior. |

Two details constrain the implementation:

- Minima's `getaddress` returns a random existing default address, as confirmed in the official [getaddress command](https://github.com/minima-global/Minima/blob/master/src/org/minima/system/commands/base/getaddress.java) and [Wallet implementation](https://github.com/minima-global/Minima/blob/master/src/org/minima/database/wallet/Wallet.java). `ReceiveQrPanel.tsx` refreshes that selection every three minutes. Seeding from every receive refresh would accumulate contacts; changing the receive/QR experience is outside this task.
- The official [scripts command](https://github.com/minima-global/Minima/blob/master/src/org/minima/system/commands/scripts/scripts.java) lists tracked scripts and addresses. [ScriptRow](https://github.com/minima-global/Minima/blob/master/src/org/minima/database/wallet/ScriptRow.java) exposes `address`, `miniaddress`, `simple`, and `default`. A tracked address alone is insufficient evidence of a default wallet recipient; use valid default/simple entries. This was a source audit of upstream master, not verification of the deployed `minimacore` image; confirm its response before implementation is finalized.

README's Wallet section still documents labeled-account endpoints absent from the current wallet router. Correct the affected wallet/address-book description when documenting this feature; do not restore that old account model.

## Proposed behavior

The following uses the revised editable-name policy for a separate app-owned contact. Steps 1–4 implement check/create persistence, initialization, API protection, UI behavior, and wallet-replacement verification. Final live testing and signoff remain ahead.

- The app creates its own contact named after the dashboard device hostname, with a separate **Local device** indicator that remains visible after editing or clearing notes. User-created contacts retain their existing fields and edit/removal permissions.
- New and existing installations receive the contact automatically once Minima can supply default addresses, whether or not anyone has opened Wallet.
- A previously created, verified app contact stays unchanged during ordinary initialization. Node/backend restarts, receive-address refreshes, and wallet-address ordering or pool changes do not automatically select a new one.
- Normal initialization checks for the feature's own app-managed self-contact. If present, skip creation; if missing, create one. A user-created contact with a wallet address does not satisfy that check and must not be adopted, locked, or otherwise changed.
- The app contact may share even the exact same destination with a manually added contact. Manual contacts are ignored during initial selection; no alternate address is selected merely to avoid the user's entries. Manual copies stay editable/removable. Preserve the current exact-address duplicate rule between ordinary contacts.
- Name and notes remain editable. The API rejects manually changing the managed address or deleting the contact. Unchanged address values submitted by an older client are allowed. Copy the dashboard hostname only on creation; preserve existing names and later user renames through restart and wallet replacement. Clients cannot designate their own contacts as local.
- An unavailable node, initializing wallet, empty response, timeout, or malformed response creates nothing and clears nothing. Retry on the existing health cadence. Address-book reads still return saved contacts.
- After an app-controlled wallet replacement, verify the saved local address against the current wallet. Keep it if still owned (including Mx/hex aliases); otherwise update only the managed address, preserving ID, name, notes, creation time, and all manual contacts. Workflows intentionally follow the current wallet through the same contact ID. Record old/new public addresses in the audit log; do not create a backup recipient. Persist a pending-verification state before replacement dispatch and block payments through the managed contact until verification succeeds. Ordinary outages never invalidate a ready contact.

## Backend changes

### 1. Local identity and atomic persistence

- Add `is_local_device INTEGER NOT NULL DEFAULT 0` through `ensureColumn` in `database.ts`, plus a partial unique index for the true marker. Rebuild the legacy table transactionally to remove global address uniqueness, copy every field/ID, and add an exact-address unique index applying only to ordinary rows. Existing contacts start as ordinary recipients; migrations do not call RPC.
- Add API booleans `isLocalDevice` and `isLocalDevicePending` to the backend/frontend `AddressBookEntry` types. Map the SQLite integer consistently in list and lookup results, keeping existing fields and the array response shape.
- Use one immediate repository transaction: return the marked app contact unchanged if present; otherwise validate the supplied wallet pool, select deterministically, and insert a separate **This device** row with its own ID. Never look up ordinary rows for adoption, and never promote or demote any row during initialization. Keep database work synchronous and atomic.
- Extend the existing address helper with canonical comparison based on validated Mx payload/hex bytes. Use it to validate parser pairs and deterministically order initial candidates without rewriting saved addresses.
- Keep every existing ordinary Mx/0x alias row, its references, and its permissions intact; historical contact merging is separate work. Manual uniqueness lookups exclude the managed row so a user can create or edit their own copy of the same destination.

### 2. Address discovery and initialization

- Add `wallet.service.ts:getLocalWalletAddresses()` using the fixed, read-only `scripts` RPC command and the existing `runMinimaPathCommand()` transport. Add a focused parser in `wallet.parse.ts` for the expected array and default/simple flags.
- Require transport and RPC success, validate address data, and project only the public address fields needed by this feature. Do not expose the full script list or read seed/private-key commands.
- Add `backend/src/features/address-book/address-book.service.ts` with one initialization function and a shared in-flight promise to coalesce simultaneous attempts. Return an existing marked entry before doing RPC discovery.
- Invoke it during `pollMinimaHealth()` when the node state is running, before the existing early return for “no stall”. Give initialization its own error boundary so failure cannot skip health monitoring or auto-resync handling.
- Keep startup nonblocking and reuse the current immediate poll and interval. No new scheduler, environment setting, installation step, or onboarding dependency is needed.
- Let the authenticated list handler make a bounded best-effort initialization attempt only while there is no managed row, reusing the same service/in-flight attempt. Catch upstream discovery failures and still return the saved array; database failures must remain actual API errors. Once seeded, reads remain database-only; the poller also skips address discovery when the contact already exists.
- Audit actual app-contact creation through the existing audit service; do not record an event on every unchanged poll.

### 3. API protection

- In `address-book.routes.ts`, protect manual address changes and DELETE based on the stored marker, not a client value, name, or note. Allow validated name/notes edits and unchanged address values. Return an actionable structured conflict error for a protected operation.
- Keep admin checks and ordinary-contact CRUD behavior. Allow manual copies of the managed destination, including exact matches and aliases; retain the previous exact-text uniqueness check between manual contacts. For the managed entry, unchanged address values must not conflict with a separate manual copy.
- Correct the backend `UpdateAddressBookEntryInput` type's existing missing `address` field while touching that contract.

## Frontend changes

- In `AddressBookPanel.tsx`, use existing ESDS components to add a Local device indicator in the name cell and contact details. Keep it visible even if Notes is hidden or edited.
- Retain Edit for the managed contact but visibly disable its address with brief explanatory copy; name and Notes can be changed. Remove its Remove action; normal recipients retain their existing controls.
- Reload the list when a previously unavailable node becomes available. The list-handler initialization fallback handles an open table racing the background initializer. Do not add a separate browser RPC or general polling store.
- Append local-device identity to option labels in `SendPaymentModal.tsx` and `WorkflowBlockInspectors.tsx`. Use contact IDs for both selectors; Send payment resolves the selected ID to the stored address for the existing payment request. This step 3 adjustment keeps duplicate-destination options distinct and avoids a controlled address-valued select showing the wrong contact after selection. Workflow IDs and actual payment destinations remain unchanged.
- In `workflowHelpers.ts:defaultEditBlockConfig()`, preserve automatic selection of an ordinary recipient while excluding the managed entry from implicit defaults; leave the recipient blank when no ordinary contact exists. The managed entry remains available for explicit selection.
- Keep search, column visibility, pagination, copy, view, and ordinary-contact flows intact. No new shared UI component is required.

## Implementation order and acceptance checks

1. **Persistence for check-own-contact/create-if-missing, duplicate destinations, and live RPC shape.** Code committed and verified locally and on the dev Pi; authenticated browser CRUD checks pending. Verify separate creation, skipping an existing feature contact, alias handling, repeatable migration, stable IDs, one marker, and unchanged user metadata/permissions.
2. **Add initialization, poller/list integration, and API guards.** Implemented and locally verified: 116 focused tests, full check (3,265 tests), backend/frontend builds, and Compose config passed. Covered creation without visiting Wallet, offline startup/retry, concurrent attempts, unchanged-poll idempotency, protected mutations, and continued health monitoring after an initialization failure.
3. **Add UI identity/protection and update payment consumers.** Implemented and locally verified: 187 focused tests, full check (3,273 tests), backend/frontend builds, and Compose config passed. Covered notes edits/clears, persistent local identity with hidden Notes, read-only fields/no removal, recovery reload including stale responses, ordinary controls, duplicate destinations, and explicit local-recipient selection.
4. **Implement agreed wallet-replacement behavior and update docs.** Implemented and locally verified with 207 backend/190 frontend focused tests, full check (3,304 tests), builds, and Compose config. Accepted on 2026-10-06: preserve the app contact ID/metadata and manual rows, update its address only after replacement verification, and intentionally let workflows follow the current wallet. Use an audit record rather than a backup contact; block the managed recipient while verification is pending. Manual Pi/Playwright testing, live restore/restart verification, and signoff remain the final milestone.

## Wallet-replacement implementation (step 4)

- Reuse SQLite settings for a durable pending-verification revision; expose pending status on the managed contact without a new contact or changing ordinary rows. Writes are server-owned.
- Mark pending before a supported mutation is dispatched: backup `restoresync`, seed import, and whitelisted console `restore`/`reset` (console `restoresync` already uses the backup service). Hold verification while replacement RPC is in flight. Do not invalidate on ordinary restart/resync, failed validation, or a missing backup file.
- The persisted revision starts uncertain until the replacement RPC returns, preserving protection if the backend restarts during dispatch.
- A discovery attempt captures the persisted revision; its result cannot apply after another replacement changes the revision. Empty/invalid/offline discovery preserves pending state and the old address as historical data, unavailable for payment; retry through the existing poller/list path. Pending state survives backend restart.
- After replacement, a validated default/simple address pool either confirms the existing address canonically or supplies a deterministic new address. Atomically update only the managed address and clear pending status. Audit actual changes with contact ID and old/new public destinations. No automatic backup contact or reroll action is added.
- Send-payment selection submits a contact ID so the backend resolves the current saved destination and rejects pending recipients, including dialogs opened before replacement. Direct external-address sends and manual copies remain under user control. Automation checks the contact before and again after its asynchronous balance fetch, immediately before send dispatch.
- Seed-bearing archive/MySQL/MegaMMR console commands also use the same invalidation path. A replacement RPC exception makes completion uncertain; if discovery still shows the old address, keep it blocked until a subsequent completed replacement is verified. A verified different destination can resolve uncertainty.
- Scope covers replacements requested through Edge Studio. Replacing wallet files or making RPC calls outside the app does not notify this event-driven mechanism; do not claim automatic detection of out-of-band mutations.
- Final manual signoff must use a disposable wallet/node for replacement tests and must not send real funds merely to check selectors.

## Tests

### Step 1 implementation progress (2026-10-06)

- Added the repeatable `is_local_device` migration, a partial unique index enforcing one true marker, and ordinary-contact-only address uniqueness. The transactional legacy-table migration preserves all contact fields and IDs, existing markers, and workflow references. Repository reads expose `isLocalDevice` as a boolean; backend/frontend contracts match.
- Added validated Mx/hex byte comparison, including case, whitespace, odd hex nibbles, and preserved leading bytes. Saved address text is never rewritten.
- Revised `ensureLocalAddressBookEntry()` to check only for the marked app contact and return it unchanged if present, regardless of the supplied pool. Otherwise it validates candidates, orders by canonical address then address text, and inserts a distinct **This device** row. Adoption and automatic marker replacement are removed. The result reports the entry and whether creation occurred.
- Added a strict `scripts` parser accepting only explicit RPC success, an array, boolean flags, and matching validated hex/Mx pairs for default/simple entries. It projects only Mx destinations and rejects malformed candidate data. Added a source-shaped fixture through the real RPC/redaction/parser boundary; it is not a deployed-node recording.
- Added repository and real-database route regressions for identical addresses/names, aliases, fully saved pools, skipped initialization, rollback, independent manual create/edit/delete, and retained manual duplicate validation. First reproduced 10 failures against the old adoption/global-uniqueness behavior, then made the revised tests pass. No runtime initializer or managed-contact guards are connected yet.
- Local RPC verification at `127.0.0.1:9005` initially returned connection refused. Subsequent dev-Pi deployment of `39e5ccd3` with `DEV_MODE=true` confirmed the compiled parser accepts the deployed node's 64 default/simple receive addresses. Live migration, exact duplicate creation, skipped initialization, repeat migration, and backend restart checks passed; [Pi verification](../../qa/206-step-1-pi.md) records scope and cleanup.
- Revised focused backend checks: **81 tests passed across 6 files** (repository, routes, migrations, comparison, wallet parser, RPC boundary). `npm run check` passed **3,238 tests** (backend 1,295; frontend 1,720; Update Agent 171; scripts 52), coverage thresholds, typechecks, and clean dependency audits. Backend/frontend production builds, Compose configuration, and diff checks passed. Existing frontend chunk-size and unset Compose image-variable warnings remain. Subsequent Pi verification passed the live foundation checks; Playwright MCP reached the login page, with authenticated CRUD still pending.

### Step 2 implementation progress (2026-10-06)

- Added `getLocalWalletAddresses()` using the existing five-second RPC transport and fixed `scripts` command, requiring transport and RPC success and returning only validated public receive destinations.
- Added coalesced initialization that returns an existing app contact before discovery; only upstream discovery/parsing failures become a best-effort no-op. Local database errors propagate. Actual creation emits one `address-book.local.create` audit event; unchanged calls do not emit another event.
- Connected initialization to running-node health polls, including the existing nonblocking startup poll and interval retry. Its separate error boundary preserves stall detection and auto-resync handling after initialization failure. No new scheduler/configuration was added.
- Connected authenticated list requests to the same bounded attempt. Offline/malformed discovery still returns the saved array; database failures return a structured 500. Existing contacts make reads database-only.
- Added stored-marker PATCH/DELETE guards: notes edits/clears and unchanged name/address values work, protected changes/removal return actionable structured 409 conflicts, and client marker fields are ignored. Matching manual contacts remain ordinary and independently editable/removable.
- Verified 116 focused backend tests across seven files, including the real RPC/parser/database/audit path, concurrent list requests, a contact appearing during discovery, immediate startup/cadence retry, discovery timeout/failure recovery, database errors, manual copies, and protected API operations. `npm run check` passed 3,265 tests (backend 1,322; frontend 1,720; Update Agent 171; scripts 52), coverage thresholds, typechecks, and clean dependency audits. Backend/frontend production builds, Compose config, and diff checks passed; existing frontend chunk-size and unset Compose image warnings remain. No step 2 Pi deployment or authenticated browser test ran; the earlier Pi report covers step 1 only.

### Step 3 implementation progress (2026-10-06)

- Added the Local device indicator in the name cell and details, using the existing Pill. It remains visible after notes edits/clears and when Notes is hidden. Managed forms show explanatory copy and read-only name/address, focus Notes, and submit only notes; the managed menu omits Remove. Manual contacts with the same label/address keep ordinary controls.
- Reused the page's existing `actionsBlocked` transition to reload an open table when Minima becomes available, without browser RPC or a new poller. Search/preferences remain intact; an older load cannot overwrite the latest recovery response.
- Added local identity to send-payment and workflow options. Send-payment options now use contact IDs internally to distinguish duplicate destinations, resolving the selected contact to its unchanged saved address for payment. The shared select control is unchanged. New workflow payment blocks skip the managed contact when choosing an ordinary default, or leave the recipient blank; explicit selection of the local contact remains available.
- Reproduced six failures against the previous UI, then passed 187 focused tests across four frontend files. `npm run check` passed 3,273 tests (backend 1,322; frontend 1,728; Update Agent 171; scripts 52), coverage thresholds, typechecks, and clean dependency audits. Backend/frontend production builds, Compose config, and diff checks passed; existing frontend chunk-size and unset Compose image warnings remain. No step 3 deployment or authenticated browser test ran; the Pi report covers step 1 only. Wallet replacement and reroll behavior were not added.

### Step 4 implementation progress (2026-10-06)

- Amended ADR 0030 and the plan before implementation to record the agreed current-wallet identity and intentional workflow-following behavior, preserving manual contacts and using audit history rather than backup recipients.
- Reused SQLite settings for durable pending revisions, exposed `isLocalDevicePending`, and connected replacement dispatch to backup restore, seed import, console restore/reset, and seed-bearing archive/MySQL/MegaMMR commands. No schema migration or scheduler was added. In-flight guards, strict read-only restore-state checks, canonical membership comparison, and revision checks protect verification; ambiguous exceptions retain protection for still-old pools.
- Verification preserves same-wallet address text, or updates only the managed address while retaining its ID/metadata. The update, flag clearing, and public old/new audit are atomic, including rollback on audit failure. Send-payment contact IDs resolve on the backend; automation rechecks after balance awaits. Pending destinations are hidden/disabled and an available-node table retries pending verification every 30 seconds.
- Passed 207 focused backend tests across eight files and 190 focused frontend tests across four files. `npm run check` passed 3,304 tests (backend 1,350; frontend 1,731; Update Agent 171; scripts 52), typechecks, coverage thresholds, and clean dependency audits. Both production builds, Compose config, and diff checks passed; existing chunk-size/unset image-variable warnings remain. Updated README/changelog/security/task/session docs. Step 4 is committed locally and has not been deployed or manually signed off.

### Completed-branch deployment (2026-10-07)

Rebuilt and deployed `a7ddc75e` with `DEV_MODE=true` on the dev Pi. Both app services are healthy, report the expected revision, and retain the existing critical configuration. Automatic initialization created one wallet-owned managed contact and one creation audit from the empty address book. HTTPS health and the Playwright login page passed. A subsequent UI follow-up visibly disabled the managed name/address fields and deployed an uncommitted `a7ddc75e-dirty` source build; local Playwright fixtures confirmed protected/manual controls. The deployed Minima image rejects `checkrestore` with `Command not found`; pending wallet-replacement verification cannot complete with this RPC on this device. Resolve that compatibility issue before replacement acceptance/signoff. No wallet replacement, payments, or authenticated Pi browser checks ran. See [deployment evidence](../../qa/206-completed-branch-pi-deployment.md).

### Editable-name amendment implementation (2026-10-07)

Approved and implemented name/notes editing while retaining the protected address, marker, and deletion. New contacts default to `os.hostname()`, matching the dashboard hostname, only when inserted. Existing This device and user-selected names are preserved through hostname changes, initialization, and wallet replacement; no migration is required. The name field is enabled/focused, the address stays visibly disabled, and Local device identity/hidden Remove survive a rename. ADR 0030 records the revised policy.

Reproduced four backend/two frontend failures before implementation. All 65 focused backend/190 frontend tests and full check (3,308 tests), typechecks, coverage thresholds, clean audits, both builds, and Compose passed. Local Playwright fixtures confirmed name/notes-only saves and managed/manual controls. Deployed the uncommitted modified source to the Pi as `v0.42.2-dev+a7ddc75e.rename.dirty`; services and HTTPS health passed, source checksums matched, and the existing This device name/ID remained unchanged. Authenticated Pi CRUD, wallet replacement, and signoff remain ahead; the separate missing-checkrestore compatibility issue remains open.

The naming revision was subsequently committed as `90c38ead` and rebuilt on the Pi through its DEV_MODE installer. Both healthy app images report `v0.42.2-dev+90c38ead` with matching revision labels and installed Git HEAD. All saved fields of both existing contacts and critical configuration were preserved; SQLite integrity and HTTPS health passed. The final manual checks below and the missing-checkrestore compatibility issue remain open.

The existing baseline and remaining acceptance checks below continue to apply. Wallet-replacement behavior is implemented and locally verified; final live verification and signoff remain open.

- Database/repository: existing-install migration; repeated migrations; separate app-contact creation even with duplicate destinations; unique marker; existing user rows remain ordinary with unchanged metadata/IDs; skip an existing managed entry regardless of supplied pool changes.
- Address-book service: empty/invalid/RPC-failure responses before creation; retry after node readiness; repeated calls do not add contacts; in-flight coalescing; an existing marker skips discovery; changing RPC ordering does not rotate the selected address.
- Minima health poller: initialization runs on healthy, nonstalled status; unavailable states skip it; initialization failure does not suppress stall detection or resync.
- Routes: offline list returns saved data; initialization failure does not become a whole-table failure; managed notes edits succeed; managed label/address changes and deletion fail; unchanged label/address values are compatible even with a manual copy; user contacts retain ordinary CRUD when sharing the managed destination; exact-address manual duplicates remain rejected; client identity fields cannot forge a managed entry.
- Frontend: local identity in row/detail/selectors, persistent identity after notes edits, read-only label/address and no removal, recovery loading, ordinary actions, existing search/pagination, explicit payment selection, and no implicit local-recipient default.
- Include a recorded `scripts` response through the real RPC/parsing boundary in `minima.rpc.test.ts`, alongside service tests, so response handling is exercised beyond a mocked RPC helper.

## Docs

After implementation:

- `README.md`: document automatic managed contact, readiness/retry, edit restrictions, offline behavior, and wallet-replacement behavior; reconcile the affected stale Wallet section.
- `CHANGELOG.md`: add a branch-specific Unreleased Added entry for the default local-device contact and a Changed entry for its protection if useful.
- `SECURITY.md` / `docs/security/wallet-and-tokens.md`: document server-owned local identity, pending-payment protection, preserved manual destinations/contact references, and the managed reference following the verified current wallet.
- [ADR 0030](../../adr/0030-app-owned-local-address-book-contact.md) records separate app ownership, check/create initialization, and scoped uniqueness. The dated amendment records the accepted replacement, payment-following, pending-state, audit, and failure policy.
- Reconcile this plan, `docs/TASKS.md`, and `docs/SESSION.md` when the work is actually built and verified. OpenProject comments/status updates are separate actions; no ticket fields were changed during this audit.

## Verification

Baseline checks run during this planning session, against unchanged application code:

- Backend: 6 focused test files, **71 tests passed** (address-book repository/routes, wallet service/parser, Minima health poller, address validation). The initial sandbox run could not bind Supertest's local socket; rerunning with socket access passed.
- Frontend: 5 focused test files, **150 tests passed** (address-book panel/API, receive QR, send-payment modal, workflow helpers).
- No full repository check, builds, browser QA, or live Minima/Pi verification was run for this documentation-only audit.

After implementation, run the focused tests above, then:

```bash
npm run check
npm --prefix backend run build
npm --prefix frontend run build
docker compose config
git diff --check
git status --short --untracked-files=all
```

Manual verification with a disposable database and test node:

1. Fresh database/node: start the backend without opening Wallet; confirm one local contact appears once default addresses are ready.
2. Existing database with wallet addresses already saved as Mx, 0x, or different case: confirm every user contact remains ordinary, editable/removable, and unchanged; the app creates its own row even if the exact same destination is saved. Include a pool with every address already saved.
3. Restart both services repeatedly and refresh Receive/QR: confirm the managed recipient/address stays stable.
4. Start with Minima stopped, then start it: confirm saved contacts remain accessible and initialization retries successfully.
5. Rename the managed contact and edit/clear notes; verify its Local device indicator remains, invalid names are rejected, and existing names survive hostname changes/restarts/wallet replacement; attempt protected address/delete operations through both UI and API; confirm ordinary contacts still work normally.
6. Open Send payment and workflow recipient selection: confirm the local marker and explicit-selection behavior, without submitting a payment merely to test this UI.
7. Restore the same wallet on a disposable node: pending is visible during restore; the same contact ID/address/notes becomes ready without an address-change audit event.
8. Restore a different disposable wallet: verify only the app contact's address changes, ID/name/notes/creation time and all manual rows remain unchanged, no backup contact appears, and one `address-book.local.replace` event contains the public old/new destinations.
9. During pending verification, submit a contact-ID payment request with amount `0` (no valid send): expect `409`. Repeat with a manual copy: expect ordinary amount validation, not local-contact blocking. Do not submit a valid funded payment solely for this check.
10. Keep a send dialog/workflow editor open across replacement; confirm pending options and that the contact ID resolves to the current destination. Automated tests cover wallet-balance await races without real payments.
11. Start replacement with the node unavailable or interrupt its RPC response: confirm the old destination stays unavailable, pending survives backend restart, and retry verifies a different destination or a subsequently completed replacement. Confirm normal restart/outage alone does not invalidate a ready contact.
12. Verify the deployed node supports the strict `checkrestore` flags and that ready verification clears the UI status. Record the deployed commit/build, screenshots, test cleanup, any gaps, and the user's signoff. External wallet changes outside Edge Studio are outside this detection scope.

## Scope and remaining uncertainty

This is a small extension of the current address book, independent of #270 Rework Wallet Service V2. It does not add multi-wallet support, change the Receive QR rotation, create key material, merge historical alias contacts, or change installation topology.

The managed-contact policy adds schema, API, and UI work beyond a simple insertion hook. The ticket's one-hour estimate should be reassessed against the migration, alias handling, restore integration, and real-node QA rather than treated as verified effort. The deployed Minima response is verified and backend initialization/protection plus identity UI are implemented; authenticated browser/Pi checks of the completed feature and manual signoff remain.

## Contact policy

The ticket requires automatic addition, duplicate prevention, and local identification. It does not specify removal restrictions or continuous reconciliation. The managed-contact policy below applies only to the app-created contact; automatic adoption of user-created contacts is rejected. The other options are retained as alternatives considered during planning.

| Option | Operator behavior | Implementation consequences |
| --- | --- | --- |
| App-owned managed contact (clarified selection) | Only the app-created contact has editable name/notes, a protected address, and no removal; user contacts retain control. | Check/create initialization, separate IDs with duplicate destinations allowed, and server-side PATCH/DELETE guards on the managed entry only. |
| Seeded normal contact | Automatically added once, then freely editable/removable. | Persist completed initialization so a deliberate deletion is respected; revalidate/clear local identity after address edits or wallet replacement. |
| Protected address with optional hiding/removal | Address remains app-owned; operator can hide/remove it and restore it later. | Requires a persisted suppression state and a restore action; more UI and state than either option above. |

The initialization rule is settled: check for this feature's own contact, skip creation if present, create it if missing, and leave manually added contacts untouched. Sharing a destination is allowed and implemented through scoped uniqueness. Wallet-replacement behavior remains separate from normal initialization. The existing rotating Receive QR can legitimately show a different address from this stable contact; documentation should explain that both belong to the same wallet at creation.

The user explicitly agreed to keep reroll out of scope. Any future action requires separate scope and defined workflow-reference behavior; do not add it or automatically rotate addresses in #206.
