# Product Requirements Document: Module Builder

**Product:** Edge Studio  
**Created:** 2026-10-30  
**Status:** Requirements baseline for technical specification; implementation not complete. Open decisions in section 9 must be resolved before their dependent work is finalized.  
**Scope confirmed:** Both delivery phases, existing agreed workshop decisions, and independent-author proof as a Phase 1 release requirement.

## 1. Introduction / Overview

Edge Studio currently implements hardware-agent capabilities, device choices/setup, and workflow blocks through application-specific code. Supporting an unsupported sensor or a new workflow action can therefore require changes and a release from the core team.

Module Builder makes those capabilities independently installable packages. An operator can find an existing module or create one, install it locally, and use its capabilities without waiting for an Edge Studio release. A creator can develop new behaviour, test it, and share or sell a version through the official library.

Delivery has two phases:

| Phase | Outcome | Completion boundary |
| --- | --- | --- |
| **1 — Local Module Builder** | Dynamic hardware, device/setup and workflow contributions; local creation, editing, testing, packaging, import/export and explicit activation | Existing capabilities work as removable/reinstallable packages, and an independent author proves a new physical device and workflow block on another supported Pi |
| **2 — Hosted library and commerce** | Centrally hosted releases, discovery, publishing, source inspection, reputation, purchases, contributor payouts/refunds and offline entitlements | A real author-to-buyer journey works, including commerce and installed-version operation without the library |

Phase 1 must be usable without a public-library account or the production hosted service. Its locally hosted demo library is a real package download fixture, not the public marketplace. Commerce is mandatory for Phase 2 completion.

### 1.1 Authority and related documents

This PRD is the product requirements baseline for the technical specification. It consolidates the agreed scope; it does not select unresolved policies or prescribe every implementation detail. If older proposals or demo wording conflict with this baseline, use this PRD for product behaviour and record any necessary reconciliation before implementation. Subsequent product decisions must update this PRD and relevant tickets together.

- [Workshop decisions and original evidence links](../docs/plans/module-builder/workshop-revision.md).
- [Implementation plan](../docs/plans/module-builder.md): engineering decomposition and migration context.
- [OpenProject backlog map](../docs/reports/module-builder-openproject-2026-10-28/README.md) and [acceptance-criteria snapshot](../docs/reports/module-builder-openproject-2026-10-28/backlog.json): two epics and sixteen features, recorded on 2026-10-28. These are snapshots, not a live ticket-status report.
- [Module demo walkthrough](../docs/reports/module-builder-demo/README.md) and [journey presentation](../docs/reports/module-builder-journey-2026-10-28/README.md): visual references, not implemented services or proof of completion.

### 1.2 Terms and users

| Term | Meaning |
| --- | --- |
| Module | A package that contributes hardware capabilities, device definitions/setup, workflow blocks, or a combination |
| Contribution | One capability registered by a module, such as a camera setup choice or workflow action |
| Draft | Editable local source, configuration definitions and metadata |
| Release | A packaged, versioned snapshot; editing a draft does not change this snapshot |
| Installed | A release is present locally; installation may have approved setup effects, but does not imply its contributions are active |
| Active | The operator has explicitly enabled the installed release's contributions |
| Hardware enabled | A separate capability-specific state, such as a camera helper being started |
| Configured device | A saved instance with user settings; installing a module alone does not create that instance |
| Entitlement | The purchase right used by the official delivery flow; it is not a guarantee against copying |

The **operator** administers an Edge Studio instance and may have limited programming experience. A **template author** configures existing protocol support. A **code author** implements new executable behaviour and needs the relevant programming/hardware skills. A **publisher** maintains shared releases. A **library member** downloads, rates or reports modules. Initial **moderators and service operators** maintain the hosted service. Local app administration and public-library accounts are separate responsibilities; this PRD does not add local multi-user administration.

## 2. Goals

1. Allow compatible modules to add hardware-agent capabilities, device/setup choices and executable workflow blocks without editing or rebuilding Edge Studio core code.
2. Move 100% of existing choices in those three extension surfaces onto the package path, with a documented owner and a behaviour-preservation check for each choice.
3. Prove removal, real download, installation, activation and restored behaviour using existing configured devices/workflows and retained history.
4. Provide a complete app-driven creation journey, with no required module CLI and no required hosted account for local use.
5. Require an author outside the core implementation team to create a new physical-device integration and workflow block, then install and use them on another supported Pi before Phase 1 release.
6. Deliver self-service publishing and required commerce in Phase 2 without routine per-release core-team approval.
7. Let users inspect release source and assess community experience while clearly distinguishing popularity from safety assurance.
8. Keep installed versions usable without the hosted library, including paid versions, subject to external services required by a particular module.

