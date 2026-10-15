# Storage And History Lifecycle Plan

**Status:** In progress
**Created:** 2026-10-14  
**Goal:** Give operators visibility and deliberate control over Edge Studio's stored history without silently deleting evidence, financial records, or user content.

## Progress

- [x] Add read-only storage and history inventory API.
- [x] Add the Settings storage and history overview.
- [x] Define and implement versioned history-archive export.
- [ ] Define and implement read-only archived-history import.
- [ ] Add scoped manual cleanup with preview and confirmations.
- [ ] Define and implement per-category automatic retention.
- [x] Update operator/security documentation and changelog.
- [ ] Complete automated, browser, and Raspberry Pi verification.

## Context

Edge Studio currently preserves several kinds of local history indefinitely: Minima wallet history, workflow inbox items, workflow and block runs, data-source reads, and Integritas proof records. This prevents silent loss, but it can eventually exhaust a Raspberry Pi's disk. The existing retention scheduler only physically removes inbox rows that the operator has already deleted.

The first deliverable is monitor-only. It gives an operator a truthful overview of what is stored, how many records exist, and how much disk each category consumes. Cleanup, export, and import are later milestones; they must not be introduced as hidden consequences of monitoring.

The Settings page is the intended home. Name the surface **Storage & history**, not only "Logs", because it contains user content, financial records, and evidence as well as diagnostics.

This plan implements the unresolved lifecycle work identified in `docs/TASKS.md` and must preserve the accepted classifications in:

- `docs/adr/0023-classify-stored-records-before-applying-retention.md`
- `docs/adr/0026-preserve-workflow-run-history.md`
- `docs/adr/0033-persist-synced-wallet-history.md`

## Record Inventory And Lifecycle

### Operator history

| Category | Existing persistence | Monitor in first milestone | Initial lifecycle |
| --- | --- | --- | --- |
| Minima history | `wallet_transactions`, `wallet_send_history` | Rows and SQLite allocation | Preserve; current-wallet history cannot be cleared because it re-syncs from Minima |
| Workflow inbox | `automation_inbox_items` | Visible rows and SQLite allocation | Preserve until manually deleted; soft-deleted rows are purged by the current scheduler |
| Workflow diagnostics | `automation_runs`, `automation_block_runs` | Runs, block runs, and combined SQLite allocation | Preserve; parent runs and child block runs form one cleanup/export unit |
| Device diagnostics | `data_source_reads` | Rows and SQLite allocation | Preserve; proof-linked reads require special protection in later cleanup |
| Integritas evidence | `integritas_proofs` | Rows, SQLite allocation, verification-report files | Preserve until explicit deletion |

### Associated files And Operational Storage

| Category | Existing location | Monitor in first milestone | Archive status |
| --- | --- | --- | --- |
| Camera captures | `CAMERA_CAPTURE_DIR`, normally `/data/captures` | File count and directory size | Optional attachment in a future history archive |
| Verification reports | `/data/integritas-verification-reports` | File count and directory size | Optional attachment in a future history archive |
| Generated proof downloads | `/data/exports` | File count and directory size | Do not import; these are generated download artifacts |
| SQLite files | `/data/edge-studio.db`, `-wal`, `-shm` | Physical file sizes and total | Not exported as a database backup through this feature |
| Docker logs | Docker-managed `json-file` logs | Optional total system-storage indicator only | Not an application-history archive; existing Compose rotation remains authoritative |
| Audit events | `audit_events` | Row count and SQLite allocation | Monitor because it is unbounded; exclude from initial history archive/import |

Do not include users, sessions, encrypted settings, Integritas credentials, address-book contacts, device definitions, workflow definitions, Minima node backups, or raw SQLite files in the history archive. Those are configuration, credentials, or wallet-recovery data, not portable history.

## Milestone 1: Storage And History Overview

### Backend Changes

