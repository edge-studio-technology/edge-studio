# Local Device Address Book Contact Plan

**Status:** Audit complete; implementation not started; proposed implementation below
**Created:** 2026-10-06
**Branch:** `task/206-add-the-devices-own-node-address-to-the-addressbook-by-default`
**Audit baseline:** `e3c52cf8` (clean working tree before this planning session)
**Goal:** Automatically add one clearly identified, managed contact for the local Minima wallet without duplicating an existing recipient.

## Context

[OpenProject #206](https://openproject.privateprivate.org/work_packages/206), “Add the devices own node address to the addressbook by default”, is an In progress task under #322 Wallet Service. Its description requires automatic insertion during device/address-book initialization, duplicate prevention, and identification as the local device. The ticket has no attachments, dependency relations, or substantive implementation discussion. Its current estimate is 1 hour / 1 story point.

The user clarified the contact policy after reviewing the audit: **managed contact; only notes editable; label/name, address, and local-device marker protected; cannot be removed.** The earlier draft allowed label edits; this clarification supersedes that behavior. The implementation below remains a proposal; application coding has not started.

“Node address” is interpreted as a spendable Minima wallet receive address, consistent with the address book's payment-recipient role. It is not the node's RPC/P2P network endpoint, Maxima contact address, or Edge Studio device UUID. Minima has a pool of default wallet addresses, so this contact represents one stable receive address belonging to this device.

## Current project audit

| Area | Existing implementation | Work needed |
| --- | --- | --- |
| Persistence | `backend/src/db/database.ts` creates `address_book` with `id`, `label`, unique `address`, optional `notes`, and `created_at`; migrations are repeatable through `ensureColumn`. | Add a durable local-device marker; preserve existing rows. |
| Repository | `backend/src/features/address-book/address-book.repository.ts` supports list, lookup, insert, update, and delete. Lookup and uniqueness compare address text exactly. | Add atomic adoption/insertion and enforce at most one managed contact. |
| API | `address-book.routes.ts`, registered at `/api/wallet/address-book` in `app.ts`, returns a JSON array and allows admin create/update/delete. Reads are authenticated. | Return identity metadata and enforce managed-contact protections on the backend. |
| Address validation | `backend/src/shared/minima-address.ts` validates hexadecimal addresses and checksummed Mx addresses; it already contains Mx decoding. | Reuse this to compare equivalent Mx/0x addresses for local-contact adoption. |
| Wallet RPC | `wallet.service.ts:getReceiveAddress()` calls `getaddress`, parses it, and generates a QR image. `parseAddressResponse()` accepts either address representation. | Use a narrow public-address discovery helper with strict success/shape checks; no QR generation is needed for seeding. |
| Startup | `backend/src/index.ts` validates APP_SECRET and imports `startup.ts`; `startup.ts` runs migrations, ensures a device UUID, and starts the Minima health poller. | Initialization belongs after migrations through the existing poller, rather than a new blocking startup dependency or setup-wizard requirement. |
| Retry lifecycle | `minima-poll.service.ts` runs immediately and then every configured health interval (default 60 seconds), with overlap prevention. | Reconcile the local contact when the node is running; isolate reconciliation failures from stall/resync monitoring. |
| Address-book UI | `AddressBookPanel.tsx` provides table filtering/pagination, copy/view, editable contact fields, and confirmed removal. It loads once on mount or explicit error retry. | Show persistent local identity, protect the label/address, hide removal, and account for initialization after node recovery. |
| Payment consumers | `SendPaymentModal.tsx` and workflow recipient selectors consume the same address-book API. Workflow execution resolves `recipientAddressBookId` at runtime. | Show local identity in selectors without changing recipient IDs or payment behavior. |
| Automation defaults | `workflowHelpers.ts:defaultEditBlockConfig()` currently selects `addressBook[0]` for a new payment block in the editor. | Avoid implicitly selecting the newly seeded local contact; keep a blank recipient when it is the only entry. |
| Existing tests | SQLite repository tests, address validation tests, wallet service/parser tests, health-poller tests, and frontend table/payment/automation tests are available. | Extend these around initialization, protection, aliases, retry, and restore behavior. |

Two details constrain the implementation:

- Minima's `getaddress` returns a random existing default address, as confirmed in the official [getaddress command](https://github.com/minima-global/Minima/blob/master/src/org/minima/system/commands/base/getaddress.java) and [Wallet implementation](https://github.com/minima-global/Minima/blob/master/src/org/minima/database/wallet/Wallet.java). `ReceiveQrPanel.tsx` refreshes that selection every three minutes. Seeding from every receive refresh would accumulate contacts; changing the receive/QR experience is outside this task.
- The official [scripts command](https://github.com/minima-global/Minima/blob/master/src/org/minima/system/commands/scripts/scripts.java) lists tracked scripts and addresses. [ScriptRow](https://github.com/minima-global/Minima/blob/master/src/org/minima/database/wallet/ScriptRow.java) exposes `address`, `miniaddress`, `simple`, and `default`. A tracked address alone is insufficient evidence of a default wallet recipient; use valid default/simple entries. This was a source audit of upstream master, not verification of the deployed `minimacore` image; confirm its response before implementation is finalized.

README's Wallet section still documents labeled-account endpoints absent from the current wallet router. Correct the affected wallet/address-book description when documenting this feature; do not restore that old account model.

## Proposed behavior

The following uses the clarified notes-only managed-contact policy. Address selection and wallet-replacement details remain proposed implementation behavior.

- A new contact is labeled **This device**, with a separate **Local device** indicator that remains visible after editing or clearing notes. An adopted existing contact retains its label, which becomes protected.
- New and existing installations receive the contact automatically once Minima can supply default addresses, whether or not anyone has opened Wallet.
- A previously chosen address stays selected while it is still a valid default address of the configured wallet. Node/backend restarts, receive-address refreshes, and address-list ordering changes do not select a new one.
- Reuse an existing contact for the chosen address, including an equivalent Mx/0x representation or letter case. Preserve its ID, address text, label, notes, and creation time.
- If no managed contact exists, prefer an existing contact belonging to the returned default-address pool; otherwise choose a deterministic candidate from that pool and insert it. Preserve that selection on subsequent checks.
- Only notes remain editable. The API rejects changing the managed label/name or address, or deleting the contact. Unchanged label/address values submitted by an older client are allowed. Clients cannot designate their own contacts as local.
- An unavailable node, initializing wallet, empty response, timeout, or malformed response creates nothing and clears nothing. Retry on the existing health cadence. Address-book reads still return saved contacts.
- After a confirmed wallet replacement, keep the previous contact's ID/address/content, remove its local marker, and adopt/create a contact for the current wallet. Do not silently retarget workflow recipients or delete old contacts. Only a successful, valid, nonempty wallet-address response permits this transition; transient failures preserve the last known state.

## Backend changes

### 1. Local identity and atomic persistence

- Add `is_local_device INTEGER NOT NULL DEFAULT 0` through `ensureColumn` in `database.ts`, plus a partial unique index for the true marker. Existing contacts start as ordinary recipients; migrations do not call RPC.
- Add an API boolean `isLocalDevice` to the backend/frontend `AddressBookEntry` types. Map the SQLite integer consistently in list and lookup results, keeping existing fields and the array response shape.
- Add one focused repository transaction to adopt/create the current local entry and, when necessary, demote the previous local entry. Perform RPC before the transaction; keep database work synchronous and atomic.
- Extend the existing address helper with canonical comparison based on validated Mx payload/hex bytes. Use it for the local-contact candidate lookup rather than introducing a broad schema rewrite or rewriting saved addresses.
- If an installation already has equivalent Mx and 0x rows, select one deterministically for the local marker and insert nothing. Keep other existing rows and their references intact; historical contact merging is separate work.

### 2. Address discovery and reconciliation

- Add `wallet.service.ts:getLocalWalletAddresses()` using the fixed, read-only `scripts` RPC command and the existing `runMinimaPathCommand()` transport. Add a focused parser in `wallet.parse.ts` for the expected array and default/simple flags.
- Require transport and RPC success, validate address data, and project only the public address fields needed by this feature. Do not expose the full script list or read seed/private-key commands.
- Add `backend/src/features/address-book/address-book.service.ts` with one reconciliation function and a shared in-flight promise to coalesce simultaneous initialization attempts.
- Invoke it during `pollMinimaHealth()` when the node state is running, before the existing early return for “no stall”. Give reconciliation its own error boundary so failure cannot skip health monitoring or auto-resync handling.
- Keep startup nonblocking and reuse the current immediate poll and interval. No new scheduler, environment setting, installation step, or onboarding dependency is needed.
- Let the authenticated list handler make a bounded best-effort initialization attempt only while there is no managed row, reusing the same service/in-flight attempt. Catch upstream discovery failures and still return the saved array; database failures must remain actual API errors. Once seeded, list reads remain database-only and ongoing reconciliation belongs to the poller.
- Audit actual managed-contact creation/adoption/replacement through the existing audit service; do not record an event on every unchanged poll.

### 3. API protection

- In `address-book.routes.ts`, protect label/address changes and DELETE based on the stored marker, not a client value, name, or note. Allow notes edits and unchanged label/address values. Return an actionable structured conflict error for a protected operation.
- Keep admin checks and ordinary-contact CRUD behavior. Normalize comparisons for changes involving the managed destination so its Mx/0x alias cannot be added as a second recipient through create/edit.
- Correct the backend `UpdateAddressBookEntryInput` type's existing missing `address` field while touching that contract.

## Frontend changes

- In `AddressBookPanel.tsx`, use existing ESDS components to add a Local device indicator in the name cell and contact details. Keep it visible even if Notes is hidden or edited.
- Retain Edit for the managed contact but render its label/name and address read-only with brief explanatory copy; only Notes can be changed. Remove its Remove action; normal recipients retain their existing controls.
- Reload the list when a previously unavailable node becomes available. The list-handler initialization fallback handles an open table racing the background initializer. Do not add a separate browser RPC or general polling store.
- Append local-device identity to option labels in `SendPaymentModal.tsx` and `WorkflowBlockInspectors.tsx`, keeping the existing IDs/addresses as values.
- In `workflowHelpers.ts:defaultEditBlockConfig()`, preserve automatic selection of an ordinary recipient while excluding the managed entry from implicit defaults; leave the recipient blank when no ordinary contact exists. The managed entry remains available for explicit selection.
- Keep search, column visibility, pagination, copy, view, and ordinary-contact flows intact. No new shared UI component is required.

## Implementation order and acceptance checks

1. **Confirm live RPC shape; add parser/comparison and schema/repository work.** Verify valid default-address selection, alias matching, repeatable migration, stable IDs, one marker, and preserved user metadata.
2. **Add reconciliation, poller/list integration, and API guards.** Verify creation without visiting Wallet, offline startup/retry, concurrent attempts, unchanged-poll idempotency, protected mutations, and continued health monitoring after an initialization failure.
3. **Add UI identity/protection and update payment consumers.** Verify notes-only editing, persistent local identity, protected fields/actions, recovery reload, ordinary CRUD, and explicit local-recipient selection.
4. **Verify wallet replacement and update docs.** Confirm the old contact and its workflow references retain the old destination; only the current-wallet contact has the marker. Run the full checks below before marking implementation complete.

## Tests

- Database/repository: existing-install migration; repeated migrations; insert/adopt; unique marker; case/Mx/0x matching; existing alias rows preserved; metadata/IDs preserved; wallet replacement.
- Address-book service: empty/invalid/RPC-failure responses; retry after node readiness; repeated calls do not add contacts; in-flight coalescing; changing RPC ordering does not rotate the selected address; replacement requires confirmed address data.
- Minima health poller: initialization runs on healthy, nonstalled status; unavailable states skip it; reconciliation failure does not suppress stall detection or resync.
- Routes: offline list returns saved data; initialization failure does not become a whole-table failure; notes edits succeed; changed label/address and deletion fail; unchanged label/address values are compatible; ordinary CRUD remains; managed-address aliases cannot be created/assigned to another contact; client identity fields cannot forge a managed entry.
- Frontend: local identity in row/detail/selectors, persistent identity after notes edits, read-only label/address and no removal, recovery loading, ordinary actions, existing search/pagination, explicit payment selection, and no implicit local-recipient default.
- Include a recorded `scripts` response through the real RPC/parsing boundary in `minima.rpc.test.ts`, alongside service tests, so response handling is exercised beyond a mocked RPC helper.

## Docs

After implementation:

- `README.md`: document automatic managed contact, readiness/retry, edit restrictions, offline behavior, and wallet-replacement behavior; reconcile the affected stale Wallet section.
- `CHANGELOG.md`: add a branch-specific Unreleased Added entry for the default local-device contact and a Changed entry for its protection if useful.
- `SECURITY.md` / `docs/security/wallet-and-tokens.md`: document server-owned local identity and that wallet replacement preserves payment destinations and references.
- Use the ADR skill to record the implemented address-selection and wallet-replacement decision in the next available ADR; do not assign a number during planning.
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
2. Existing database with the same wallet address already saved as Mx, 0x, or different case: confirm adoption without insertion or loss of label/notes/ID.
3. Restart both services repeatedly and refresh Receive/QR: confirm the managed recipient/address stays stable.
4. Start with Minima stopped, then start it: confirm saved contacts remain accessible and initialization retries successfully.
5. Edit/clear notes; attempt protected label/address/delete operations through both UI and API; confirm ordinary contacts still work normally.
6. Open Send payment and workflow recipient selection: confirm the local marker and explicit-selection behavior, without submitting a payment merely to test this UI.
7. Restore a different wallet on a disposable node: confirm only the new wallet's contact is local and old contact IDs/payment destinations are unchanged.

## Scope and remaining uncertainty

This is a small extension of the current address book, independent of #270 Rework Wallet Service V2. It does not add multi-wallet support, change the Receive QR rotation, create key material, merge historical alias contacts, or change installation topology.

The notes-only managed-contact policy adds schema, API, and UI work beyond a simple insertion hook. The ticket's one-hour estimate should be reassessed against the migration, alias handling, restore integration, and real-node QA rather than treated as verified effort. The remaining technical gate is the `scripts` response on the actually deployed Minima image.

## Contact policy

The ticket requires automatic addition, duplicate prevention, and local identification. It does not specify removal restrictions or continuous reconciliation. The user clarified the managed-contact policy below; the other options are retained as alternatives considered during planning.

| Option | Operator behavior | Implementation consequences |
| --- | --- | --- |
| Managed contact (clarified selection) | Only notes editable; label/name and address protected; cannot remove. | Continuous wallet reconciliation and server-side PATCH/DELETE guards; guarantees a persistent local entry but takes away contact-removal control. |
| Seeded normal contact | Automatically added once, then freely editable/removable. | Persist completed initialization so a deliberate deletion is respected; revalidate/clear local identity after address edits or wallet replacement. |
| Protected address with optional hiding/removal | Address remains app-owned; operator can hide/remove it and restore it later. | Requires a persisted suppression state and a restore action; more UI and state than either option above. |

Wallet-replacement behavior remains proposed: whether it should automatically add a new contact should be settled before implementation. Stable address selection, alias-aware duplicate prevention, and accurate identity remain necessary. The existing rotating Receive QR can legitimately show a different address from this stable contact; documentation should explain that both belong to the same wallet.