These are acceptance targets. The workshop's assumption that most code generation will be AI-assisted is not a measured adoption target and does not make AI use mandatory.

## 3. User Stories

| ID | As a… | I want… | So that… |
| --- | --- | --- | --- |
| US-01 | Operator | To add support for an unsupported sensor through a module | I do not wait for a core application release |
| US-02 | Operator | To see identity, compatibility, source and host access before executing a module | I can make an informed installation decision |
| US-03 | Operator | To export a device backup and logs before a module change | I have a documented recovery and diagnosis path |
| US-04 | Operator | To disable/remove a module while retaining configuration and history | I can reinstall it without rebuilding my setup |
| US-05 | Template author | To start from an existing protocol/device template | I can add supported variants without writing a new driver |
| US-06 | Code author | To use our skill in my own AI harness, import code, and edit/test/package it in Edge Studio | I can create capabilities through a supported journey |
| US-07 | Independent author | To install my package on another Pi without core edits | I can prove the integration is portable |
| US-08 | Publisher | To publish a version without waiting for a core release or human approval | I can maintain modules independently |
| US-09 | Buyer | To inspect a release, purchase it and install it | I can obtain useful integrations through the official library |
| US-10 | Contributor | To receive payment and have refunds recorded correctly | I can offer paid modules through a reliable service |
| US-11 | Library member | To rate modules, see builder reputation and report problems | I can share experience and evaluate available choices |
| US-12 | Service operator/moderator | To handle publication failures, reports and inappropriate content | The library remains operable without central manual review of every release |

## 4. Functional Requirements

Every numbered requirement below is required in its assigned phase. A reference to an open question identifies a decision dependency, not permission to omit the requirement.

### 4.1 Shared foundation and trust model — Phase 1, retained in Phase 2

1. **FR-01 — Dynamic contribution surfaces.** The system must load compatible installed contributions into the hardware-agent interface, Devices/setup flow and workflow canvas/runtime without core-source edits or rebuilding the app. Packages must follow documented integration contracts; arbitrary source is not automatically a compatible module.
2. **FR-02 — Small permanent core.** Authentication, module management/storage, runtime supervision, device/workflow persistence, generic page/canvas rendering, history and recovery access must remain application infrastructure. Module management must still open with zero extensions installed. Wallet/Integritas services may remain core services while their workflow blocks become package contributions.
3. **FR-03 — Package identity and compatibility.** Each release must declare a namespaced module identifier, version, publisher/author identity, contribution definitions, runtime entry points, dependencies, required app/module-API versions, target compatibility, execution privileges and documentation. The installer must check compatibility, dependency availability and artifact integrity before execution. Rejected packages must show an actionable reason. Actual supported runtimes/targets come from Edge Studio policy (OQ-02).
4. **FR-04 — Full host access.** Executable modules must be able to perform privileged hardware/host operations, including arbitrary module code and dependency setup within supported runtime contracts. The interface must describe the effective access before executable setup or testing. Process supervision must not be presented as a security sandbox. A privileged module can access host/application secrets and bypass app-level restrictions.
5. **FR-05 — Explicit execution boundary.** Downloading, importing, reading source, validating non-executable metadata, and previewing schemas/fixtures must not execute package code. Any action that runs setup, module tests or runtime code must identify that it executes code and obtain the appropriate administrator acknowledgement first. An executable preview/test must be labelled as such.
6. **FR-06 — Local persistence and immutable releases.** Drafts, installed release files, dependency/version references, activation state, operation results and module-owned state must survive app restart/update in persistent storage. Installed/published release contents must not change when a draft is edited. A changed release requires a new version; edited drafts must be revalidated and repackaged before being offered as the new artifact.
7. **FR-07 — Authentication and operation records.** Local module-changing operations must use Edge Studio's authenticated administration boundary. The system must record the module/version, action, outcome, execution acknowledgement and useful diagnostic details for installation, activation, update, disable and removal. Displayed/shared diagnostics must redact known application-managed secrets; arbitrary privileged code is outside a secrecy guarantee.

