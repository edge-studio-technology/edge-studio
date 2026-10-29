# 0030: Keep the Local Address-Book Contact App-Owned

**Status:** Accepted
**Date:** 2026-10-06

## Context

OpenProject #206 adds a local-wallet recipient to the address book. The first implementation
adopted an existing contact with the device's address; review rejected that because applying the
managed contact's protections took edit/delete rights away from a user-created row. The rule
instead: check for this feature's own contact, create it if missing, and ignore manual contacts
even when they share its destination. The legacy unique constraint on `address_book.address`
prevented that coexistence. Automation resolves recipients by contact ID, so IDs must be stable.

After a wallet replacement, the local contact must follow the new wallet, and so must workflows
that reference it; an old wallet's address under the local identity is misleading.

Verified: Minima's `checkrestore` command reports restore/shutdown state, but the deployed core
1.1.2.6 lacks it and answers ordinary RPC during a restore, before the restore shuts the node down.

## Decision

**Creation and identity**

- `ensureLocalAddressBookEntry()` checks a stored local marker inside an immediate transaction. If
  present it returns the contact unchanged; if missing it deterministically picks a validated
  wallet address and inserts a separate marked row. It never adopts, edits, or deletes another
  contact, and a manual row named **This device** doesn't count.
- A partial unique index enforces address uniqueness among ordinary contacts only, and another
  enforces one local marker, so a manual and the local contact can share an address. The
  migration rebuilds only the legacy table, copying every field and ID.
- The marker and a Local device pill identify the contact, so its name and notes are editable. The
  name defaults once to `os.hostname()` and is never resynchronised. The address can't be edited
  and the contact can't be deleted.

**Wallet replacement**

- Before an app-controlled backup restore or console restore/reset (including seed-bearing archive,
  MySQL, and MegaMMR commands) is dispatched, a durable verification revision is marked pending in
  settings. Discovery is held and payments to the managed contact are rejected while pending.
  Validation failures before dispatch and ordinary restarts don't trigger it.
- Completion stays uncertain from dispatch until the RPC returns, across backend restarts; an RPC
  exception keeps it uncertain, and an unchanged old pool can't re-enable the contact. Discovery
  results from an earlier revision are ignored.
- Readiness uses `checkrestore` and requires explicit false restoring/shutting-down flags. Only its
  exact unsupported-command response enables the fallback: a running container started after the
  persisted dispatch time, then an unlocked `status` and a validated address pool.
- If the current pool still owns the address it's kept; otherwise only the managed address
  changes, with ID and metadata preserved. Changes are audited atomically with contact ID and
  old/new public addresses.
- Manual sends carry the contact ID and resolve it server-side at dispatch; automation rechecks
  after its balance wait. Both follow the refreshed destination and fail clearly while pending.
- Out-of-band wallet changes are outside detection and are disclosed in the usage docs.

## Alternatives considered

- **Adopt a matching manual contact.** Changes a user's control over their own row.
- **Pick an address absent from manual contacts.** Still depends on user data and fails if all are
  saved.
- **Drop address uniqueness entirely.** Only the managed row needs the exemption.
- **Lock the name** (first version). The marker and pill already supply identity.
- **Rename to follow every hostname change.** Overwrites saved names; the backend container's
  hostname changes on rebuild.
- **Treat a successful `status` as restore complete.** The deployed core answers during restore.
- **Rotate on every address-pool change.** Initialisation stays check/create only; replacement is
  triggered by app-controlled wallet mutations.

## Consequences

- Workflow references to the local contact follow the current wallet.
- Unavailable discovery after a replacement keeps the recipient blocked until verified.
- Two rows can represent the same destination as distinct contacts.
- Empty or invalid initial wallet data creates nothing.
- No explicit change-address action exists; one would need to define what happens to workflows
  referencing the contact.

## History

- 2026-10-06: Wallet-replacement verification added.
- 2026-10-07: Name made editable, defaulting to the hostname.
- 2026-10-14: Seed phrase import removed (ADR 0036), leaving restore and console paths as triggers.
