# 0040: Separate Portable History From Device Migration

**Status:** Accepted
**Date:** 2026-10-15

## Context

Operators need to move Edge Studio history to another installation without copying the source
device's configuration, credentials, or wallet-recovery material. Historic rows can contain
collected payloads and workflow inputs/outputs that make the records useful, but arbitrary JSON
may also contain credentials. Integritas proof records retain a hash of the original source; a
redacted archival payload is readable but cannot be used to recompute that hash.

An installation also has device-specific encrypted state: `APP_SECRET` encrypts local secrets,
Integritas Connect has encrypted account tokens, data-source configuration can hold webhook tokens
and request credentials, and Minima backups contain key material. Moving that state is a separate
security and recovery problem from viewing historical records.

## Decision

- Provide a portable-history export that contains only historical records: wallet history, workflow
  inbox items, workflow runs and block runs, data-source reads, and Integritas proof history.
- Build the export through a dedicated history-archive builder that returns a versioned document.
  A later device-migration feature must reuse that builder for its history section rather than
  maintain a second record serializer.
- Export the first archive as a direct JSON download. It contains no captures, verification PDFs,
  generated downloads, or other binary attachments. ZIP packaging is deferred until attachments or
  an encrypted migration bundle need it.
- Preserve useful historical payloads after `redactDeep()`/`redactSecrets()` processing, but never
  export configuration tables, users, sessions, encrypted secrets, `APP_SECRET`, Integritas tokens,
  webhook tokens, Minima backups, or local filesystem paths.
- Mark the archive as read-only history. Its future import can display records and their internal
  relationships, but cannot restore live wallet state or replay workflows.
- Require an admin session, current-credential confirmation, and an audit event for a full history
  export because the archive can contain sensitive collected data and financial history.
- Treat a future full device migration as a separate feature. It may add an explicitly chosen
  transfer password, encrypted configuration/secrets section, re-encryption under the destination
  `APP_SECRET`, and distinct Minima recovery steps. It must not be inferred from importing history.

## Alternatives considered

- **Export the SQLite database.** Rejected because it would transfer credentials, sessions,
  configuration, and installation-bound ciphertext alongside history.
- **Metadata-only history.** Rejected because workflow/data-source history without collected payloads
  is often not useful to inspect after transfer. Redaction is the accepted tradeoff.
- **Full device migration now.** Rejected because transferring generated/configured credentials and
  wallet-recovery data requires a separate encrypted transfer and recovery design.
- **ZIP archive in the first milestone.** Rejected because the archive has no attachments yet. A
  direct JSON response avoids a new archive dependency and a temporary file on the Pi.

## Consequences

- A history archive remains readable on a new Edge Studio installation without re-entering secrets.
- Reconnecting Integritas and recreating devices/workflows are required before a destination
  installation can operate like the source installation.
- Redacted payloads cannot be byte-for-byte source evidence. Proof hashes/status remain historical
  evidence, while source-byte verification requires a future explicit evidence-attachment export.
- The archive builder is a stable reuse boundary for a later encrypted device migration feature.

## Where this lives in code

- `backend/src/features/storage-history/history-archive.service.ts` - history-only archive document
  builder and redaction boundary.
- `backend/src/features/storage-history/storage-history.routes.ts` - re-authenticated export route.
- `frontend/src/features/storage-history/` - archive download action.
- `docs/plans/storage-history-lifecycle.md` - phased storage, archive/import, cleanup, and migration
  follow-up plan.

## History

- 2026-10-28: Renumbered from 0037 to 0040 to resolve a collision with the existing Minima backup decision; the decision is unchanged.