### 4.2 Installation, backup and recovery — Phase 1

8. **FR-08 — Visible lifecycle actions.** The operator must be able to inspect, install, activate, disable, uninstall, reinstall and manually update modules. Installation and activation must be distinct actions/states. Hardware enablement and device creation must also remain distinct. No automatic module update or dependency upgrade is required.
9. **FR-09 — Pre-execution backup prompt.** Before installation or update runs executable hooks, and before local draft activation/testing that executes privileged code, the app must present the host-access warning and offer app-wide **Export device** and **Export logs**. Cancelling must run no package code. Whether users may explicitly continue without exporting is unresolved (OQ-01); the prompt itself is mandatory.
10. **FR-10 — App-wide restore prerequisite.** Export device must produce a restorable backup of its declared managed-state coverage. Export logs must provide diagnostic evidence and must not be described as a restorable backup. Before relying on this workflow, prove restoration of the agreed device/workflow configuration, module versions/artifacts and state, retained history and credentials, with exclusions and credential protection documented (OQ-01). Use the app-wide restore path rather than a separate module-only backup system.
11. **FR-11 — Preserve configured state.** Disable/uninstall must preserve configured devices, workflow definitions, identifiers, history and retained module state by default. Removing data is a separate explicit deletion action. An ordinary app restart/update must not silently reinstall a default module the operator removed.
12. **FR-12 — Missing contributions.** A saved device or workflow referencing an unavailable module must remain visible with its identity/configuration and an actionable unavailable state. Historical runs must remain inspectable. Workflows with unavailable required contributions must not execute. Reinstalling/activating a compatible release must make preserved instances usable without manual recreation.
13. **FR-13 — Dependency and update protection.** Show dependency/compatibility problems before execution. Do not silently remove a shared dependency or activate an incompatible release. Prepare the new version before switching active contributions, retain the selected version for an in-flight run, and preserve enough version information to diagnose outcomes. The technical specification must define state-migration and interrupted-operation handling; swapping code must not be described as restoring state.
14. **FR-14 — Failure reporting and recovery.** Installation/setup/update must report progress and final success/failure, including incomplete host changes and required reboot. An interrupted or failed action must not appear successful after restart. Recovery controls and logs must be available independently of ordinary extension startup, provided the host/app remains operable. Document user-directed restore and repair/reinstall steps; do not promise reversal of arbitrary OS, service, firmware or hardware changes.

### 4.3 Existing capability extraction and parity — Phase 1

15. **FR-15 — Inventory and migration.** Inventory every existing hardware choice, device/profile/setup guide and workflow block, assign a package owner and record its current observable behaviour. Migrate existing installations without recreating configured devices/workflows or losing IDs, secrets or history. No permanent built-in fallback may keep an uninstalled capability working.
16. **FR-16 — Dynamic hardware.** Hardware packages must expose the relevant setup, configuration, status, start/enable, stop/disable, repair, uninstall, operations and events. Extract Camera, GPIO, I2C Sensors and Local MQTT behaviour, including existing helper integration. Setup must handle repeat attempts, shared dependencies, partial failure and reboot requirements. Hardware testing must use real supported Pi targets.
17. **FR-17 — Dynamic Devices and setup.** Device packages must supply roles, field definitions/defaults/validation, setup steps, guides, relevant tests and starter workflows where supplied. The app must render these through reusable schema-driven controls. Existing read, event, capture, output, preview/hash and credential behaviour must continue working. A new compatible device definition must appear without a compiled frontend type branch.
18. **FR-18 — Dynamic workflows.** Block packages must supply execution role/category, settings and input/output definitions, validation, handler, cancellation behaviour, summaries and help. The app must retain its canvas, scheduler, history and watch/replay infrastructure. New blocks must not require a hard-coded core execution branch. A timeout with an unknown side-effect result must not automatically repeat a payment or equivalent irreversible operation.
19. **FR-19 — Real local library.** Provide a separately hosted local test catalog with downloadable versioned artifacts for the default modules. The app must download actual bytes through the normal installer; copying built-in source or reading the installed-module directory is not a valid download proof. Bundled offline defaults may seed the same artifacts through the same installer. The fixture does not need public accounts, moderation or commerce.
20. **FR-20 — Default-package lifecycle proof.** For every default package, demonstrate original behaviour, disable, uninstall, unavailable UI, real library download, installation, explicit activation and restored behaviour with the original configuration/history. Include restart persistence, zero-extension app operation and restoration of the default set. Start with the HTTP JSON Source/Fetch block slice before expanding migration across all three surfaces.

