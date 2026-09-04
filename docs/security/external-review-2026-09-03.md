# Security Review: integritas-pi

## Scope

Static current-state security review of the full repository, prioritizing gaps that block a managed single-admin LAN appliance from an acceptable production posture.

- Scan mode: repository
- Target kind: git_revision
- Target ID: target_sha256_46924ba1a5192ed7373121af6e826a1965aa19920c486d2e51e402d49b388766
- Revision: 571ba70cb8de19c40d86e465d82a20b36ca86828
- Inventory strategy: repository
- Included paths: .
- Excluded paths: none
- Runtime or test status: Static review only; source was not modified.
- Artifacts reviewed: Backend, frontend, update-agent, helper, installer, release, Docker/nginx/MQTT configuration, tests and security documentation relevant to identified controls.
- Scan context: The stated product model is a trusted-LAN prototype. Severity assumes a managed single-admin LAN appliance behind nginx HTTPS; public-internet or multi-tenant exposure would materially increase risk.

Limitations and exclusions:
- No live device or network penetration test.
- No online dependency/CVE advisory resolution.
- No access to GitHub protection settings, registries, Minima internals, Integritas internals, or deployed firewall/filesystem state.
- Excluded .git/\*\*: Git history excluded from current-state source review.
- Excluded external runtime: Live host/network configuration, CI protections, registries, dependency advisories, and third-party service internals were unavailable.
- Excluded external runtime: Live host/network configuration, CI protections, registries, and third-party service internals were unavailable.
- Excluded external runtime: Live host, network, registry, CI, and third-party service internals were unavailable.

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 14 |
| Severity mix | high: 2, medium: 11, low: 1 |
| Confidence mix | high: 13, medium: 1 |
| Coverage | partial |
| Validation mode | Independent source-to-sink and control review with worker candidates revalidated against current source and counterevidence. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

A LAN-facing nginx proxy fronts an Express backend and an internal update agent. The backend stores application and secret state in SQLite, controls Minima wallet operations and automation, and may reach Docker, GPIO, camera, sensor, HTTP, and MQTT capabilities. Installation and update trust are critical because installation runs as root and services possess high-impact host and wallet authority.

### Assets

- Administrator credentials and sessions
- APP_SECRET and encrypted service credentials
- Minima wallet keys, funds, and backups
- SQLite workflow, proof, webhook, and audit state
- Docker socket and physical-device capabilities
- Installer, signing key, manifest, and container-image integrity

### Trust Boundaries

- LAN clients to public setup, login, and capability-token webhook routes
- Authenticated browser to privileged backend and update operations
- Webhook or MQTT publishers to preconfigured automation and wallet/device actions
- Backend and update agent to Docker, Minima, host files, and physical helpers
- Root installer and update agent to external release distribution

### Attacker Capabilities

- Unauthenticated LAN access to nginx
- First access to an uninitialized device
- Possession of a leaked webhook capability
- Anonymous MQTT publication when the optional broker is enabled
- Control of an administrator-configured remote HTTP endpoint
- Compromise of mutable script, bundle, or container distribution

### Security Objectives

- Authorize sole-admin bootstrap with device-local proof
- Revoke superseded sessions and protect secrets from responses/logs
- Authenticate event publishers and bound external actions and resource consumption
- Keep wallet, Docker, and device operations narrowly authorized
- Authenticate every root-executed artifact and pin every privileged image

### Assumptions

