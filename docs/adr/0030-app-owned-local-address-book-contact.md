# 0030: Keep the Local Address-Book Contact App-Owned

**Status:** Accepted
**Date:** 2026-10-06

## Context

OpenProject #206 adds a convenient local-wallet recipient to the address book. The contact's
agreed controls allow notes edits while protecting its name, address, and removal.
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
  **This device** row with the marker set. Selection does not query or modify manual contacts.
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

## Alternatives considered

- **Adopt a matching manual contact.** Rejected because it changes the user's control over a row
  they created, even when its text and ID remain intact.
- **Choose an address absent from manual contacts.** Rejected because initialization would still
  depend on user additions and would need another policy if all wallet addresses were saved.
- **Remove all address uniqueness.** Unnecessary; coexistence only requires exempting the one
  app-managed row, while ordinary-contact behavior can remain unchanged.
- **Automatically replace the contact when the address pool changes.** Deferred. The accepted
  initializer is check/create only; wallet replacement needs its own explicit policy.

## Consequences

- Two rows can represent the same destination; they remain distinct contacts with distinct IDs.
- Repeated initialization and reordered wallet responses cannot rotate the saved contact.
- A successful, valid address pool is required only for first creation; empty or invalid initial
  data creates nothing.
- Rerolling is not implemented. A future explicit change-address action must define what happens
  to workflow references that resolve the managed contact's destination by ID.
- Startup/API integration and managed-contact mutation guards are implemented in step 2; frontend
  identity and control presentation remain step 3. This is not a completed end-to-end feature.

## Where this lives in code

- `backend/src/db/database.ts` — legacy table migration and scoped unique indexes.
- `backend/src/features/address-book/address-book.repository.ts` — check/create transaction and
  ordinary-contact address lookup.
- `backend/src/features/address-book/address-book.service.ts` — coalesced initialization and creation audit.
- `backend/src/features/address-book/address-book.routes.ts` — best-effort listing and guarded CRUD by contact ID.
- `backend/src/features/minima/minima-poll.service.ts` — automatic initialization and retry.
- `backend/src/features/automation/automation.service.ts` — recipient lookup by contact ID.
- `backend/tests/db/database.test.ts` and `backend/tests/features/address-book/` — migration,
  repeated initialization, independent CRUD, and duplicate-destination regression checks.