### 4.4 Local creation journey — Phase 1

21. **FR-21 — Local workspace.** Provide My Modules and a workspace to create from templates, edit metadata/source/schema definitions, preview forms/wizards/blocks, supply fixtures, validate, run clearly identified tests, inspect logs, package, import/export and explicitly activate locally. Local drafts must not require publication or a library account.
22. **FR-22 — External AI-assisted creation.** Provide a module-builder-skill containing versioned contract guidance, templates/examples, expected file structure and test/package instructions for the user's own AI harness. Support importing its output and editing code in Edge Studio. The user must also be able to write code without AI. Do not require a specific AI provider, automatic harness connection or module CLI.
23. **FR-23 — Import/export boundaries.** A shareable module export must include the source/package material needed for its stated format and omit configured device instances and application credentials by default. It must not be presented as a device backup. Import must distinguish editable source from an install-ready artifact and explain missing build/runtime/dependency requirements. Reject malformed or unsafe archive paths without changing the active release. Supported formats/build routes must be defined before implementation (OQ-03).
24. **FR-24 — Validation and evidence.** Show validation/test outcomes with the module version or draft revision they apply to. Basic validation must cover required metadata, contribution/schema validity, compatibility/dependency declarations and artifact integrity; exact limits and error rules belong in the technical specification. Passing fixtures or checks must not be labelled hardware compatibility or safety certification.
25. **FR-25 — Independent-author release gate.** Before Phase 1 release, an author outside the core implementation team must use the supplied tools/documentation to create a previously unsupported physical-device integration and a new workflow block. They must export/package the work, install and activate it on a second supported Pi, acquire a real device reading/event and use the new block successfully. They may use the skill in their own AI harness. No core-source edits, core release, module CLI or production hosted library may be required. Record reproduction steps and results; template-only and HTTP-only demonstrations do not satisfy this gate.

### 4.5 Hosted library and publishing — Phase 2

26. **FR-26 — Publisher accounts and ownership.** The hosted library must provide stable account and publisher identities and associate each module/release with its publisher. Only authorized publisher accounts may publish versions under that identity. Local authoring must continue to work independently of library login.
27. **FR-27 — Immutable hosted releases.** Authors must be able to publish prepared artifacts with matching inspectable release source, version, compatibility/dependency metadata, privilege declaration, description and change notes. Published contents must be immutable for that version. Reject replacement bytes under the same version. A listing must identify the exact release being inspected/downloaded; policy for accepted source/artifact formats is OQ-03.
28. **FR-28 — Automated publication checks.** Run automated basic acceptance checks before a release becomes available. A failed check must explain the issue and allow correction/resubmission. Publication must not depend on mandatory human approval or routine core-team code review. AI-assisted checks are optional to evaluate, not a release requirement or safety guarantee. Exact blocking rules must be agreed before launch (OQ-04).
29. **FR-29 — Discovery.** Provide public module listings/details, publisher profiles, search and compatibility information. Listings must show purpose, publisher, available release/version, host access, source-inspection route, license information, price/free status, rating/count and downloads. Unrated modules/builders must display as unrated. Support sorting by top rated and most downloaded, with the tie/order rules defined in the technical specification.
30. **FR-30 — Add from library.** An operator must be able to select a hosted module through Edge Studio's library journey, inspect a release, complete any required purchase/login, download it, review compatibility/access and the backup prompt, install and explicitly activate. Installation must use the Phase 1 package path. A downloaded file may also be imported manually; the source/package format and compatibility rules still apply. A website visit, purchase or download must never silently execute code on a device.
31. **FR-31 — Source inspection and reports.** Members must be able to inspect the source associated with a specific release and submit a problem/inspection report associated with the relevant module/release. Separate community observations from author claims, automated findings and platform moderation. Source-access rules for paid releases, including inspection before purchase, must be decided before commerce launch (OQ-06).
32. **FR-32 — Initial moderation and end goal.** Initially, designated humans must handle spam/inappropriate-content moderation after publication. Provide reporting, triage and removal/withdrawal mechanisms, with a visible availability outcome. Do not require pre-publication human review. Community-managed review/moderation is the intended end state; initial responsibility, policy, report handling and transition criteria must be agreed before launch (OQ-04/OQ-08). Neither ratings nor moderation certifies privileged code as safe.
33. **FR-33 — Service outage and withdrawal.** When the library is unavailable, show an actionable error for browsing, purchase, publication and download; preserve local modules/workflows. Installed versions must not require contacting the library to continue normal use. Prevent new official downloads of a withdrawn release and communicate its availability status; treatment of existing purchasers' retrieval rights must be settled in OQ-06. Do not promise that the platform can undo previously executed privileged code.

