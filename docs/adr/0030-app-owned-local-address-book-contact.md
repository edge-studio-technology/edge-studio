# 0030: Keep the Local Address-Book Contact App-Owned

**Status:** Accepted
**Date:** 2026-10-06

## Context

OpenProject #206 adds a convenient local-wallet recipient to the address book. The contact's
initial controls allowed notes edits while protecting its name, address, and removal; the
2026-10-07 amendment below allows name edits too.
The initial implementation adopted an existing wallet-address contact. User review rejected
this: applying those controls to a user-created contact takes away existing edit/delete rights.

The user clarified the rule: check for this feature's own contact, skip creation if present,
otherwise create it, and ignore manually added contacts even when their destinations duplicate
the app contact. The legacy `address_book.address` unique constraint prevented that coexistence.
Automation resolves recipients by contact ID, so preserving IDs and destinations matters.

## Decision

- `ensureLocalAddressBookEntry()` checks the stored local marker inside an immediate SQLite
  transaction. If present, it returns the contact unchanged without consulting the supplied pool.
- If missing, it validates and deterministically selects a wallet candidate and inserts a separate
  local-wallet row with the marker set. Its initial name follows the naming amendment below.
  Selection does not query or modify manual contacts.
- Initialization never adopts, relabels, edits, demotes, or deletes another contact. A user-created
  row named **This device** does not count as the feature's own contact.
- Replace global exact-address uniqueness with a partial unique index applying only to ordinary
  contacts. Keep a separate partial unique index enforcing one local marker. This allows the
  local/manual pair to share even the exact same address while preserving the existing duplicate
  rule between manual contacts.
- Migration rebuilds only the legacy address-book table, inside a transaction, copying every
  stored field and ID. Already migrated installations skip the rebuild.
- Manual-contact duplicate checks ignore the managed row. CRUD and workflow resolution continue
  to use each contact's own ID, so a manual copy can be edited or deleted independently.

## Naming amendment (2026-10-07)

The Local device pill and server-owned marker identify the managed recipient independently of
its name. The user approved editable names after reviewing that identity indicator.

- Default a newly created contact's name to `os.hostname()`, the same hostname displayed on
  the dashboard. Copy it once; do not continually synchronize it.
- Allow name and notes edits through the existing validated PATCH contract and edit form.
  Keep the address visibly disabled, prohibit manual address changes and deletion, and retain
  the Local device indicator regardless of the chosen name.
- Preserve every existing name, including This device, and preserve a user-selected name during
  restart, node recovery, and wallet replacement. No schema migration or relabeling is needed.
- The dashboard hostname currently belongs to the backend container and can change after a
  rebuild. A one-time default prevents that change from overwriting a user's contact name.

Locking the name was rejected for the revised policy because local identity is already supplied
by the marker/pill. Automatically renaming existing contacts or following every hostname change
was rejected because it would overwrite saved names.

## Wallet-replacement amendment (2026-10-06)

The user confirmed that a contact called **This device** must follow the current wallet after
replacement, and workflows referencing that contact should follow it too. Keeping an old wallet's
address under the local identity is misleading. An address alone is not a wallet backup.

- Mark a durable verification revision pending before app-controlled backup restore, seed import,
  or console restore/reset (including seed-bearing archive/MySQL/MegaMMR commands) is dispatched. Hold discovery during the replacement request and
  reject payments through the pending managed contact. Validation failures before dispatch and
  normal restart/outage do not trigger replacement.
- Reuse the poller/list initializer for verification and retry. Validated default/simple address
  membership uses canonical Mx/hex comparison; keep an address still owned, otherwise change
  only the managed address. Preserve contact ID, metadata, and every ordinary row.
- Ignore discovery from an earlier revision so overlapping requests cannot restore a stale
  destination. Persist pending state in settings so backend restarts retain payment protection.