1. Add a read-only storage inventory feature under `backend/src/features/`, registered from `backend/src/app.ts`.
2. Reuse `backend/src/db/database.ts`'s SQLite connection to query record counts and SQLite allocation per table/index. Prefer SQLite `dbstat` totals over JSON-length estimates.
3. Measure the managed directories under `env.dataDir` from `backend/src/config/env.ts`: database files, captures, Integritas verification reports, and generated exports. Do not expose arbitrary paths or follow paths outside the managed data directory.
4. Return category metadata: display name, record count, allocated database bytes, associated-file count/bytes where applicable, oldest/newest record timestamps where inexpensive, and lifecycle status.
5. Report the physical SQLite database, WAL, and shared-memory sizes separately from table allocation. State in the response/UI that deleting rows does not immediately reduce physical database-file size without a later maintenance policy.
6. Keep this endpoint authenticated and read-only. Add admin gating only if the existing Settings route policy requires it; do not expose filesystem information to unauthenticated callers.
7. Add feature-level unit and route tests for empty state, representative table/file totals, inaccessible optional directories, and response redaction/path safety.

### Frontend Changes

1. Extend `frontend/src/pages/AuthSettingsPage.tsx` with a collapsed **Storage & history** disclosure using the established `Disclosure` and `SubSection` patterns.
2. Add a small feature component under `frontend/src/features/` that fetches and renders the inventory; do not duplicate disk or lifecycle calculation in the browser.
3. Show a total storage summary and category rows for Minima history, workflow inbox, workflow diagnostics, device diagnostics, Integritas evidence, associated files, and operational storage.
4. Use clear lifecycle copy: for example, "Kept until manually removed", "Deleted items are being purged", and "Not included in history export". Do not render disabled cleanup/export controls until those actions exist.
5. Link each applicable row to its current history workspace: Wallet history, Automation inbox, or Diagnostics. Do not relocate or duplicate the existing record tables in this milestone.
6. Add loading, failed-load, empty, and unavailable-size states using existing shared UI patterns.
7. Add component/API tests covering totals, missing directories, and lifecycle labels.

### First-Milestone Acceptance Criteria

- An authenticated operator can see the total managed application storage and a breakdown by stored-history category.
- The overview includes the three requested areas: Minima history, workflow inbox, and diagnostics for Integritas, devices, and workflows.
- The overview accounts for managed files that are outside SQLite, especially camera captures and verification reports.
- The overview performs no cleanup, export, import, schema mutation, or retention-policy change.

## Milestone 2: Versioned History Archive Export

1. Define a versioned history document with archive version, creation timestamp, selected categories, and counts. Start with a direct JSON download; add ZIP packaging only when optional binary attachments are introduced.
2. Export self-contained historical snapshots rather than the raw database. Preserve original record IDs as source metadata, not as IDs to insert into live records later.
3. Export workflow runs together with their block runs; export proofs with their linked read snapshots when selected; offer captures and verification PDFs as explicit opt-in attachments because they can be large.
4. Include Minima transaction/send snapshots with wallet fingerprint and addresses, but never wallet seed material or Minima backup data.
5. Exclude address-book contacts, saved devices, workflow definitions, users, sessions, settings, secrets, Docker logs, and audit events.
6. Stream the JSON response without writing a transient archive to the Pi. Add a documented size limit or pre-generation estimate before introducing attachment packaging.
7. Require a final archive contract review before implementation. Record any lasting format, retention, or evidence-policy decision in an ADR if it is not already covered by ADRs 0023/0026/0033.

## Milestone 3: Read-Only Archived-History Import

1. Validate archive schema version, manifest checksums, declared attachment paths, total archive size, and JSON shapes before importing anything.
2. Store imported records in a distinct archive store/model, not the live `automation_runs`, `data_source_reads`, proof, or wallet tables. Direct insertion risks ID collisions and false links to current workflows/devices.
3. Present imported records as immutable archived history. They may be viewed and searched, but cannot be replayed, used as current wallet state, or used to reconstruct devices/workflows.
4. Retain snapshot labels and relationships within the archive. An archive must remain readable without its original address-book contacts, devices, or workflow definitions.
5. Make attachment import explicit and safely confined to the managed archive directory. Do not restore captures to active camera paths or generated proof exports to the normal downloads directory.
6. Define an operator-visible way to remove an imported archive and all of its attachments as one unit.

## Milestone 4: Manual Cleanup