### 4.6 Reputation — Phase 2

34. **FR-34 — Module ratings.** Identified library users must be able to submit one 1–5 star rating per module and replace their previous rating. Enforce uniqueness and calculate the average/count on the service, rather than trusting browser values. Editing a vote must update the existing vote, not increase its count. Eligibility and anti-abuse rules are OQ-05.
35. **FR-35 — Builder aggregate.** A builder's score must aggregate the individual ratings across their published modules, weighted by rating count. There is no separate builder vote. For example, a module rated 5 by one person plus a module averaging 4 from nine people gives a builder score of 4.1 across ten ratings. Unrated modules add neither votes nor zero-valued ratings. Stable publisher identity, not display-name matching, must determine ownership.
36. **FR-36 — Download totals.** Show module-level download totals, including for modules installed by the current operator. Calculate totals on the service from its agreed successful-download events, across releases. Define handling of retries, repeated users/devices, test traffic, abuse, withdrawn modules and transfers before launch (OQ-05). Download totals must not be conflated with purchases or active installations.

### 4.7 Required commerce — Phase 2

37. **FR-37 — Paid-module purchase.** Provide an official checkout and purchase record associated with buyer, module, publisher, purchased release/rights, amount and payment outcome. Successful purchase must enable the entitled official delivery path. Declined, cancelled or uncertain payments must show their actual status and must not be treated as a confirmed purchase. Provider, currencies, taxes and the commercial model are OQ-06.
38. **FR-38 — Contributor payouts and refunds.** Provide contributor payout and refund handling with traceable transaction/outcome records and appropriate operator/publisher/buyer visibility. Repeated callbacks/retries must not create duplicate charges, entitlements, payouts or refunds. Verify successful and failed/pending payment cases, a payout path and a refund path with the selected provider. Detailed fees, settlement, disputes and refund terms must be decided before launch (OQ-06).
39. **FR-39 — Offline entitlements.** Once a paid version is installed and activated with valid purchase rights, it must continue operating without continuous license-server/library checks. Purchase and new official downloads require connectivity. State separately when a module itself needs an external service. A signed receipt is one possible mechanism, not a prescribed design. Post-refund rights, future updates and re-download rights remain policy decisions (OQ-06); do not implement a continuous online check as a workaround.
40. **FR-40 — Inspectability and licensing.** Paid distribution must retain inspectable release source and publisher/provenance information. Clearly distinguish purchase rights from copyright/license rights. Do not promise strong DRM, enforceable prevention of copying, or mandatory restrictive redistribution terms. Application/module licensing and permitted fork/redistribution rights remain unselected (OQ-07); the recent MPL/Apache proposal is a recommendation, not an adopted license policy.

### 4.8 Operations and release acceptance

41. **FR-41 — Separate operating responsibilities.** The platform team must maintain the runtime/contracts, default-package lifecycle and creation tools. Community authors must be able to maintain their modules without routine core releases/review. Hosted-service operations and initial moderation require separately named owners, monitoring, backup/restore and incident/report handling before Phase 2 launch. A low community-creation workload does not mean the hosted service has no maintenance owner (OQ-08).
42. **FR-42 — End-to-end release evidence.** Each milestone below must have reproducible evidence tied to tested app/package versions and supported targets. A frontend-only simulation, mocked purchase or screenshot cannot complete a runtime, physical-hardware or commerce acceptance gate.

### 4.9 Milestones and acceptance scenarios

