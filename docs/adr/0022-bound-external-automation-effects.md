# 0022: Bound External Automation Effects — Redaction, Retention, and Run Budgets

**Status:** Accepted
**Date:** 2026-09-17

## Context

Webhook and MQTT ingestion cross an untrusted boundary into data-source recording and automation
execution. A token holder or publisher can continuously create workflow runs, block runs, inbox
items, and data-source reads, while Docker's default `json-file` logging is unbounded. On a Pi,
either can fill the SD card.

The webhook bearer token is a URL path segment, so `requestLogger`, nginx's request line, and
`data_source_reads.source_url` all retained it. MQTT had the same problem with broker URL userinfo.

Event cooldown doesn't bound privileged effects: transaction workflows accepted a zero cooldown,
cooldown state is process-local, and HTTP rate limits can't see MQTT or GPIO.

Verified during implementation: `better-sqlite3` is built with `SQLITE_DEFAULT_FOREIGN_KEYS=1`, so
declared cascades are enforced on the shared connection. Workflow validation is advisory on
create/update/enable; only manual run refuses on errors. nginx error-log lines include the raw
request line and their format can't be configured.

The stored tables are not one kind of data. Runs and block runs drive Watch mode history; inbox
items are user-visible output; data-source reads are product data and may be linked to proofs;
Integritas history is evidence. A security limit should not decide their product meaning.

## Decision

**Credentials and logs**

- Push-source reads store `data-source:<id>` as `source_url`, never a webhook or broker URL;
  historical rows are scrubbed without logging old values. Credential-bearing MQTT URLs stay valid
  as live configuration.
- Backend request logging and nginx access logging redact the webhook token independently. nginx
  matches its normalised `$uri` case-insensitively for masking and routing, omits query strings and
  trailing segments, and logs the webhook location's errors at `crit` only.
- Every long-running Compose service uses `json-file` with `max-size: "10m"`, `max-file: "3"`, and
  `update-agent`'s `createBodyFromInspect()` applies the same fixed policy when it recreates a
  container, including legacy ones. Existing installs need one installer rerun to recreate the
  services image-only updates don't touch.

**Run budget and cooldown**

- Every workflow has a fixed budget of **1,000 privileged runs per rolling hour**, reserved before
  the first enabled `send_transaction`, `control_output`, `capture_camera`, or `stamp_integritas`
  block, for every trigger type. Stamping is included because automation stamps bypass the HTTP
  stamp limiter and spend external quota.
- Reservations are timestamped rows in a SQLite ledger, unique per run, reserved and counted
  atomically. A run consumes once however many privileged blocks it has, and a failed action still
  consumes, since its effect may have happened. Workflow deletion deletes its ledger rows
  explicitly as well as by cascade.
- Event-started workflows with an enabled `send_transaction` block need a finite integer cooldown
  of at least 1 second, enforced in draft validation and in `executeWorkflow()`
  (`WORKFLOW_TRANSACTION_COOLDOWN_REQUIRED`), so pre-existing workflows are covered too.
- Separate one-minute limiters: 60 webhook requests per client and source, 30 automation
  mutation/manual-run requests per client, 10 stamp creations per client. Not applied to reads,
  status polling, or draft validation.
- Expensive proof file operations, history archive imports/exports, and Minima backup
  downloads/restores share a separate 30-request/minute budget per client across those routes.
  Unlike list/status reads, file downloads perform disk and export work. The shared ceiling bounds
  client traffic across features without interfering with ordinary polling. It is an interim
  conservative limit, not a measured Pi capacity.
- Archive export and backup download/restore also use the existing five-failures/15-minute
  authentication limiter shared by credential-confirmation routes. Traffic limiting runs first,
  then credential limiting, then multipart upload parsing, so rejected clients cannot spend disk
  or password-hashing work. Successful credential requests do not consume the failure budget.
- Budget and limits are named backend constants; no API, UI, or env configuration. The budget
  limits repetition only; destinations and amounts remain trusted workflow configuration.

**Retention by record purpose**