- Production target is a managed single-admin LAN appliance, not public internet or multi-tenant.
- Self-signed TLS encrypts traffic but does not independently prove device identity.
- TOTP is disabled in effective source despite documentation describing it.
- External infrastructure and third-party implementations remain unverified.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Unsigned runtime bundle supplies its own verifier and trust key](#finding-1) | high | high | inline below |
| [Unauthenticated first client can claim sole administrator authority](#finding-2) | high | high | inline below |
| [Outbound HTTP reads buffer unbounded responses and one path has no deadline](#finding-3) | medium | high | inline below |
| [Documented installer streams mutable remote code into a root shell](#finding-4) | medium | high | inline below |
| [Optional LAN MQTT broker permits anonymous publishing without topic ACLs](#finding-5) | medium | high | inline below |
| [Minima and MQTT workloads use mutable image tags outside the signed manifest](#finding-6) | medium | high | inline below |
| [Backup creation response exposes the stored Minima backup password](#finding-7) | medium | high | inline below |
| [External events can repeatedly execute wallet and device actions without mandatory budgets](#finding-8) | medium | high | inline below |
| [Credential changes do not revoke existing administrator sessions](#finding-9) | medium | high | inline below |
| [Default-enabled Minima console verbs include mutating subcommands](#finding-10) | medium | medium | inline below |
| [Untrusted events can grow persistent automation data without retention limits](#finding-11) | medium | high | inline below |
| [Supported Compose paths silently accept a public encryption secret](#finding-12) | medium | high | inline below |
| [Multipart upload endpoints lack limits and can leave temporary files](#finding-13) | medium | high | inline below |
| [Webhook bearer tokens are written to routine request logs](#finding-14) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Unsigned runtime bundle supplies its own verifier and trust key

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | The download, extraction, bundle contents, and later use of the bundle-provided verifier and key are explicit in source. |
| Category | software-supply-chain-integrity |
| CWE | CWE-494 |
| Affected lines | install.sh:455, install.sh:465, scripts/release/runtime-bundle-files.json:8, install.sh:512, install.sh:535 |

#### Summary

The privileged installer extracts an unauthenticated runtime archive before using a verifier and public key taken from that same archive, so artifact substitution bypasses the signed-manifest design.

#### Root Cause

The release trust anchor and verification code are delivered inside the unauthenticated artifact they are expected to authenticate.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- No bundle signature or pinned digest is checked before extraction.
- The bundle contains verify-manifest.mjs, the public key, Compose, helper code, and CLI content.

Counterevidence and remaining uncertainty:
- Transport uses HTTPS.
- The subsequent image manifest is signed and application images are digest-pinned.

#### Dataflow

Artifact distributor -\> substituted runtime tarball -\> root installer extracts and installs it -\> attacker-provided verifier/key approves attacker images or bundle executables.

#### Reachability

Reachable when an attacker can replace the runtime bundle or its distribution metadata; possession of the legitimate manifest signing key is unnecessary.

Preconditions:
- Victim runs the supported installer as root.
- Attacker can substitute release artifacts.

Existing controls:
- HTTPS transport
- Signed image manifest after bundle installation

#### Severity

**High** — A distribution-path attacker can obtain deterministic root-level compromise of the appliance and wallet workloads without the legitimate signing key.

Lower if the bundle is independently authenticated before extraction; raise to critical if active artifact substitution or a compromised distribution channel is confirmed.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** medium

#### Remediation

Sign the runtime bundle and verify it before extraction with a public key embedded in an independently authenticated, versioned installer. Validate archive paths and install with least privilege.

Tests:
- A modified bundle fails before extraction or execution.
- Replacing both bundle verifier and embedded key does not bypass verification.

Preventive controls:
- Immutable release identifiers
- Offline-protected signing key
- Artifact transparency and digest publication

<a id="finding-2"></a>

### [2] Unauthenticated first client can claim sole administrator authority

| Field | Value |
| --- | --- |
| Severity | high |
| Confidence | high |
| Confidence rationale | The route is public, the only admission condition is zero users, and successful setup creates both the admin and a session. |
| Category | bootstrap-authentication |
| CWE | CWE-306 |
| Affected lines | backend/src/app.ts:34, backend/src/features/auth/setup.routes.ts:49, backend/src/features/auth/setup.service.ts:95, backend/src/features/auth/setup.service.ts:121 |

#### Summary

Before a user exists, any network client reaching the public setup endpoint can choose the administrator password and immediately receive an admin session.

#### Root Cause

Initial administrator enrollment has no authorization factor distinct from attacker-chosen credentials.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Setup routes are mounted before requireAuth.
- The transaction prevents duplicate admins but not an unauthorized first admin.
- TOTP is compile-time disabled.

Counterevidence and remaining uncertainty:
- Five attempts per 15 minutes are rate-limited.
- The window closes once a user exists.

#### Dataflow

LAN client -\> POST /api/setup/complete with chosen password -\> countUsers is zero -\> admin row and authenticated session are created.

#### Reachability

Directly reachable on any uninitialized appliance through nginx.

Preconditions:
- Device setup is incomplete.
- Attacker can reach the appliance LAN service.

Existing controls:
- Setup rate limit
- Transactional single-user creation

#### Severity

**High** — Every fresh appliance has a remotely reachable claim window on its LAN, and successful exploitation grants sole-admin authority over wallet, updates, Docker-backed operations, and devices.

Lower only if deployment enforces an isolated provisioning network or physical-presence control; raise if uninitialized devices are exposed beyond a tightly controlled LAN.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** medium

#### Remediation

Require a high-entropy single-use bootstrap secret generated and displayed locally, or a physical-presence action, for all setup mutations. Consume it atomically with admin creation.

Tests:
- Setup completion without the bootstrap proof is rejected.
- A valid proof can be used only once.
- Concurrent setup requests create at most one authorized admin.

Preventive controls:
- Isolated provisioning network
- First-boot claim audit and alert

<a id="finding-3"></a>

### [3] Outbound HTTP reads buffer unbounded responses and one path has no deadline

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | All fetch consumers and full-response buffering calls were directly reviewed. |
| Category | network-resource-consumption |
| CWE | CWE-400 |
| Affected lines | backend/src/features/data-sources/dataSources.service.ts:248, backend/src/features/data-sources/dataSources.service.ts:257, backend/src/shared/http.ts:16, backend/src/shared/http.ts:17, backend/src/features/data-sources/dataSources.service.ts:310 |

#### Summary

HTTP JSON source reads have neither a timeout nor byte limit, while timed health and output calls still buffer entire responses without size enforcement.

#### Root Cause

Outbound request controls bound elapsed time inconsistently and never bound response bytes.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- readJsonApiSource uses direct fetch and response.text().
- fetchJsonWithTimeout limits time but still uses response.text().
- Multipart output uses response.json() without a byte limit.

Counterevidence and remaining uncertainty:
- Health and normal output calls default to five-second timeouts.
- Only administrators configure endpoints.

#### Dataflow

Configured remote service -\> delayed or oversized response -\> backend fetch consumer -\> unbounded buffering/parsing -\> hung workflow or heap exhaustion.

#### Reachability

Reachable when an attacker controls a configured source, health, or output endpoint.

Preconditions:
- Admin configured the endpoint.
- Endpoint later behaves maliciously or is compromised.

Existing controls:
- Some paths have timeouts
- Per-workflow running guard

#### Severity

**Medium** — A malicious configured endpoint can hang workflows or exhaust backend heap, but endpoint configuration requires administrator action or later compromise of that endpoint.

Raise if less-trusted users can configure URLs or many workflows can target attacker endpoints; lower after global concurrency, deadlines, and streamed byte caps.

Impact assessment:
- **Level:** medium

Likelihood assessment:
- **Level:** medium

#### Remediation

Apply deadlines to every outbound request, stream responses through strict byte counters, reject oversized Content-Length values, cancel on overflow, and enforce global outbound-request concurrency.

Tests:
- Slow responses are aborted.
- Responses above the byte cap are cancelled before full buffering.
- Parallel malicious endpoints cannot exceed the global concurrency budget.

Preventive controls:
- Egress allowlists where appropriate
- Endpoint health circuit breakers

<a id="finding-4"></a>

### [4] Documented installer streams mutable remote code into a root shell

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The README command and installer root requirement are explicit. |
| Category | software-supply-chain-integrity |
| CWE | CWE-494 |
| Affected lines | README.md:23, README.md:530, install.sh:917 |

#### Summary

Installation and upgrade instructions pipe the mutable main-branch install script directly to sudo bash without a pinned version or independent signature.

#### Root Cause

The bootstrap distribution channel is treated as its own trust anchor.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- The command has no detached signature, expected hash, or immutable commit/release identifier.

Counterevidence and remaining uncertainty:
- GitHub transport is HTTPS.
- Later image manifests use signatures.

#### Dataflow

Remote script source -\> streamed bytes -\> sudo bash -\> package, systemd, Docker, and filesystem changes.

#### Reachability

Reachable only if the mutable installer source or delivery channel is modified.

Preconditions:
- Victim follows documented installation or upgrade command.

Existing controls:
- HTTPS to GitHub

#### Severity

**Medium** — Successful substitution yields immediate host root compromise, but exploitation requires compromise of the repository/account or distribution path.

Raise if the installer is distributed through additional mutable mirrors or publisher controls are weak; lower after a versioned signed installer workflow is mandatory.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** low

#### Remediation

Publish versioned installer artifacts with detached signatures and document download, offline verification against a separately distributed pinned key, then execution. Avoid piping network content directly to a root shell.

Tests:
- Tampered installer content fails verification.
- Installation documentation uses an immutable release artifact.

Preventive controls:
- Protected release environments
- Signed releases
- Two-person approval for bootstrap changes

<a id="finding-5"></a>

### [5] Optional LAN MQTT broker permits anonymous publishing without topic ACLs

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Broker configuration and the subscriber-to-workflow path are explicit. |
| Category | message-broker-authentication |
| CWE | CWE-306 |
| Affected lines | docker/mosquitto/mosquitto.conf:1, docker-compose.yml:101, backend/src/features/data-sources/mqttIngestion.service.ts:61, backend/src/features/data-sources/mqttIngestion.service.ts:100 |

#### Summary

When enabled, the bundled broker listens on all interfaces, allows anonymous clients, and feeds accepted JSON on configured topics into privileged automation.

#### Root Cause

The optional event broker has no publisher identity or authorization model.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Port 1883 is published without loopback restriction.
- MqttConfig has no credentials or certificate settings.
- Valid JSON messages trigger workflow execution.

Counterevidence and remaining uncertainty:
- The profile is disabled by default.
- An administrator must enable and configure a workflow.

#### Dataflow

LAN publisher -\> anonymous MQTT connection -\> configured topic -\> JSON event -\> enabled workflow actions.

#### Reachability

Direct when the optional broker and an MQTT workflow are enabled.

Preconditions:
- MQTT profile enabled.
- Attacker can reach host port 1883.
- A matching workflow is enabled.

Existing controls:
- Profile opt-in
- Per-workflow running guard

#### Severity

**Medium** — A LAN attacker can spoof device events and reach configured wallet, GPIO, camera, or network actions, but the broker and target workflow must both be enabled.

Raise if MQTT is enabled by default or exposed outside an isolated LAN; lower after authenticated per-device ACLs and TLS are mandatory.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** medium

#### Remediation

Require authenticated clients, per-device credentials or certificates, TLS, and publish-only topic ACLs. Bind and firewall the broker to its intended interface; add message-level replay protection for high-impact actions.

Tests:
- Anonymous connections fail.
- A device cannot publish outside its allowed topic.
- High-impact events with stale/replayed authenticators are rejected.

Preventive controls:
- Network segmentation
- Broker connection and publish audit

<a id="finding-6"></a>

### [6] Minima and MQTT workloads use mutable image tags outside the signed manifest

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Image references and manifest service allowlist were directly reviewed. |
| Category | untrusted-dependency-image |
| CWE | CWE-829 |
| Affected lines | docker-compose.yml:79, docker-compose.yml:98, update-agent/src/manifest/manifest.service.ts:13 |

#### Summary

Compose uses an implicit latest Minima image and a mutable Mosquitto major tag; neither is covered by the signed digest manifest.

#### Root Cause

The signed release inventory does not cover all privileged runtime images.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Minima is untagged and Mosquitto uses :2.
- The release/update manifest covers frontend, backend, and update-agent only.

Counterevidence and remaining uncertainty:
- Application-owned release images use signed digest references.
- MQTT is disabled by default.

#### Dataflow

Upstream registry/publisher compromise -\> mutable tag replaced -\> deployment pulls changed image -\> attacker code receives wallet data or broker event authority.

#### Reachability

Reachable during fresh deployments or later pulls that resolve the mutable tags.

Preconditions:
- Attacker controls an upstream image reference.
- Deployment pulls the tag after replacement.

Existing controls:
- Signed application-image manifest

#### Severity

**Medium** — Registry or publisher compromise can silently replace code holding wallet or event authority on fresh pull, but exploitation requires upstream supply-chain control.

Raise if automatic pulls occur broadly or publisher compromise is observed; lower after immutable digest pinning and signed-manifest coverage.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** low

#### Remediation

Pin every production image by reviewed sha256 digest and include Minima and Mosquitto in the signed release manifest and update policy. Enforce repository allowlists and digest grammar.

Tests:
- Compose contains only digest-pinned production images.
- Manifest verification rejects missing or mutable image references.
- Fresh installation resolves exactly the reviewed digests.

Preventive controls:
- SBOM and image provenance attestations
- Registry namespace monitoring

<a id="finding-7"></a>

### [7] Backup creation response exposes the stored Minima backup password

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The decrypt-to-command-to-response dataflow is explicit in local source. |
| Category | sensitive-data-exposure |
| CWE | CWE-200 |
| Affected lines | backend/src/features/minima/minima-backup.service.ts:137, backend/src/features/minima/minima-backup.service.ts:143, backend/src/features/minima/minima.rpc.ts:23, backend/src/features/minima/minima.routes.ts:233 |

#### Summary

The backup service embeds the decrypted stored password in a Minima command and returns the RPC wrapper result, including command/source metadata, to the authenticated API client.

#### Root Cause

A secret-bearing internal command object is reused as an external API response without redaction.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- getBackupPassword decrypts the stored value.
- runMinimaPathCommand returns command/source metadata.
- POST /backups returns the result directly.

Counterevidence and remaining uncertainty:
- The route requires an authenticated administrator session.
- Backup downloads separately require current-password verification.

#### Dataflow

Stolen admin session -\> POST /api/minima/backups -\> stored password decrypted into command -\> response returns command metadata -\> backup password disclosed.

#### Reachability

Direct for any valid admin session; no fresh credential is required.

Preconditions:
- Attacker holds an admin session.

Existing controls:
- Admin role
- Encrypted-at-rest password

#### Severity

**Medium** — Any stolen admin session can retrieve the reusable backup password without fresh reauthentication, weakening protection of every backup the attacker can later obtain.

Raise if backups are externally accessible or the command is confirmed in production responses; lower if RPC metadata is stripped and backup creation requires fresh reauthentication.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** medium

#### Remediation

Return a purpose-built response containing only status and filename; never return command strings or credentials. Redact secrets at the RPC boundary and require fresh reauthentication for backup creation or secret-adjacent operations.

Tests:
- Backup creation responses contain no password or command string.
- Logs and error payloads redact the password.
- A stale/stolen session without fresh proof cannot create or disclose backup secrets.

Preventive controls:
- Central secret redaction
- Typed response DTOs

<a id="finding-8"></a>

### [8] External events can repeatedly execute wallet and device actions without mandatory budgets

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Event admission, cooldown, workflow execution, and Minima payment paths were traced directly. |
| Category | transaction-and-action-rate-limits |
| CWE | CWE-799 |
| Affected lines | backend/src/features/data-sources/dataSources.routes.ts:20, backend/src/features/automation/automation.service.ts:260, backend/src/features/automation/automation.service.ts:383, backend/src/features/automation/automation.service.ts:1289 |

#### Summary

Webhook and MQTT triggers may execute value-moving or physical actions with a zero default cooldown and no persistent count, spend, or aggregate action limit.

#### Root Cause

High-impact workflow actions inherit optional in-memory event throttling rather than mandatory durable safety budgets.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Cooldown zero is valid and disables enforcement.
- Cooldown state is in memory.
- Payments are submitted per accepted run with only live balance and per-run amount checks.

Counterevidence and remaining uncertainty:
- Admin must configure and enable the workflow.
- A workflow cannot overlap itself.
- Only native MINIMA is supported and each run checks balance.

#### Dataflow

Webhook token holder or MQTT publisher -\> repeated valid events -\> workflow accepted -\> send_transaction/GPIO/network action on each run.

#### Reachability

Reachable for enabled externally triggered workflows; repeated sequential calls bypass the per-workflow concurrency guard.

Preconditions:
- Attacker has event-source capability.
- Admin configured a high-impact workflow.

Existing controls:
- Optional cooldown
- Per-workflow concurrency guard
- Balance check

#### Severity

**Medium** — A leaked webhook capability or unauthorized MQTT publisher can repeatedly drain the configured wallet amount or invoke costly actions, but an administrator must first create and enable the workflow.

Raise if value-moving workflows are commonly enabled on anonymous event sources; lower if wallet/device actions are prohibited or require replay-protected authenticated events.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** medium

#### Remediation

Require durable nonzero cooldowns and replay protection for external sensitive triggers. Add atomic per-workflow and global count/value budgets, global wallet serialization, and explicit high-risk enablement; consider prohibiting wallet actions from unauthenticated sources.

Tests:
- Repeated events cannot exceed configured count or value budgets.
- Restarting the backend does not reset limits.
- Concurrent workflows cannot race global wallet allowances.

Preventive controls:
- Emergency disable switch
- Alerts on external value-moving runs

<a id="finding-9"></a>

### [9] Credential changes do not revoke existing administrator sessions

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Credential update paths and session validation were directly reviewed, and deleteAllUserSessions has no call site. |
| Category | session-invalidation |
| CWE | CWE-613 |
| Affected lines | backend/src/features/auth/auth.service.ts:103, backend/src/features/auth/auth.service.ts:154, backend/src/features/auth/session.service.ts:33, backend/src/features/auth/session.service.ts:69 |

#### Summary

Password and TOTP changes update credentials but leave all previously issued session rows valid, even though a bulk-revocation primitive exists.

#### Root Cause

Sessions are not bound to a credential generation and rotation flows omit revocation.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Session validation checks only stored expiry and idle time.
- Active requests refresh last_seen_at.
- The existing bulk deletion function is not invoked.

Counterevidence and remaining uncertainty:
- Explicit logout deletes the presented session.
- Sessions have absolute and idle expirations.

#### Dataflow

Stolen admin cookie -\> administrator rotates password/TOTP -\> old session row remains -\> attacker continues privileged API use.

#### Reachability

Reachable to a holder of any unexpired stolen session.

Preconditions:
- Attacker has a valid session cookie.

Existing controls:
- Seven-day absolute expiry
- 24-hour idle expiry
- Hashed session storage

#### Severity

**Medium** — A stolen admin session retains full authority for up to seven days despite credential rotation; exploitation first requires session theft.

Raise if evidence shows session theft or wider cookie exposure; lower after credential-version checks or atomic session revocation are deployed.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** medium

#### Remediation

Atomically revoke all user sessions after password or TOTP changes and optionally issue a replacement only to the initiating client, or enforce a credential/session generation counter.

Tests:
- A session issued before password rotation is rejected afterward.
- TOTP rotation also invalidates prior sessions.

Preventive controls:
- Session inventory and remote logout
- Reauthentication for high-risk actions

<a id="finding-10"></a>

### [10] Default-enabled Minima console verbs include mutating subcommands

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | medium |
| Confidence rationale | The local authorization gap is direct, but the exact effect of each downstream Minima subcommand could not be dynamically verified from repository source. |
| Category | command-authorization-granularity |
| CWE | CWE-863 |
| Affected lines | backend/src/features/minima/minima-console.catalog.ts:101, backend/src/features/minima/minima-console.catalog.ts:115, backend/src/features/minima/minima-console.service.ts:73, backend/src/features/minima/minima-console.service.ts:113 |

#### Summary

Authorization checks only the first command verb, while default-enabled verbs such as tokens, cointrack, and maxcontacts include import/export or state-changing forms that are passed unchanged to Minima RPC.

#### Root Cause

A mixed read/write command language is authorized at verb granularity rather than by parsed operation and arguments.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Catalog descriptions explicitly mention import/export, track/untrack, and contact management.
- The complete command is dispatched after only verb authorization.

Counterevidence and remaining uncertainty:
- Route access requires an authenticated administrator.
- Unknown and excluded verbs are rejected.
- Whitelist changes require the current password.

Limitations:
- Minima implementation and authoritative command grammar are external.

#### Dataflow

Stolen admin session -\> console/run with default-enabled mixed verb plus mutating arguments -\> verb allowlist passes -\> raw command reaches Minima RPC.

#### Reachability

Reachable to any authenticated admin session; concrete downstream effects depend on supported Minima subcommands.

Preconditions:
- Attacker has an admin session.
- Minima supports the mutating form described by the catalog.

Existing controls:
- Closed verb catalog
- Reauthentication for whitelist changes

#### Severity

**Medium** — A stolen administrator session can bypass the fresh-credential workflow intended to enable write commands and may change or export Minima state; exact downstream subcommand behavior depends on external Minima semantics.

Raise if tested Minima versions confirm sensitive export or value-affecting forms; lower if the external parser restricts all default-enabled forms to reads.

Impact assessment:
- **Level:** medium

Likelihood assessment:
- **Level:** medium

#### Remediation

Parse and authorize complete command forms. Split read and write operations into explicit catalog entries, default-disable ambiguous verbs, and require fresh credentials for mutation or export.

Tests:
- Mutating forms of default read verbs are rejected.
- Read-only forms remain available.
- Sensitive export and state changes require fresh reauthentication.

Preventive controls:
- Versioned Minima command grammar tests
- Audit normalized operation and arguments without secrets

<a id="finding-11"></a>

### [11] Untrusted events can grow persistent automation data without retention limits

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Persistence call sites and absence of application retention/pruning controls were verified. |
| Category | persistent-resource-consumption |
| CWE | CWE-400 |
| Affected lines | backend/src/features/data-sources/mqttIngestion.service.ts:81, backend/src/features/data-sources/mqttIngestion.service.ts:88, backend/src/features/automation/automation.service.ts:269, backend/src/features/automation/automationRuns.repository.ts:38 |

#### Summary

Valid and invalid MQTT/webhook traffic creates persistent run and data-read records, while MQTT payload size and database retention are not bounded.

#### Root Cause

Event ingestion lacks coordinated packet size, rate, storage quota, and record-retention limits.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- MQTT buffers have no application size check.
- Invalid MQTT also records a failed read.
- No pruning or retention mechanism was found for the affected tables.

Counterevidence and remaining uncertainty:
- Webhook JSON bodies are globally limited to 2 MB.
- MQTT is opt-in.
- The same workflow cannot overlap.

#### Dataflow

Event sender -\> repeated or large payloads -\> parsing/serialization -\> automation and read rows -\> SQLite/storage exhaustion.

#### Reachability

Reachable through a known webhook token or enabled anonymous MQTT broker.

Preconditions:
- An external event source is configured and reachable.

Existing controls:
- 2 MB HTTP JSON limit
- Optional cooldown

#### Severity

**Medium** — A reachable event publisher can exhaust appliance storage and increase CPU/memory pressure; conditions depend on possessing a webhook token or enabling anonymous MQTT.

Raise if broker exposure or small storage makes exhaustion rapid; lower after strict packet, rate, quota, and retention controls.

Impact assessment:
- **Level:** medium

Likelihood assessment:
- **Level:** medium

#### Remediation

Set broker packet and queue quotas, reject oversized MQTT payloads before parsing, rate-limit each source, and implement bounded retention/pruning for automation runs, block runs, inbox items, and data-source reads.

Tests:
- Oversized packets are rejected without persistence.
- Old records are pruned at configured bounds.
- Flood tests do not grow SQLite beyond quota.

Preventive controls:
- Disk-space alerts
- Per-source telemetry and circuit breakers

<a id="finding-12"></a>

### [12] Supported Compose paths silently accept a public encryption secret

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The fallback, warning-only startup, Compose defaults, and key derivation are explicit. |
| Category | hard-coded-cryptographic-key |
| CWE | CWE-798 |
| Affected lines | backend/src/config/env.ts:67, docker-compose.yml:41, backend/src/index.ts:32, backend/src/shared/crypto.ts:18 |

#### Summary

The backend and Compose files fall back to the known value dev-change-me, while startup only warns; stored credentials are encrypted with a key deterministically derived from this value.

#### Root Cause

Secret provisioning is optional and a public development fallback remains active in deployable configurations.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Compose repeats the same fallback.
- Startup warns but continues.
- AES-GCM key material is derived from APP_SECRET.

Counterevidence and remaining uncertainty:
- The root installer generates a random 32-byte hexadecimal secret.
- Operators can explicitly provide a secure value.

#### Dataflow

Deployment omits APP_SECRET -\> known key is used -\> attacker obtains SQLite -\> encrypted stored credentials are decrypted offline.

#### Reachability

Reachable only in deployments that bypass or override the secure installer secret generation and later disclose the database.

Preconditions:
- APP_SECRET omitted.
- Attacker obtains the database.

Existing controls:
- Installer-generated random secret
- AES-GCM at rest

#### Severity

**Medium** — In affected deployments, SQLite disclosure also discloses Integritas credentials and the Minima backup password; the primary installer generates a strong secret, reducing default exposure.

Raise if direct/generated Compose is used in production without secret injection; lower after all supported production starts fail closed on weak or missing secrets.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** medium

#### Remediation

Remove public fallbacks from production Compose paths and fail startup when APP_SECRET is absent, known, or weak. Generate it in every supported flow and document secure rotation with re-encryption.

Tests:
- Production startup fails with missing or dev-change-me secret.
- Every supported deployment generator supplies a strong unique secret.
- Rotation preserves data after re-encryption.

Preventive controls:
- Secret strength health check
- Deployment conformance test

<a id="finding-13"></a>

### [13] Multipart upload endpoints lack limits and can leave temporary files

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Upload middleware ordering, missing limits, full-file reads, and early returns were directly reviewed. |
| Category | upload-resource-consumption |
| CWE | CWE-770 |
| Affected lines | backend/src/features/integritas/upload.middleware.ts:9, backend/src/features/integritas/integritas.routes.ts:124, backend/src/features/integritas/integritas.routes.ts:125, backend/src/features/integritas/integritas.routes.ts:228, backend/src/features/minima/minima.routes.ts:254 |

#### Summary

Multer accepts files without configured size/count limits, and some routes perform authorization or API-key checks after disk upload, allowing large temporary files and early-return leaks.

#### Root Cause

Resource authorization and cleanup occur after unbounded multipart parsing, with cleanup not guaranteed on all early returns.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Multer configurations have no limits.
- Integritas file routes upload before checking the API key.
- The proof file is fully read into memory.
- Minima restore uploads before current-password verification.

Counterevidence and remaining uncertainty:
- Global session authentication precedes feature routers.
- Some success/error paths use finally cleanup.

#### Dataflow

Authenticated client -\> oversized multipart body -\> multer writes /tmp -\> route performs later checks or full-file read -\> disk or heap exhaustion; early return can leave the file.

#### Reachability

Reachable to an authenticated session; Minima restore additionally requires admin role before multer but verifies current password afterward.

Preconditions:
- Attacker has a valid session.

Existing controls:
- Global authentication
- Some route cleanup

#### Severity

**Medium** — A valid session can consume temporary disk and memory, potentially denying service on a constrained appliance; exploitation requires authentication and some paths require admin.

Raise if the backend is directly exposed or /tmp is especially constrained; lower after strict streaming limits and guaranteed cleanup.

Impact assessment:
- **Level:** medium

Likelihood assessment:
- **Level:** high

#### Remediation

Configure strict file, field, and count limits; authorize and reauthenticate before parsing where possible; stream-process files; and install centralized cleanup for success, error, abort, and early-return paths.

Tests:
- Oversized uploads fail before exhausting disk.
- Files are removed after missing-key, invalid-password, abort, and parse-error cases.
- Concurrent upload limits are enforced.

Preventive controls:
- Dedicated quota-limited upload directory
- Disk and request-rate monitoring

<a id="finding-14"></a>

### [14] Webhook bearer tokens are written to routine request logs

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Token generation, path authorization, and logging of originalUrl are direct. |
| Category | sensitive-data-in-logs |
| CWE | CWE-532 |
| Affected lines | backend/src/features/data-sources/dataSources.service.ts:125, backend/src/features/data-sources/dataSources.routes.ts:20, backend/src/middleware/requestLogger.ts:3 |

#### Summary

A long-lived webhook authorization token is placed in the URL path, and the global request logger records the complete original URL.

#### Root Cause

A bearer capability is encoded in a logged URL, with no route-aware redaction.

#### Validation

Validation outcomes are recorded below.

Validation method: Independent static source-to-sink review of current repository state.

- **Status:** validated
- **Disposition:** reportable

Evidence:
- Webhook authorization uses the path token.
- The logger runs globally before route handling and records originalUrl.

Counterevidence and remaining uncertainty:
- Tokens are random UUIDs.
- Supported traffic is HTTPS.
- Bodies are not logged.

#### Dataflow

Log reader -\> extracts webhook URL token -\> replays request -\> matching enabled workflow executes.

#### Reachability

Reachable to anyone who can read backend request logs or downstream log exports.

Preconditions:
- A webhook has been invoked and logged.
- Attacker can read logs.

Existing controls:
- Random token
- HTTPS

#### Severity

**Low** — A log reader can replay the token to inject workflow events, but log access is typically more constrained and high-impact effects depend on workflow configuration.

Raise if logs are exported to broader audiences or sensitive workflows use affected tokens; lower after redaction and token rotation.

Impact assessment:
- **Level:** high

Likelihood assessment:
- **Level:** low

#### Remediation

Redact the webhook path segment before logging and rotate existing tokens. Prefer an Authorization header or timestamped HMAC signature with replay protection.

Tests:
- Request logs never contain webhook tokens.
- Previously logged tokens are revoked.
- Replay outside the allowed timestamp window fails.

Preventive controls:
- Structured allowlist logging
- Secret scanning for log pipelines

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Authentication, bootstrap, sessions, and authorization | not recorded | Reported | No additional canonical notes were recorded. |
| Secret storage, disclosure, and logging | not recorded | Reported | No additional canonical notes were recorded. |
| Webhook, MQTT, automation, wallet, and device actions | not recorded | Reported | No additional canonical notes were recorded. |
| Upload, network, storage, and concurrency resource bounds | not recorded | Reported | No additional canonical notes were recorded. |
| Installer, release signing, update agent, and container images | not recorded | Reported | No additional canonical notes were recorded. |
| Host-file and backup path containment | not recorded | No issue found | No additional canonical notes were recorded. |
| SQL construction and database access | not recorded | No issue found | No additional canonical notes were recorded. |
| Cookie attributes and CSRF posture in supported deployment | not recorded | No issue found | No additional canonical notes were recorded. |
| External Minima command parser semantics | not recorded | Needs follow-up | No additional canonical notes were recorded. |
| Timed HTTP response-size candidate | not recorded | Rejected | Merged into cand_http_input_bounds because both instances share the same missing response byte-limit control and remediation. |
| Timed HTTP response candidate merged into the shared outbound byte-bound root control | not recorded | Rejected | Not separately reported because it shares a root control and remediation with the outbound HTTP resource finding. |
| Worker candidate inventory checkpoint | not recorded | No issue found | All checkpointed candidates were independently validated, merged, or rejected. |
| Architecture, trust boundaries, and effective deployment configuration | not recorded | No issue found | No additional canonical notes were recorded. |

## Open Questions And Follow Up

- Minima RPC separator and subcommand semantics require validation against the deployed Minima version.
- External GitHub branch protection, release environment controls, and registry retention/attestation policy remain unverified.
- A live appliance penetration test and dependency advisory scan remain necessary before production approval.
- Requires a live deployment, online dependency advisory sources, external platform policy, and third-party implementations not present in this repository.
  - Follow-up prompt: Review deferred unit dynamic_dependency_and_host_validation and close its stated proof gap. Surfaces: supply_chain, availability, minima_rpc.
- Awaiting parent validation
  - Follow-up prompt: Review deferred unit cand_http_response_bounds and close its stated proof gap. Paths: backend/src/shared/http.ts, backend/src/features/data-sources/dataSources.service.ts. Surfaces: availability.