| Gate | Required demonstration | Completion evidence |
| --- | --- | --- |
| Backup prerequisite | Export declared managed device state and logs, make a supported change, and restore the managed state through the documented app-wide path | Coverage/exclusions, credential handling, restore results and app repair/reinstall instructions; FR-09/10/14 |
| M1 — Lifecycle slice | Configure HTTP JSON Source/Fetch usage; disable/remove its package; confirm unavailable state and retained configuration/history; download real bytes from the separate local catalog; install/activate; restart; confirm original usage works | Artifact/version identity, operation results and before/after assertions; FR-01–15, FR-19/20 |
| M2 — Default parity | Complete inventory/extraction across hardware, device setup and workflows; exercise every default package's remove/download/reinstall cycle; test zero extensions, restart and restoration on supported Pi hardware | Every existing choice has an owner and passing parity result; no permanent built-in execution fallback; FR-15–20 |
| M3 — Authoring proof / Phase 1 release | Independent author creates a new physical-device integration and block using the app journey; tests and packages them; another supported Pi installs and uses them without core edits | Author/target/version records, actual device event/reading and successful workflow run; FR-21–25; all Phase 1 gates must pass |
| M4a — Hosted publication/discovery | Author publishes through automated checks; invalid submission receives useful errors; a member finds the release; post-publication report/moderation action works | Stable identity, immutable release and matching source, report/status records; FR-26–33/41 |
| M4b — Inspection/reputation | Members inspect/report a version, rate/update votes, and see correct module/builder totals and download counts | Service-side calculation/uniqueness tests, unrated states and published counting policy; FR-31/34–36 |
| M4c — Commerce / Phase 2 release | Independent author publishes a paid module; another user inspects under the agreed policy, purchases, installs and activates it; payout/refund paths are verified; installed paid capability works while library/license services are unreachable | Payment/entitlement/payout/refund records, no duplicate transaction effects, offline execution result; FR-37–40; all Phase 2 gates must pass |

Authoring tools may be developed alongside migration after the first contracts/lifecycle slice works. Independent-author feedback should be collected early, but final Phase 1 release still requires both complete default parity and the authoring proof. M4a/b may be developed before commerce; they do not constitute a completed Phase 2 release.

### 4.10 Required error and interruption cases

| Situation | Required outcome |
| --- | --- |
| Malformed package, unsafe archive path or digest mismatch | Explain rejection; run no package code and leave the active release unchanged |
| Unsupported target/runtime/API or unresolved dependency | Explain what is missing/incompatible; do not claim the module is ready to execute |
| User cancels backup/access confirmation | Cancel without running setup/test/runtime code |
| Download interrupted | No incomplete artifact presented as install-ready; offer a user-directed retry |
| Setup hook fails, times out or needs reboot | Show failure/incomplete/reboot state and diagnostics; disclose partial host changes |
| App/Pi restarts during installation/update | Reconcile a truthful operation state; never infer success merely from partial files |
| Module crashes or is disabled/removed | Preserve saved instances/history, show unavailable state, and retain module-management/recovery access while the host remains operable |
| Workflow side effect times out | Report uncertain outcome; do not automatically repeat irreversible actions |
| User edits a packaged draft | Mark the old package/test results as belonging to the previous revision; require new preparation for the changed draft |
| Duplicate rating/payment notification | Replace the vote or apply the transaction once; do not inflate totals or duplicate money movements |
| Library/payment provider unavailable | Explain unavailable online action; preserve installed local operation and known transaction state |

## 5. Non-Goals (Out of Scope)

- A full IDE, terminal/CLI authoring product, built-in AI code-generation harness, automatic AI-provider connection or mandatory AI use.
- Arbitrary custom frontend pages, custom block editors or custom UI hooks in the initial delivery; schema-defined forms/guides/wizard steps are the agreed baseline.
- A security sandbox for privileged modules, guaranteed safe code, hardware safety certification, or central manual qualification/review of every release.
- Automatic updates/dependency upgrades, fleet rollouts, automatic rollback, or guaranteed reversal of arbitrary privileged host changes.
- A separate Module Builder runtime/OS/Pi support matrix; this inherits Edge Studio policy.
- A hosted build farm, remote Pi rental/build service, or cloud requirement for local module creation.
- Strong copy protection, compulsory restrictive redistribution licensing, or an application license selected by this PRD.
- Public accounts, ratings, publication or real payments in Phase 1. The local catalog is a lifecycle test fixture.
- A separate module-only substitute for app-wide device backup/restore; history-only archives and module-sharing exports do not satisfy that dependency.