| Record | Policy |
| --- | --- |
| Workflow runs, block runs | Preserved by default; opt-in newest N per existing workflow, with blocks removed atomically with their parent |
| Runs of deleted workflows | Opt-in expiry measured from the run's start time, not the workflow deletion time |
| Visible inbox items | Keep until manually deleted by default; independent opt-in age expiry for read and unread items, with active-run protection |
| Deleted inbox items | Purged by the retention sweep |
| Data-source reads | Opt-in age expiry; a non-null Integritas proof link always protects the read |
| Integritas history | Kept until explicit user deletion; outside the scheduler |
| Camera files | Separate confirmed age policy; paused while camera support is disabled; proof-linked files always protected |

- The sweep runs after startup migrations and hourly, yielding between batches until drained, never overlapping, cancelled on shutdown. Each batch handles at most 500 parent runs (plus their dependent block rows), 500 unlinked reads, and 500 inbox items total. User-deleted inbox items take priority; age expiry uses the remaining inbox batch capacity. Only this process's active runs are protected; a stale persisted `running` status cannot preserve records forever.
- SQLite stores the operator policy: newest 500 runs per existing workflow (range 50–10,000), 90 days for deleted-workflow runs (7–3,650), 90 days for unlinked reads (7–3,650), and disk warning at 80% (50–95%). Automatic history cleanup defaults off for both new and existing installations; merely updating or opening Settings does not activate deletion. The disk threshold only warns in Storage & history and never triggers extra cleanup. Camera file retention remains separate.
- Admins preview the candidate policy and explicitly confirm before saving. A preview fingerprint binds the policy, previous settings and scheduled counts; changed counts or concurrent settings cause HTTP 409 and require a new preview. Saving and its actor/old/new/count audit commit atomically and do not delete records immediately. Counts are estimates for the next sweep, not a frozen record set; an accepted policy continues to apply as records age.
- Preview and deletion share eligibility queries, including deterministic timestamp/ID ordering and active-run exclusion. Run/block deletion is transactional. The security budget ledger is independent of run history and is never removed by retention. Inbox items may lose the parent-run link when history expires; this alone does not remove their content.
- Inbox age expiry is separate from the run/read cleanup switch. `inboxRetentionDays: null` means keep until manually deleted; a configured 7–3,650 days expires both read and unread items based on creation time. The form initially suggests 90 days when the operator turns this policy on. Items linked to active runs are excluded from both preview and expiry. Deleting an inbox row never deletes its linked image/capture/file. Older stored policy documents acquire the safe null default on read, without enabling expiry. Age-based expiry avoids a busy workflow evicting other workflows' inbox output via a global cap.
- Wallet history, proofs, imported archives, audit events, and files are outside this cleanup. SQLite file size is not promised to shrink; no automatic VACUUM or disk-pressure deletion is introduced. The legacy generic pruning helpers remain tested but do not define the configured lifecycle policy.

**Camera extension and media retention**

- A separate SQLite document stores nullable camera age (1–3,650 days) and a paused flag. The legacy environment age seeds it once, initially paused; invalid/non-positive values mean keep. This preserves the old suggested policy without silently activating file deletion during upgrade. Helpers, mounts and enablement remain deployment configuration.
- Disabled camera support pauses file cleanup and preserves media and policy. The app's disable action persists the pause before asking the host agent to disable/restart; even a failed host action leaves cleanup safely paused. A backend started with camera support disabled also persists the pause. Re-enabling support does not clear it: the operator previews and confirms before resuming. Disabled/empty installations have no camera retention controls; remaining files still show storage and saved policy.
- The existing startup/hourly sweep handles at most 500 direct, regular JPEG/H264 files per batch, aged by modification time. It rejects symlinked roots and ignores symlinks, subdirectories and unknown files. Proof-linked read previews identify protected media paths; malformed evidence metadata or incomplete storage inspection stops camera deletion. While any workflow is active, all camera deletion is postponed: captures may still be uploading or awaiting a proof link, so merely checking existing links is insufficient.
- File inspection, proof-link checks and unlinking execute synchronously in one event-loop turn. This prevents this backend's asynchronous workflow from linking evidence between the protection check and deletion. Local processes with filesystem write access remain trusted; this is not a cross-process filesystem lock. An admin preview fingerprints the policy, previous settings, camera enablement and scheduled filenames/sizes/timestamps. Confirmed saves and audits are transactional, do not delete media immediately and reject changed candidate sets.