- Completion is durably uncertain from dispatch until the RPC returns, including a backend restart
  during the operation. A replacement RPC exception retains uncertainty; an unchanged old pool cannot re-enable
  the contact until another completed replacement is verified. A verified different destination
  may resolve uncertainty. Failed validation before dispatch does not mark pending.
- Readiness uses the fixed [checkrestore command](https://github.com/minima-global/Minima/blob/master/src/org/minima/system/commands/mds/checkrestore.java),
  requiring explicit false restoring/shutting-down/completed-shutdown flags before discovering addresses.
  The deployed Minima core 1.1.2.6 omits that command and allows ordinary RPC during restore.
  Only its exact unsupported-command response enables the fallback: persist dispatch time with
  the pending revision, require a running Docker container started after that time, then require
  successful unlocked `status` and a validated address pool. Preserve dispatch time when the RPC
  returns; its completion can arrive after the new node started. Unknown readiness stays blocked.
- Audit actual changes atomically with the address update, using only contact ID and old/new public addresses. Do not automatically
  create a backup contact. Existing manually saved copies remain user-owned.
- Manual send requests selecting a saved contact carry its ID, resolved server-side at dispatch;
  automation rechecks after its balance await. Both intentionally follow the refreshed local
  destination and fail clearly while verification is pending.
- This event-driven policy covers Edge Studio's mutation paths. Out-of-band wallet changes are
  outside its detection scope and must be disclosed in usage docs and manual signoff.

## Alternatives considered

- **Adopt a matching manual contact.** Rejected because it changes the user's control over a row
  they created, even when its text and ID remain intact.
- **Choose an address absent from manual contacts.** Rejected because initialization would still
  depend on user additions and would need another policy if all wallet addresses were saved.
- **Remove all address uniqueness.** Unnecessary; coexistence only requires exempting the one
  app-managed row, while ordinary-contact behavior can remain unchanged.
- **Treat a successful status call as restore completion.** Rejected because the deployed core
  can answer during restore; its restore commands shut down the node before taking effect.
  The fallback therefore needs an observed subsequent start (on the same host clock).
- **Automatically rotate on every address-pool change.** Rejected. Ordinary initialization remains
  check/create only; the replacement policy below is triggered by app-controlled wallet mutations.

## Consequences

- Preserving a local contact ID intentionally lets its workflow references follow the current wallet.
- A replacement with unavailable discovery keeps the recipient blocked until a later verification.
- An audit event records the prior public destination without adding a selectable stale recipient.
- Two rows can represent the same destination; they remain distinct contacts with distinct IDs.
- Repeated initialization and reordered wallet responses cannot rotate the saved contact.
- A successful, valid address pool is required only for first creation; empty or invalid initial
  data creates nothing.
- Rerolling is not implemented. A future explicit change-address action must define what happens
  to workflow references that resolve the managed contact's destination by ID.
- Startup/API integration and managed-contact mutation guards are implemented in step 2; frontend
  identity and control presentation are implemented in step 3. Final live verification remains open.

## Where this lives in code

- `backend/src/db/database.ts` — legacy table migration and scoped unique indexes.
- `backend/src/features/address-book/address-book.repository.ts` — check/create transaction and
  ordinary-contact address lookup.
- `backend/src/features/address-book/address-book.service.ts` — coalesced initialization, replacement verification, and atomic public-address audit.
- `backend/src/features/address-book/wallet-replacement.service.ts` — pending-state invalidation and in-flight replacement guard.
- `backend/src/features/wallet/wallet.routes.ts` — current recipient resolution for manual sends.
- `backend/src/features/address-book/address-book.routes.ts` — best-effort listing and guarded CRUD by contact ID.
- `backend/src/features/minima/minima-poll.service.ts` — automatic initialization and retry.
- `backend/src/features/automation/automation.service.ts` — recipient lookup by contact ID.
- `backend/tests/db/database.test.ts` and `backend/tests/features/address-book/` — migration,
  repeated initialization, independent CRUD, and duplicate-destination regression checks.