## 6. Design Considerations

Use Edge Studio's existing design system and device/workflow layouts. Use the demo for journey intent, not an obligation to copy simulated behaviour or every screen. All product text must be in English.

The local journey must make the distinctions between draft, packaged release, installation, activation, hardware enablement and configured-device creation understandable. Use explicit actions and show progress, final result, useful errors and retained-state implications. Show unavailable module references instead of losing saved work. Lists and detail views need consistent loading, empty and failed-load states.

Before execution, explain effective host access in plain language; do not reduce it to a vague safety badge. Distinguish non-executable previews from tests that actually run code. Make export options and backup limitations visible before the action starts.

Library details must separate ratings/downloads, source inspection, publisher identity and moderation findings. Popularity must not be labelled proof of safety. Paid flows must make price, purchase outcome and agreed use/update rights visible before confirmation. Exact website-to-app handoff and source-access presentation require a design decision (OQ-06/OQ-09).

## 7. Technical Considerations and Dependencies

The technical specification must define the versioned manifest/contribution contracts, persistent package/state layout, host supervision interface, schema renderer, artifact/source relationship, version selection, operation reconciliation, migration strategy, server APIs and authorization. It must map these to the numbered requirements and error cases above. This PRD does not prescribe database tables, runtime languages, payment vendors or receipt formats.

The browser must use authenticated Edge Studio backend APIs for local operations. The current app's fixed-action hardware-agent constraints remain current behaviour until deliberately replaced. The full-host-access design requires corresponding security documentation, architecture decisions and mirrored contributor rules to be updated during implementation; the demo does not authorize silently changing runtime behaviour.

### 7.1 OpenProject traceability

This table uses the recorded backlog, without changing tickets or claiming their current status. Each feature's technical specification must refine these requirements rather than independently redefine product scope.

