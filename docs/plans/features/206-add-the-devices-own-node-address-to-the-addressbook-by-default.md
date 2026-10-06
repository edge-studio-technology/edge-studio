# Local Device Address Book Contact Plan

**Status:** Step 1 revised and verified for separate app-contact creation and duplicate destinations; live RPC verification pending; steps 2–4 not started
**Created:** 2026-10-06
**Branch:** `task/206-add-the-devices-own-node-address-to-the-addressbook-by-default`
**Audit baseline:** `e3c52cf8` (clean working tree before this planning session)
**Goal:** Automatically add one clearly identified, app-managed contact for the local Minima wallet while preserving user-created contacts and preventing repeated automatic additions.

## Context

[OpenProject #206](https://openproject.privateprivate.org/work_packages/206), “Add the devices own node address to the addressbook by default”, is an In progress task under #322 Wallet Service. Its description requires automatic insertion during device/address-book initialization, duplicate prevention, and identification as the local device. The ticket has no attachments, dependency relations, or substantive implementation discussion. Its current estimate is 1 hour / 1 story point.

The user clarified the contact policy after reviewing the audit: **managed contact; only notes editable; label/name, address, and local-device marker protected; cannot be removed.** The earlier draft allowed label edits; this clarification supersedes that behavior. Step 1's persistence/parser foundation is implemented; automatic initialization and protections remain for steps 2–3.

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

The following uses the clarified notes-only policy for a separate app-owned contact. Step 1 implements check/create persistence; startup, protection, UI, and wallet-replacement decisions remain ahead.

- The app creates its own contact labeled **This device**, with a separate **Local device** indicator that remains visible after editing or clearing notes. User-created contacts retain their existing fields and edit/removal permissions.
- New and existing installations receive the contact automatically once Minima can supply default addresses, whether or not anyone has opened Wallet.
- A previously created app contact stays unchanged during initialization. Node/backend restarts, receive-address refreshes, and wallet-address ordering or pool changes do not automatically select a new one.
- Normal initialization checks for the feature's own app-managed self-contact. If present, skip creation; if missing, create one. A user-created contact with a wallet address does not satisfy that check and must not be adopted, locked, or otherwise changed.
- The app contact may share even the exact same destination with a manually added contact. Manual contacts are ignored during initial selection; no alternate address is selected merely to avoid the user's entries. Manual copies stay editable/removable. Preserve the current exact-address duplicate rule between ordinary contacts.
- Only notes remain editable. The API rejects changing the managed label/name or address, or deleting the contact. Unchanged label/address values submitted by an older client are allowed. Clients cannot designate their own contacts as local.
- An unavailable node, initializing wallet, empty response, timeout, or malformed response creates nothing and clears nothing. Retry on the existing health cadence. Address-book reads still return saved contacts.
- Wallet replacement is a separate pending policy. The current initializer does not demote or replace an existing app contact. Any future replacement handling must preserve manual contacts and define how existing workflow references and the previous destination are handled before being enabled.

## Backend changes

### 1. Local identity and atomic persistence

- Add `is_local_device INTEGER NOT NULL DEFAULT 0` through `ensureColumn` in `database.ts`, plus a partial unique index for the true marker. Rebuild the legacy table transactionally to remove global address uniqueness, copy every field/ID, and add an exact-address unique index applying only to ordinary rows. Existing contacts start as ordinary recipients; migrations do not call RPC.
- Add an API boolean `isLocalDevice` to the backend/frontend `AddressBookEntry` types. Map the SQLite integer consistently in list and lookup results, keeping existing fields and the array response shape.
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

- In `address-book.routes.ts`, protect label/address changes and DELETE based on the stored marker, not a client value, name, or note. Allow notes edits and unchanged label/address values. Return an actionable structured conflict error for a protected operation.
- Keep admin checks and ordinary-contact CRUD behavior. Allow manual copies of the managed destination, including exact matches and aliases; retain the previous exact-text uniqueness check between manual contacts. For the managed entry, unchanged address values must not conflict with a separate manual copy.
- Correct the backend `UpdateAddressBookEntryInput` type's existing missing `address` field while touching that contract.

## Frontend changes

- In `AddressBookPanel.tsx`, use existing ESDS components to add a Local device indicator in the name cell and contact details. Keep it visible even if Notes is hidden or edited.
- Retain Edit for the managed contact but render its label/name and address read-only with brief explanatory copy; only Notes can be changed. Remove its Remove action; normal recipients retain their existing controls.
- Reload the list when a previously unavailable node becomes available. The list-handler initialization fallback handles an open table racing the background initializer. Do not add a separate browser RPC or general polling store.
- Append local-device identity to option labels in `SendPaymentModal.tsx` and `WorkflowBlockInspectors.tsx`, keeping the existing IDs/addresses as values.
- In `workflowHelpers.ts:defaultEditBlockConfig()`, preserve automatic selection of an ordinary recipient while excluding the managed entry from implicit defaults; leave the recipient blank when no ordinary contact exists. The managed entry remains available for explicit selection.
- Keep search, column visibility, pagination, copy, view, and ordinary-contact flows intact. No new shared UI component is required.

## Implementation order and acceptance checks

1. **Persistence for check-own-contact/create-if-missing, duplicate destinations, and live RPC shape.** Code revised and verified; live response confirmation pending. Verify separate creation, skipping an existing feature contact, alias handling, repeatable migration, stable IDs, one marker, and unchanged user metadata/permissions.
2. **Add initialization, poller/list integration, and API guards.** Verify creation without visiting Wallet, offline startup/retry, concurrent attempts, unchanged-poll idempotency, protected mutations, and continued health monitoring after an initialization failure.
3. **Add UI identity/protection and update payment consumers.** Verify notes-only editing, persistent local identity, protected fields/actions, recovery reload, ordinary CRUD, and explicit local-recipient selection.
4. **Settle wallet-replacement behavior and update docs.** Decide how a restored wallet affects the app contact before claiming restored-wallet ownership handling. Keep normal initialization check/create-only and preserve manual contacts and existing payment references. Run the full checks below before marking implementation complete.

## Tests

### Step 1 implementation progress (2026-10-06)

- Added the repeatable `is_local_device` migration, a partial unique index enforcing one true marker, and ordinary-contact-only address uniqueness. The transactional legacy-table migration preserves all contact fields and IDs, existing markers, and workflow references. Repository reads expose `isLocalDevice` as a boolean; backend/frontend contracts match.
- Added validated Mx/hex byte comparison, including case, whitespace, odd hex nibbles, and preserved leading bytes. Saved address text is never rewritten.
- Revised `ensureLocalAddressBookEntry()` to check only for the marked app contact and return it unchanged if present, regardless of the supplied pool. Otherwise it validates candidates, orders by canonical address then address text, and inserts a distinct **This device** row. Adoption and automatic marker replacement are removed. The result reports the entry and whether creation occurred.
- Added a strict `scripts` parser accepting only explicit RPC success, an array, boolean flags, and matching validated hex/Mx pairs for default/simple entries. It projects only Mx destinations and rejects malformed candidate data. Added a source-shaped fixture through the real RPC/redaction/parser boundary; it is not a deployed-node recording.
- Added repository and real-database route regressions for identical addresses/names, aliases, fully saved pools, skipped initialization, rollback, independent manual create/edit/delete, and retained manual duplicate validation. First reproduced 10 failures against the old adoption/global-uniqueness behavior, then made the revised tests pass. No runtime initializer or managed-contact guards are connected yet.
- Local RPC verification at `127.0.0.1:9005` returned connection refused. Upstream `scripts`, `ScriptRow`, and hexadecimal decoding source were rechecked; deployed-image confirmation remains open.
- Revised focused backend checks: **81 tests passed across 6 files** (repository, routes, migrations, comparison, wallet parser, RPC boundary). `npm run check` passed **3,238 tests** (backend 1,295; frontend 1,720; Update Agent 171; scripts 52), coverage thresholds, typechecks, and clean dependency audits. Backend/frontend production builds, Compose configuration, and diff checks passed. Existing frontend chunk-size and unset Compose image-variable warnings remain; no browser or live-node/Pi verification was completed.

The existing baseline and remaining acceptance checks below continue to apply; no scheduler, API protection, or UI behavior has been added in step 1.

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
- `SECURITY.md` / `docs/security/wallet-and-tokens.md`: document server-owned local identity and that wallet replacement preserves payment destinations and references.
- [ADR 0030](../../adr/0030-app-owned-local-address-book-contact.md) records separate app ownership, check/create initialization, and scoped uniqueness. Record any subsequently accepted wallet-replacement policy separately before enabling it.
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
5. Edit/clear notes; attempt protected label/address/delete operations through both UI and API; confirm ordinary contacts still work normally.
6. Open Send payment and workflow recipient selection: confirm the local marker and explicit-selection behavior, without submitting a payment merely to test this UI.
7. After settling wallet-replacement behavior, verify it on a disposable node and confirm manual contacts and workflow references are preserved; the current step 1 initializer does not replace an existing app contact.

## Scope and remaining uncertainty

This is a small extension of the current address book, independent of #270 Rework Wallet Service V2. It does not add multi-wallet support, change the Receive QR rotation, create key material, merge historical alias contacts, or change installation topology.

The notes-only managed-contact policy adds schema, API, and UI work beyond a simple insertion hook. The ticket's one-hour estimate should be reassessed against the migration, alias handling, restore integration, and real-node QA rather than treated as verified effort. The remaining technical gate is the `scripts` response on the actually deployed Minima image.

## Contact policy

The ticket requires automatic addition, duplicate prevention, and local identification. It does not specify removal restrictions or continuous reconciliation. The managed-contact policy below applies only to the app-created contact; automatic adoption of user-created contacts is rejected. The other options are retained as alternatives considered during planning.

| Option | Operator behavior | Implementation consequences |
| --- | --- | --- |
| App-owned managed contact (clarified selection) | Only the app-created contact has notes-only editing, a protected name/address, and no removal; user contacts retain control. | Check/create initialization, separate IDs with duplicate destinations allowed, and server-side PATCH/DELETE guards on the managed entry only. |
| Seeded normal contact | Automatically added once, then freely editable/removable. | Persist completed initialization so a deliberate deletion is respected; revalidate/clear local identity after address edits or wallet replacement. |
| Protected address with optional hiding/removal | Address remains app-owned; operator can hide/remove it and restore it later. | Requires a persisted suppression state and a restore action; more UI and state than either option above. |

The initialization rule is settled: check for this feature's own contact, skip creation if present, create it if missing, and leave manually added contacts untouched. Sharing a destination is allowed and implemented through scoped uniqueness. Wallet-replacement behavior remains separate from normal initialization. The existing rotating Receive QR can legitimately show a different address from this stable contact; documentation should explain that both belong to the same wallet at creation.

The user raised an optional reroll action. Recommendation: consider it as a follow-up after the core feature, with an explicit user action and defined workflow-reference behavior; do not add it or automatically rotate addresses in this step.