1. Add category-scoped cleanup previews: matching count, associated-file impact, protected linked records, and the distinction between logical records and physical disk reclaim.
2. Support one, selected, and all-matching deletion only where the record category semantics allow it.
3. Keep workflow run/block-run deletion atomic; never leave block runs without their parent run.
4. Preserve the current wallet-history restriction: only previous-wallet records can be cleared, and the action remains admin-only with current-credential re-auth.
5. Preserve proof/evidence safety: deleting proof rows must explicitly explain whether linked reads, verification reports, and exported files are retained, removed, or require a separate action.
6. Use explicit destructive confirmations for every bulk action. Require re-auth for wallet/financial history and assess whether archive deletion or other high-impact actions warrant it after the UX/security review.
7. Offer archive export before destructive cleanup for eligible categories, but do not silently create a backup or make cleanup contingent on an unverified export.
8. Add an audit event for each cleanup action without recording record payloads or sensitive paths.

## Milestone 5: Automatic Retention And Storage Budgets

1. Replace the current preserve-only entries in `backend/src/features/retention/retention.policy.ts` only after the category-specific policy and operator controls are approved.
2. Support age, count, and allocated-size triggers per eligible category. Do not apply one global policy across diagnostics, user content, evidence, and financial history.
3. Protect current-wallet history, visible inbox items, Integritas proofs, audit events, and proof-linked reads from automatic deletion unless a later approved policy specifically changes that classification.
4. Delete workflow run/block-run relationships as a unit and define any future bounds per workflow rather than a global oldest-first cap that empties low-frequency workflow history.
5. Run cleanup in bounded batches through the existing retention scheduler (`backend/src/features/retention/retention.service.ts`), retain active-run protection, and surface last-run outcome/space impact to operators.
6. Define a safe SQLite compaction/VACUUM strategy separately before claiming that automatic cleanup guarantees immediate host-disk recovery.
7. Add disk-pressure warnings before automatic deletion is considered; ensure an operator can export or manually review affected records.

## Security And Data Boundaries

- Keep the existing credential-redaction boundary in `backend/src/shared/redact.ts`; archives and storage endpoints must never contain API keys, webhook tokens, MQTT credentials, sessions, password hashes, TOTP secrets, or wallet seed material.
- Treat imported archives as untrusted input. Validate paths, archive limits, MIME/content metadata, and JSON before filesystem writes or database inserts.
- Keep all archive paths under an application-managed directory beneath `DATA_DIR`; do not expose arbitrary host paths or filesystem browsing.
- Do not use the Minima backup/restore mechanism for history export/import. Node backups contain key material and belong to the separate Minima backup workflow.

## Docs

On implementation, update:

- `README.md` with the operator workflow for inspecting storage, exporting history, importing archives, and any archive/size limits.
- `SECURITY.md` and relevant `docs/security/` material for archive sensitivity, import validation, and cleanup/retention tradeoffs.
- `CHANGELOG.md` with operator-facing storage/history capabilities.
- `docs/TASKS.md` and `docs/SESSION.md` as milestones complete.
- An ADR if final archive format, evidence deletion, automatic-retention defaults, or SQLite compaction has non-obvious durable rationale beyond the existing ADRs.

## Verification

Automated checks for each implemented milestone:

```bash
npm run lint
npm run check
npm --prefix backend run build
npm --prefix frontend run build
```

Monitor-only browser checks:

- Empty installation with no history records or optional directories.
- Representative history in every listed category.
- Missing camera/report/export directories and filesystem-size failures.
- Large JSON read and workflow-run fixtures without a stalled Settings page.
- Links from the overview to Wallet, Automation Inbox, and Diagnostics.
- Confirm the overview makes no mutations and never exposes internal filesystem paths.

Archive/import checks, before those milestones are marked complete:

- Export selected categories with and without optional attachments.
- Verify a round trip into an isolated archived-history store without creating devices, workflows, contacts, or wallet state.
- Reject malformed, oversized, checksum-invalid, traversal-path, and secret-bearing archive fixtures.
- Confirm cleanup previews, protected proof-linked records, re-auth, and deleted-record/file behavior.
- Run a Raspberry Pi disk-space and performance check with representative camera captures and large read payloads.

## Open Decisions

- Should the monitor-only screen include a host-wide free-space warning, or only Edge Studio-managed storage until a host-capacity policy is defined?
- What archive-size cap and attachment-selection UX are appropriate for the target Raspberry Pi storage profiles?
- Should an archive use one SQLite read-only bundle internally or JSON files inside ZIP? JSON is preferred initially because it is simple to validate and version, not because outside-app readability is required.
- Which operator actions, beyond previous-wallet history cleanup, require current-credential re-auth rather than a destructive confirmation?
- Should verification PDFs be treated as proof attachments in archives, or as independently managed generated reports?