| Epic / feature | PRD scope |
| --- | --- |
| [#1081 — Phase 1](https://openproject.privateprivate.org/work_packages/1081) | FR-01–25, FR-41/42; backup prerequisite and M1–M3 |
| [#1083 — Export/restore prerequisite](https://openproject.privateprivate.org/work_packages/1083) | FR-09/10/14 |
| [#1084 — Inventory/contracts](https://openproject.privateprivate.org/work_packages/1084) | FR-01–07/15 |
| [#1085 — Lifecycle/HTTP slice](https://openproject.privateprivate.org/work_packages/1085) | FR-08–14/19/20 |
| [#1086 — Dynamic hardware](https://openproject.privateprivate.org/work_packages/1086) | FR-04/14–16 |
| [#1087 — Dynamic devices/setup](https://openproject.privateprivate.org/work_packages/1087) | FR-12/15/17 |
| [#1088 — Dynamic workflow registry](https://openproject.privateprivate.org/work_packages/1088) | FR-12/13/15/18 |
| [#1089 — Default extraction/parity](https://openproject.privateprivate.org/work_packages/1089) | FR-15–20 |
| [#1090 — Local workspace](https://openproject.privateprivate.org/work_packages/1090) | FR-05/06/09/21–24 |
| [#1091 — Skill/package/author proof](https://openproject.privateprivate.org/work_packages/1091) | FR-22–25 |
| [#1082 — Phase 2](https://openproject.privateprivate.org/work_packages/1082) | FR-26–42; M4a–M4c, including required commerce |
| [#1092 — Publisher/releases](https://openproject.privateprivate.org/work_packages/1092) | FR-26/27 |
| [#1093 — Discovery/app integration](https://openproject.privateprivate.org/work_packages/1093) | FR-29/30/33 |
| [#1094 — Publication/moderation](https://openproject.privateprivate.org/work_packages/1094) | FR-28/32/33/41 |
| [#1095 — Source/reports](https://openproject.privateprivate.org/work_packages/1095) | FR-27/31/40 |
| [#1096 — Reputation/downloads](https://openproject.privateprivate.org/work_packages/1096) | FR-34–36 |
| [#1097 — Purchases/payouts/refunds](https://openproject.privateprivate.org/work_packages/1097) | FR-37/38 |
| [#1098 — Entitlements/offline](https://openproject.privateprivate.org/work_packages/1098) | FR-33/39/40 |

The existing effort ranges are provisional planning estimates, not PRD commitments. Refine estimates after resolving dependent questions and producing the technical specification.

## 8. Success Metrics

These release metrics require recorded test/workshop evidence, not a new compulsory telemetry service. Commercial growth targets and operational service-level targets have not yet been agreed.

| Metric | Required target | Evidence |
| --- | --- | --- |
| Inventory coverage | 100% of existing choices across the three extension surfaces assigned to packages | Signed-off inventory and parity checklist |
| Default-package parity | Every default package completes the lifecycle/restart test with configured state/history retained | M2 results on supported targets |
| Core independence | Zero core-source edits or app rebuilds needed for the independent new-device/new-block example | Package/source comparison and second-Pi run |
| Authoring proof | At least one independent author and one new physical device plus one new block; installed and exercised on another Pi | M3 reproduction record |
| Recovery proof | Every item in the agreed backup coverage is restored; all exclusions are documented | Backup prerequisite test and restoration comparison |
| Publication independence | An independent publisher releases without a core release or mandatory pre-publication human gate | M4a record |
| Reputation correctness | Rating replacement, unrated states, builder weighting and download-count policy pass their cases | Service tests and library walkthrough |
| Commerce completion | Purchase, official delivery, payout and refund paths verified; duplicate events cause no duplicate financial effects | M4c provider-backed acceptance evidence |
| Offline continuity | Installed free and paid test modules run when library/license services are unreachable, excluding declared external module services | Offline execution checks |

## 9. Open Questions and Decision Gates

Suggested decision roles below identify who must resolve each issue; they do not assert that a named owner has accepted responsibility. No unresolved answer should be silently invented by a junior developer. Record the chosen policy here before finalizing dependent specification work.

| ID | Unresolved question | Required decision / when | Suggested decision roles |
| --- | --- | --- | --- |
| OQ-01 | What exactly does Export device restore, how are credentials protected, and may users continue without exporting? | Define coverage/exclusions, protected export handling, restore targets/versions, and backup-prompt skip policy before lifecycle UX and restore acceptance are finalized | App product owner, security and engineering |
| OQ-02 | Which app versions, runtimes, Pi models, OS versions and architectures does Edge Studio support? | App-wide policy before compatibility contracts and test targets are finalized; modules declare their supported subset | Edge Studio product/engineering |
| OQ-03 | Which source/artifact formats, dependency rules and source-build paths are supported? | Define app-driven packaging/build route, source-to-artifact association and compatibility/integrity checks before M1/M3 specification completion; do not introduce a required module CLI | Platform engineering and product |
| OQ-04 | Which publication checks block a release, and how are reports/removals handled initially? | Define exact checks, limits, content policy, moderation actions and community transition criteria before Phase 2 launch; decide separately whether AI checks add value | Library product/service owner, moderation and engineering |
| OQ-05 | Who can rate and what counts as a download? | Define eligibility, abuse handling, retry/unique-event policy, withdrawn/deleted module treatment and ownership-transfer effects before reputation launch | Library product and engineering |
| OQ-06 | What are the commercial model and purchase rights? | Choose provider, supported markets/currencies, tax/compliance responsibility, fees, payouts, refunds/disputes, update/re-download rights, post-refund behaviour and paid-source inspection access before commerce launch | Business/product, finance/legal and engineering |
| OQ-07 | What licenses and redistribution/fork rights apply to Edge Studio and modules? | D8 remains open; inspectable source is required but does not choose an open-source license. Evaluate the separate MPL/Apache recommendation and accepted module-license policy before public release terms are finalized | Rights holders, product and legal |
| OQ-08 | Who owns official packages, the hosted service and initial moderation? | Name operational/maintenance owners, backup/restore responsibility, incident/report handling and community handover criteria before hosted launch | Engineering/service leadership and product |
| OQ-09 | How does the public website hand a chosen release to an Edge Studio instance? | Select a supported handoff/import approach and account flow before Phase 2 UX is finalized; preserve explicit authenticated install/activation | Product/design and engineering |

The technical specification may proceed on agreed requirements while isolating these dependencies. A milestone cannot pass with its required policy, support target, acceptance criterion or operational owner still undefined. A public-library-only release does not satisfy Phase 2 while commerce remains unfinished.