## Alternatives considered

- **One 30-day / 10,000-row limit for every table** (first version). Treated diagnostics and user
  data alike and would delete existing data on the first sweep.
- **Bound runs and block runs as diagnostics** (second version). The global oldest-first cap let one
  busy workflow evict every other workflow's history, block runs hit their own cap before their
  runs and orphaned them, and rarely run workflows lost all history. The current opt-in per-workflow bound removes block rows together with each run.
- **Apply new numeric defaults immediately on upgrade.** Would silently delete history that older versions explicitly preserved. Operators must enable cleanup after seeing its effect.
- **Keep everything forever with no controls** (interim policy). Preserves evidence, but leaves operators without a way to bound diagnostic history; explicit policy controls now distinguish protected evidence from expiring diagnostics.
- **Comment out deletion, or an env flag for it.** Commented code drifts; a hidden switch allows
  irreversible deletion without a product explanation.
- **Budget of 10 runs per hour** (first version). Not derived from usage; ordinary event-driven
  workflows hit it within an hour. 1,000 is an interim ceiling until usage data supports a measured
  value.
- **Configurable or per-block-type budgets.** Configuration could weaken a security boundary; no
  usage data shows where per-type limits should sit.
- **A counter with `window_started_at`.** A fixed window allows boundary bursts.
- **Cooldown or HTTP rate limiting only.** Process-local, and can't cover MQTT or GPIO.
- **Budget only `send_transaction`.** Outputs, camera, and stamping have physical, privacy, storage,
  or quota effects too.
- **Reject MQTT URLs with credentials.** Authenticated brokers need them.
- **Rely on validation for the cooldown, or make validation block save.** Save/enable don't
  validate; blocking would couple saving to wallet and hardware checks.
- **One large startup deletion transaction.** Holds SQLite write locks on constrained hardware.
- **Protect rows by persisted `running` status.** Crashed runs would be protected forever; only
  this process's active runs are.
- **Preserve inspected logging options on recreation.** Legacy installs would keep unbounded logs.
- **Global cross-workflow budget and wallet serialization; webhook-token rotation.** Deferred.

## Consequences

- A leaked webhook token or hostile MQTT publisher can still cause up to 1,000 payments, outputs,
  captures, or stamps per hour per workflow. Webhook and manual-run limiters allow more than that,
  so the budget is the binding limit.
- Failed runs consume budget, which can briefly block after operational failures.
- Storage still grows without bound while cleanup is off, and protected evidence/files are not bounded by this policy. Disk warnings are informational, not an automatic deletion trigger. Manual category/date cleanup and Dashboard warnings remain follow-ups.
- Pre-fix Docker logs may still contain webhook tokens until they rotate or are removed.
- The webhook nginx location loses non-critical error diagnostics.
- HTTP rate limiting stays process-local; the persisted budget is the durable control.

## History

- 2026-11-03: Replaced capture-time environment pruning with confirmed camera policy, optional-extension pause/resume and proof-media protection (camera portion of #861); generated-download cleanup and Dashboard warnings remain separate.
- 2026-11-03: Added independent opt-in inbox age expiry, preview counts and active-run/file protection; retained keep-until-deleted defaults and the shared inbox batch limit.
- 2026-11-03: Added opt-in SQLite retention settings, reviewed previews, per-workflow/age cleanup, evidence protection and Settings disk warnings (#856/#857 and the automatic-retention part of #819).
- 2026-10-29: Bounded proof/history/backup file operations and added missing credential-confirmation limits after release CodeQL triage.
- 2026-09-23: Retention classified by record purpose; inbox and data-source reads preserved (was
  ADR 0023).
- 2026-09-25: Workflow runs and block runs preserved for Watch mode (was ADR 0026).
- 2026-10-02: Run budget raised from 10 to 1,000 per rolling hour (was ADR 0028).
