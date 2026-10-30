# Module Builder Plan

**Status:** Not started
**Product requirements baseline:** [Module Builder PRD](../../tasks/prd-module-builder.md). Use its consolidated requirements and release gates as the product input to the technical specification; this plan supplies engineering context.
**Created:** 2026-10-20
**Goal:** Make hardware capabilities, device setup, and workflow blocks dynamically installable extensions, prove the lifecycle using the existing capabilities and a locally hosted demo library, then provide in-app extension authoring tools.

**Discussion:** [Alternatives, research precedents, and public-library questions](./module-builder/discussion.md).
**Workshop revision:** [Agreed authoring direction, delivery phases, and remaining decisions](./module-builder/workshop-revision.md).
**OpenProject delivery backlog:** [Phase 1 epic #1081](https://openproject.privateprivate.org/work_packages/1081), [Phase 2 epic #1082](https://openproject.privateprivate.org/work_packages/1082); [feature map and estimates](../reports/module-builder-openproject-2026-10-28/README.md).
**Stakeholder material:** [Presentation source and speaker notes](../reports/module-builder-2026-10-20/stakeholder-brief.md).

## Stakeholder milestones

Delivery is split into two phases, agreed 2026-10-27: **Phase 1 — Local Module Builder** covers M1-M3, including local authoring, editing, testing, packaging, activation, import/export, default-package extraction, and the local demo-library lifecycle proof. **Phase 2 — Web-hosted library and commerce** covers M4: central hosting, discovery, publishing, publisher profiles, ratings, download counts, checkout, contributor payouts/refunds, and offline purchase entitlements. Commerce is required in Phase 2, confirmed 2026-10-28; provider and commercial terms still need specification. Phase 1 does not require the production hosted library; its local demo library is a test fixture. Other workshop scope refinements remain under discussion in the workshop revision.

- **M1 — Lifecycle proof (steps 1-2):** Inventory/contracts plus the HTTP JSON Source and Fetch block uninstall, real library download, install, activation, and restoration test, including retained configuration/history and restart persistence.
- **M2 — Default capability parity (steps 3-6):** Dynamic hardware, device setup, and workflow contributions; all default packages removable/restorable, including real Pi verification.
- **M3 — Authoring proof (step 7):** Create a new block and hardware/device capability with the tools and install them on another instance without core-source edits.
- **M4 — Web-hosted library and commerce (Phase 2):** Central hosting, discovery, self-service publishing, profiles, ratings, download counts, checkout, contributor payouts/refunds, offline purchase entitlements, and separately maintained service operations; commerce is included in the phase's completion criteria.

## Progress

- [ ] 1. Inventory existing capabilities and define package/runtime contracts and parity checks.
- [ ] 2. Build the extension core, local package storage, and demo library with one complete vertical slice.
- [ ] 3. Migrate hardware-agent capabilities to installable packages with full host access.
- [ ] 4. Migrate device templates, setup flows, configuration, and guides to dynamic contributions.
- [ ] 5. Migrate workflow block definitions, configuration, validation, and execution to dynamic contributions.
- [ ] 6. Complete default-package extraction and verify removal, download, activation, and restoration.
- [ ] 7. Build authoring tools and use them to create and test new capabilities.
- [ ] Docs.
- [ ] Verification.

## Context

The user approved the extension-platform direction and specified full host access, including privileged hardware-agent extensions. Existing hard-coded capabilities should become default extensions that can be removed and reinstalled from a library. Start with a locally hosted demo of that library, using the real existing capabilities to prove the complete lifecycle. Build user/developer authoring tools after the foundation, or alongside migration once the contracts work.

Full host access is intentional. Activated extensions may execute arbitrary code as root, install dependencies, operate hardware, and modify the host. They are trusted host software; process separation provides lifecycle management and fault containment, not a security guarantee against a privileged extension. A privileged extension can bypass application policies and access application credentials. The UI and documentation must describe that actual trust model.

This is future architecture, not a description of current behavior. The current fixed-action host-agent policy remains in force until its implementation is replaced. Implementation must update ADR 0019, the project constraints, security documentation, and mirrored agent rules together. The user's explicit full-host-access requirement authorizes designing that replacement; do not silently substitute a restricted-only extension model.

Prefer incremental extraction through a working vertical slice over rewriting the three surfaces before testing installation. Existing capabilities must eventually use the same package path as community extensions; temporary migration adapters must have explicit removal criteria.

## 1. Inventory and contracts

Inventory every existing hardware capability, device profile, guide, start block, data block, logic block, action block, validation rule, event listener, and frontend presentation mapping. Record the current observable behavior and its proposed package owner before extraction.

Keep a small permanent application core: authentication, extension installation/storage, runtime supervision, contribution registration, device/workflow persistence, execution history, generic page/canvas rendering, and recovery controls. All current hardware choices, device choices, and block choices become package contributions. The library client and extension manager must remain usable with zero extensions installed. Wallet and Integritas services can remain application services while their workflow blocks become extension contributions.

Define a versioned manifest containing namespaced identity, version, compatibility, dependencies, runtime entry points, contribution definitions, requested execution privileges, and documentation. Define separate contracts for:

- Hardware capabilities: discover, configure, status, install/setup, enable/start, disable/stop, repair, uninstall, operations, and events; long-running actions report durable job progress.
- Devices: role (readable/event/capture/output), configuration schema, defaults, wizard steps, guides, tests, and starter workflows.
- Blocks: explicit execution role/category, configuration and input/output schemas, validation, handler, cancellation, summaries, and help. Custom editors/renderers are deferred under D5.
- Runtime communication: versioned request/response/event envelopes, operation IDs, structured errors, deadlines, health, and shutdown.

Use schema-driven generic forms, guides, and wizard steps initially. Custom UI hooks are deferred until a concrete required example demonstrates the need, as agreed in workshop follow-up D5. Dynamic means installing a compatible package can add a type without rebuilding the application; it does not mean code without any integration contract can become a working device or block automatically. Allow arbitrary package code and language-specific runtimes through explicit entry points.

Specify legacy type aliases and configuration migrations so existing source IDs, block IDs, workflows, secrets, and histories survive extraction. Preserve historic presentation metadata needed to inspect runs after a package is removed.

## 2. Extension core and local demo library

Add a backend extension feature, registered through `backend/src/app.ts`, with schema migrations in `backend/src/db/database.ts` and startup reconciliation in `backend/src/index.ts`. Proposed new feature folders and package directories are to be created during implementation, not assumed to exist now.

Persist local drafts, immutable installed releases, activation state, dependency locks, artifact digests, privilege acknowledgement, jobs, and module-owned state. Keep files under persistent application storage, outside installer-managed source replacement. Package definitions and exports must exclude configured instances and credentials by default.

Provide authenticated admin APIs for import, inspect, install, activate, disable, uninstall, export, and catalog download. The browser uses the backend API. Fetching or inspecting a package must not execute it; code execution begins only during an explicit install/setup/activation action after its declared host access is shown.

Per agreed D7, prompt the user before extension installation/update to back up through the planned app-wide Export device and Export logs functionality, before executable hooks run. Recovery is user directed through the corresponding device restore feature. Treat those app-wide capabilities as a dependency to implement and verify, not an existing guarantee: device exports must restore managed state, while log exports support diagnosis. A shareable module export without configured instances/credentials is not a full device backup. Preserve configuration/history on disable/uninstall; keep updates manual and do not promise reversal of arbitrary privileged host changes. Exact backup coverage and whether the prompt can be skipped remain to be specified.

Use a separate local library service with a real catalog and downloadable immutable packages. Serve it as an opt-in development/demo service. The app must download package bytes from it rather than simulate download by copying built-in source or sharing the installed-package directory. Use an explicit local-library endpoint configuration rather than weakening existing operator-URL restrictions globally.

Keep the catalog/artifact protocol suitable for later central hosting. The first demo does not require publisher accounts, a public upload service, moderation, ratings, or cloud infrastructure. Seed it with the exact versioned packages used for the default installation. Initial installs may use a bundled offline seed of those same artifacts; they must still pass through the normal installer.

First vertical slice: extract the HTTP JSON Source device setup and its Fetch block contribution, using existing HTTP behavior behind a temporary adapter where needed. Prove download, install, activation, persistence, missing-extension rendering, uninstall, and reinstall before expanding to privileged hardware. Remove the temporary adapter when its behavior has a final package/service owner.

## 3. Dynamic hardware agent

Refactor `host-agent/edge_studio_host_agent.py` into an extension-aware host supervisor and capability registry. Replace the fixed camera/GPIO/sensors/MQTT branches with installed capability dispatch. Update `backend/src/features/host-capabilities/hostCapabilities.service.ts` and its routes to use discovered capability definitions and job results.

Support privileged host runtime entry points and lifecycle hooks, including arbitrary package setup code. The supervisor may launch separate processes/services for health, cancellation, and restart management; full host access remains available. Administrative installation must not require adding a new hard-coded capability to the agent.

Package Camera, GPIO, I2C Sensors, and Local MQTT capability behavior, including prerequisite actions and existing helper integration. Define which OS packages, services, device reservations, generated configuration, and data each owns. Dependency setup must be idempotent. Report reboot requirements and partial failure explicitly.

Define uninstall separately from rollback of host changes: removing a package cannot automatically reverse every arbitrary setup script. Supply uninstall hooks and an ownership record, preserve shared dependencies still in use, and report remaining host changes. Recovery controls must be available independently of extension startup, while making no promise of recovery from malicious root code.

## 4. Dynamic Devices page and setup

Replace compiled contribution arrays and per-type wiring in `frontend/src/features/data-sources/DataSourceTemplates.tsx`, `DataSourceForm.tsx`, `buildDeviceConfig.ts`, `deviceSetupGuides.tsx`, the alternate Add Device flow, and `frontend/src/pages/DataSourcesPage.tsx` with registry-driven definitions and generic rendering. Reuse existing components and preserve the current visual behavior.

Replace closed type unions in `frontend/src/features/data-sources/dataSourceTypes.ts` and corresponding backend parsing/validation with namespaced registered types and validated configuration. Adapt `backend/src/features/data-sources/dataSources.service.ts`, routes, and repositories to dispatch through registered providers.

Preserve read/hash/preview handling, capture media hashing, source-owned errors, credential handling, and event listener lifecycle. Distinguish installing a package, enabling its hardware capability, and creating a configured device. Missing or disabled packages retain device configuration and show actionable unavailable states.

## 5. Dynamic workflow canvas and runtime

Replace hard-coded block lists/help, inspectors, summaries, icons, helper conditions, and rendering mappings under `frontend/src/features/automation/workflow/` with registry-driven block descriptors. Keep the canvas layout, selection, configuration panels, watch/replay controls, and execution history as application infrastructure.

Update `frontend/src/features/automation/automationTypes.ts`, `backend/src/features/automation/automation.repository.ts`, `automation.validation.ts`, `automation.service.ts`, and `automation.policy.ts` to resolve registered types. Replace name-based start-block detection with explicit role metadata. New types must not require edits to core execution branches or frontend unions.

Keep the existing scheduler and run/block history, with generic handler invocation and adapter event subscriptions. Pin versions/digests for execution; an in-flight run keeps its resolved version. Ordinary extension calls to app services retain the existing budgets and structured error behavior. Privileged host code can bypass these controls, which must not be represented as a sandbox guarantee.

Retain persisted workflows referencing unavailable blocks, render placeholders, and prevent execution until dependencies are restored. Handle cancellation, unknown side-effect outcomes, and retries explicitly; never automatically repeat a payment merely because a module timed out.

## 6. Default packages and lifecycle proof

Group packages around capabilities and their dependencies: hardware packages, HTTP, webhook, MQTT, system data, workflow basics, and Integritas/Wallet workflow contributions. Determine final boundaries from the inventory; avoid duplicate ownership of shared blocks or helpers. Every existing choice must have a package owner.

Migrate existing installations by recording the matching default-package versions and mapping legacy identifiers without recreating devices or workflows. Do not leave a permanent built-in fallback that continues running a supposedly uninstalled capability. Once an administrator removes a default package, ordinary app restart/update must not silently reinstall it.

For each package, demonstrate: existing behavior; disable; uninstall; unavailable device/block presentation; real download from the local library; install; activation; restored behavior using the original configuration and history. Perform a final zero-extension test followed by restoration of the default set. Explicit purge is separate from uninstall.

Stage updates before activation, resolve dependencies, reject incompatible artifacts, and define safe activation boundaries. State migrations require backup/restore or a documented compatibility path; swapping code alone is not state rollback. Test reboot, interrupted installation, failed hooks, dependency conflicts, shared hardware, and offline operation.

## 7. Authoring tools

Start authoring work once package/runtime contracts and the first vertical slice work; it can then proceed alongside capability extraction without depending on the completed public service.

Phase 1 provides My Modules and a local builder workspace. Support create from template, import, edit files/code, schema editing, wizard/block preview, fixtures, validation, development execution, logs, packaging, export, and local activation. Custom UI entry points are deferred under D5. Separate drafts from immutable active releases. The production library browser and publishing integration are Phase 2; the local demo library remains available for Phase 1 lifecycle verification.

Allow developers to write/import/download arbitrary source and package supported runtimes. Build/source workflows must distinguish source import from artifact readiness and target architecture. Do not require cloud publication to activate a local extension. Testing privileged code is real host execution unless deliberately using a separate disposable target; fixtures alone cannot sandbox root hooks.

Use the tools to create at least one new workflow block and one new device/hardware capability with no application-source edits. Export and install those packages on another test instance. These examples are acceptance tests for extensibility, not new hard-coded special cases.

## Public library reputation requirement

The eventual public library must show a module's 1-5 star average, rating count, and total package downloads, including on cards for modules already installed. Users can submit or replace their module rating. A builder has no separate vote: their score aggregates every rating across their published modules, weighted by rating count. Unrated modules do not reduce an average; a new builder/module starts unrated.

The disposable frontend concept demonstrates this with session-only votes, builder profiles, numeric sample counters, and Top rated / Most downloaded sorting. It is not a registry implementation. Production must identify builders by stable account ID, enforce one rating per user/module server-side, calculate aggregates server-side, and define successful-download counting across releases with abuse controls. Ratings/downloads are community popularity and experience signals; they are not code-safety certification and do not replace publisher/access information.

## Docs

- Update `README.md`, `SECURITY.md`, and `docs/PROJECT.md` when the runtime behavior changes, explicitly describing privileged extension execution and local persistence/recovery.
- Amend ADR 0019 for hardware-agent trust/lifecycle changes; record other durable extension decisions through the ADR skill as implementation settles.
- Update architecture, backend, frontend, devices, automation, Docker, and testing rules/skills where their assumptions change, including identical counterparts in the Claude and Cursor directories.
- Document module contracts, authoring, local demo library setup, install/uninstall behavior, migration, and recovery. Index new documents in `docs/README.md`.
- Add branch-specific changelog entries for implemented user/operator changes; this planning-only change does not change application behavior.
- Maintain this plan's progress and `docs/TASKS.md`/`docs/SESSION.md`; retire the plan when the work is ready to merge.

## Verification

For this planning-only change, run `npm run lint:docs` and inspect the diff.

During implementation, add meaningful contract, migration, lifecycle, privilege-authentication, dependency, and failure-recovery tests. Preserve existing device and automation behavior tests as parity evidence. Test dynamic frontend contributions and missing-package states without relying only on compile success.

Run `npm run check`, backend/frontend/update-agent builds, Compose validation, and container builds where affected, following `.agents/rules/verification.md`. Run shell syntax checks where installer or CLI scripts change. Update host-agent tests as capability dispatch moves into packages.

Manually verify the complete library download/remove/reinstall cycle in the browser and on a Pi, including physical hardware, host prerequisites, event subscriptions, camera media hashing, workflow history/replay, restart, and reinstall persistence. Passing automated tests alone does not establish hardware parity or a flawless lifecycle.
