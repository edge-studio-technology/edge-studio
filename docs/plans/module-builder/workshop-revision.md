# Full Module Builder: workshop revision and open decisions

**Status:** Discussion draft; D1-D7 directions and two delivery phases agreed on 2026-10-27, with commerce confirmed as required Phase 2 scope on 2026-10-28. D8 and detailed commercial/ownership/check policies remain open; implementation not started.
**Created:** 2026-10-27
**Purpose:** Translate the workshop brief and team priorities into a narrower Full Module Builder proposal, and record decisions before revising the implementation plan.

## Sources and relationship to the plan

- [Workshop report](<../../reports/module-builder-2026-10-20/module-strategy-report (1).md>), exported 2026-10-27; participants: Rasmus, Patrik, Adam.
- [Workshop JSON](../../reports/module-builder-2026-10-20/module-strategy-workshop.json), including answers, constraints, and draft path assumptions.
- [Existing implementation plan](../module-builder.md).
- [Earlier research and alternatives](./discussion.md).

Sections 1 and 2 mean the workshop brief and team priorities. This document distinguishes recorded answers, proposed interpretations, and subsequent agreed decisions. It does not replace the implementation plan. The exported workshop answers remain the original evidence.

## 1. What the team recorded

The desired outcome is that a user who discovers an unsupported sensor can find support in the marketplace or create it, without waiting for a core release. Users should be able to write code that interfaces with Edge Studio, find or create drivers, and monetize shareable extensions.

Creators and operators have mixed skill levels. An IDE is explicitly out of scope. Commercial modules are part of the long-term vision. Validation ownership is hybrid: automated checks, authors, and core/community review. Community support was selected. Supported environments were recorded as “Depends on Edge studio app”; actual targets remain undefined.

All eight capability levels were answered as minimums, with no unresolved answers:

| Capability | Minimum | Importance | Proposed implication |
| --- | --- | --- | --- |
| Contribution breadth | 4/5 | Essential | Support new drivers, protocols, and executable logic. |
| Operator guidance | 1/5 | Important | Technical documentation and manual setup are acceptable initially. |
| Creator tools | 5/5 | Important | Provide the complete creation journey in the app, including code editing. AI-assisted code generation happens in the user's own harness with the planned module-builder-skill; no CLI actions are planned (D1). |
| UI customization | 3/5 | Important | Start with schema-defined forms, setup guides, and wizard steps. |
| Sharing and distribution | 5/5 | Important | Include a public self-service library, publisher profiles, and reputation in the long-term product. |
| Validation depth | 1/5 | Important | Basic package acceptance checks are the minimum; central hardware qualification is not required by this answer. |
| Lifecycle and recovery | 2/5 | Important | Document installation, removal, backup, and recovery; prioritize explicit manual updates. |
| Contributor independence | 5/5 | Important | Authors should create, release, and maintain additions without core releases. |

Contributed executable code, full host access, drivers without core releases, a public self-service library, and offline operation are all required. Local creation and activation must not require publication.

Low minimums allow more capability; they are not instructions to remove existing checks or behavior. Deferring advanced guidance, UI customization, or lifecycle management is a scope recommendation rather than a directly recorded exclusion.

## 2. What the comparison does and does not establish

Full Module Builder has a weighted capability gap of 0.00, but it remains a constraint conflict. All seven draft paths conflict with at least one recorded boundary or resource ceiling.

| Resource | Full Module Builder draft requirement | Team ceiling |
| --- | --- | --- |
| Platform build investment | 5 | 4 |
| Ongoing core-team workload | 4 | 1 |
| Creator technical skill | 3 | 3 |
| Distribution service operations | 5 | 3 |

These levels are relative workshop assumptions with low confidence for this path. They are not engineering estimates. Every priority uses minimum interpretation, so extra capability adds no gap. The 0.00 result does not establish that the original plan is affordable, that every feature is wanted, or that extra features are free.

D2 subsequently clarified that the workload ceiling of 1 mainly concerns core-team involvement in community module creation. Web-library maintenance is handled separately. The original comparison combined broader ongoing responsibilities, so its workload conflict does not directly establish a conflict under this clarified interpretation. Assess community-creation involvement, platform maintenance, and library operations separately in a revised comparison; retain the exported scores as the original evidence. The distribution-operations ceiling of 3 has not been changed by this clarification.

The proposal is to retain the extensible foundation while narrowing initial scope. We must not lower requirement scores merely to make the comparison appear compatible; revised scores need an explicit scope and evidence.

## 3. Proposed product shape

Build an extension runtime, a schema-driven module workspace, and a self-service library. Preserve the existing plan's small permanent core, dynamic hardware/device/workflow registries, versioned packages, and locally installed releases.

### Creation workspace and external AI-assisted generation — D1 agreed

Agreed journey:

1. Choose a hardware, device, or workflow template.
2. Define package metadata, fields, setup instructions, and contributions.
3. Use the planned module-builder-skill in the user's own AI harness to generate or revise module code using our contracts and templates.
4. Import that code into Edge Studio and edit it in the app as needed. Users may also write code directly in the app.
5. Use the app's previews, tests, packaging, and logs to prepare and check the module.
6. Activate locally and export a version in Phase 1; publish to the hosted library in Phase 2.

Code editing is in scope inside Edge Studio. AI-assisted code generation is expected to happen in the user's own harness, guided by our planned module-builder-skill. The team's expectation that this will account for roughly 99% of generation is a planning assumption, not measured adoption or a requirement to use AI. An in-app AI generation harness is not part of this agreed creation model. The workshop's IDE exclusion does not exclude a code editor or the agreed module tools.

We will not build CLI actions for module creation, testing, packaging, activation, or publishing. Templates, previews, tests, packaging, activation, and publishing belong in the app's supported journey, delivered across the two phases below. The implementation of any required source builds remains to be designed within that app-driven flow. Previewing schemas and fixtures must be distinguished from executing privileged code on the real host.

The module-builder-skill is a planned authoring aid, not an implemented feature. It should give the user's AI harness the module contracts, templates/examples, expected file structure, and testing/packaging requirements needed to produce compatible code. Its exact contents and distribution still need definition. No automatic harness connection, project synchronization, or specific AI provider is assumed by this decision.

Provide two authoring routes using the same package model: profile/template authors configure existing protocols, while code authors implement new behavior through documented contracts. Templates can remove boilerplate; they cannot make an unfamiliar hardware driver a moderate-skill task. The skill ceiling must be interpreted separately for these routes.

### UI and runtime

**D5 agreed:** Schema-defined forms, guides, and wizard steps are sufficient initially. Defer arbitrary custom views, block editors, and custom UI hooks until a concrete required example demonstrates that the schema-driven approach is insufficient.

Keep supervised extension processes and full host access available. A privileged package is trusted host software; process separation helps operation and fault handling but does not constrain malicious root code.

**D6 agreed ownership:** Supported runtimes, Pi models, operating systems, architectures, and app-version policy belong to Edge Studio as a whole. The Module Builder inherits that policy instead of defining a separate support matrix. The workshop's “Depends on Edge studio app” answer is the basis for this boundary; actual support values remain app-level decisions.

The Module Builder still needs manifest fields and compatibility checks for each module's required app/module-API versions, runtime, architecture, and dependencies. A module may support only a subset of Edge Studio's environments; inheriting app policy does not make every module compatible with every target. Extension contracts and authoring documentation implement that policy. The distinction between template authors and driver developers remains a tooling/documentation consideration in the creation journey, separate from platform support ownership.

### Installation and publication

**D7 agreed:** Keep lifecycle behavior simple and user-action centric: manual installation, explicit activation and updates, compatibility/package-integrity checks, retained configuration/history, clear errors/logs, and disable/uninstall/reinstall controls. Uninstall does not purge device/workflow configuration or history unless the user explicitly requests deletion. Defer automatic dependency upgrades, staged rollout management, and automatic rollback.

Before installing any extension, prompt the user to export a backup through the planned app-wide Export device and Export logs functions. Updates are installations of a new version and use the same prompt. The prompt must precede executable install/setup hooks, not appear after host changes have begun. Backup/export is user initiated; whether proceeding without an export is allowed remains a UI detail to resolve rather than an agreed mandatory-backup gate.

Use the app-wide restore functionality for user-directed recovery rather than building a separate module-only backup system. Export device must provide a restorable backup of the device's managed state; Export logs provides the accompanying diagnostic record. A log export alone is not a device backup. These are planned app-wide capabilities, not implemented features assumed to exist already. Define their coverage for configuration, workflows, module versions/artifacts and state, retained history, and credentials, and verify a complete restore before relying on the prompt as the recovery path. Backup handling must follow the export feature's credential-protection policy, not the credential-free module-sharing format.

Document restoring the exported state and reinstalling compatible module versions, including the recovery route if the app must first be repaired/reinstalled. Reinstalling module code alone is not configuration rollback. Restoring app-managed state cannot guarantee reversal of arbitrary privileged OS, service, firmware, or hardware changes; cleanup hooks and instructions may assist, but the backup must describe its actual coverage.

**D4 agreed rollout:** Apply automated acceptance checks before publication, without requiring human approval to publish. Initially, human moderation takes place after publication to filter spam and inappropriate uploads. This is content moderation, not a requirement for manual code review or a guarantee of hardware compatibility or safety.

The end goal is community-managed review/moderation supported by automated checks, without routine human review by our team. Community ratings, inspection reports, and reporting tools support that model. Possible AI-assisted checks should be evaluated; they are not yet required and must not be presented as proof of safety.

Candidate automated acceptance checks include package structure, manifest validity, required metadata, declared dependencies/compatibility, and artifact integrity. Exact blocking rules and the role of any AI findings remain to be defined. Installer correctness, failed-install handling, and application regression tests remain necessary independently of publication policy. Author-provided test evidence may be useful, but mandatory evidence requirements have not been agreed.

Before Phase 2 launches, define who performs the initial post-publication moderation, what counts as spam/inappropriate content, how reports and removals work, and the criteria for moving to community management. The initial human review is not a pre-publication gate. This refines the workshop's original hybrid validation-ownership answer without changing its exported record.

Initially prefer prepared artifact uploads over a centrally hosted build service. Central hosting still requires publisher identity, immutable downloads, reports/withdrawals, and service ownership. Ratings, download counts, and builder aggregates remain planned reputation features; they do not certify code safety.

### Commercial distribution and offline use — D3 direction agreed

Support paid official distribution with inspectable release source, offline entitlements, and clear publisher identity. Purchase/download requires connectivity; an installed purchased version continues working offline without continuous license-server access. Offline operation concerns the platform/library dependency; a module that calls an external service may still require that service.

The normal purchase flow grants access to official packages. A locally verifiable signed purchase receipt is a proposed entitlement mechanism; its exact format remains to be designed. It can support the normal installer flow offline but cannot prevent a user with full host control from bypassing a check or importing copied code. Package signatures/digests establish provenance and integrity, not copy protection or code safety.

Expose the source for the exact published release, its dependencies and requested host access, and changes between versions. Local edits must remain possible and should be identified as modified copies rather than unchanged publisher releases. Verified-purchase reviews and community inspection reports should be distinguishable and refer to the inspected release; neither is a safety certification.

Protect the official distribution channel through publisher namespaces, attribution, and ratings/purchase history tied to the original listing. Reporting and investigation can address impersonation and disputed uploads; do not assume every similar package is an unauthorized copy or prohibit legitimate reuse. These controls do not prevent sharing outside the library.

**D8 remains deliberately open:** Restricted redistribution is difficult to enforce, so do not commit the product to strict redistribution enforcement or strong DRM. Accept that determined copying cannot be technically prevented on a user-controlled host. This does not select a license or settle redistribution/fork rights; inspectable source and open-source licensing are separate choices. The previous source-available commercial option is not adopted as a mandatory model.

**D3 scope confirmed 2026-10-28:** Commerce is required in Phase 2, including paid official distribution, purchase entitlements, contributor payments and refunds. A catalog-only implementation does not complete Phase 2. Provider, pricing/subscription models, purchase/update rights, support expectations and exact licensing terms still need specification. None of these introduces a hosted-library dependency into Phase 1.

## 4. Ownership and resource feasibility

| Owner | Proposed responsibility |
| --- | --- |
| Core team | Runtime contracts, installer, platform defects, and compatibility policy. Ownership and support of official packages still need confirmation. |
| Module author/community | Module behavior, device compatibility evidence, module documentation, and troubleshooting. |
| Library operator | Web-library maintenance is handled separately from community module creation. Publisher accounts, artifact hosting, reports, withdrawals, and service incidents need a named owner. |

These are responsibilities, not an assumption that three separate teams exist. Name the actual owner and available capacity for each before public launch.

**D2 agreed scope:** The workload ceiling of 1 is mainly aimed at community module creation: users should be able to create modules with little recurring core-team involvement. Web-library maintenance is handled separately. This ceiling is not a combined limit on all platform and library maintenance.

The implementation should prioritize self-service templates, contracts, the module-builder-skill, and in-app tools so community creators do not routinely need the core team to implement their modules. D4 places initial human spam/content moderation after publication, with community management as the end goal. Named library-service, initial moderation, and official-package ownership/support still need confirmation.

## 5. Delivery phases — agreed 2026-10-27

Deliver the work in two phases. Phase 1 must be useful independently of Phase 2.

### Phase 1: local Module Builder

- Build the extension runtime and dynamic hardware, device setup, and workflow contributions, including the agreed full-host-access capability.
- Extract the current hard-coded capabilities into installable default packages and prove removal/restoration.
- Store drafts, installed releases, configuration, and activation state locally.
- Provide in-app code editing, templates, previews, tests, packaging, local activation, import, and export. Support externally generated code guided by the planned module-builder-skill. No CLI actions.
- Allow manual package sharing and installation on another instance without a public account or publication.
- Keep the existing local demo library as a development/test fixture for real download, uninstall, reinstall, and activation checks. It does not include the production publishing or reputation service.

Phase 1 acceptance: a user can create or import support for a previously unsupported sensor, test and activate it on a Pi without core-source edits, export the package, and install it on another instance. Default packages also satisfy the existing lifecycle/parity checks. Verify the pre-install/update device/log export prompt and a user-directed restore of the exported managed state after a failed extension change. Installed local functionality does not depend on the hosted library.

### Phase 2: web-hosted library, publishing and commerce

- Deliver centrally hosted package artifacts and public discovery/download pages.
- Add publisher accounts/profiles and self-service publishing from the app.
- Add module ratings, aggregate builder ratings, download counts, and library search/sorting.
- Add automated publication checks and initial human post-publication moderation for spam/inappropriate uploads, with community-managed moderation as the end goal. Define reports/withdrawals and the separately maintained service's ownership; evaluate optional AI-assisted checks.
- Connect the local Module Builder to the service for publication, discovery, and installation through the same package model.
- Deliver commerce as required Phase 2 scope: purchases, contributor payouts/refunds, official-package entitlements, inspectable release source and installed-version offline use. Define provider and commercial terms before implementation; commerce is not an optional follow-up phase.

Phase 2 acceptance: one independent author publishes a module, another user finds, inspects, purchases and installs it, the contributor payout/refund flow is verified, reputation information is available, and installed paid capabilities continue working when the library is unavailable, subject to any external services the module itself requires.

Define the package identity, versions, compatibility metadata, and artifact format during Phase 1 so the hosted service can use them later. Local import/export and the demo download fixture exercise that boundary without requiring production library accounts, publishing, or ratings in Phase 1.

### Mapping the existing milestones

The phase split is agreed. Other detailed scope recommendations remain pending the open decisions; the implementation plan now records the phase boundary without treating those recommendations as accepted.

| Existing milestone | Proposed adjustment | Evidence needed |
| --- | --- | --- |
| M1: lifecycle proof — Phase 1 | Keep the HTTP device/Fetch block vertical slice and real local-demo-library download. Introduce starter tooling once contracts work. | Removal, download, activation, restart, configuration/history preservation, and missing-package behavior work through the real installer. |
| M2: default capability parity — Phase 1 | Keep extraction across hardware, device setup, and workflows; prioritize schema-driven UI. Test an independently authored module before every default package has migrated. | A new physical sensor/driver works on a Pi without core-source edits or a core release; all defaults eventually meet parity. |
| M3: local authoring proof — Phase 1 | Provide in-app editing, templates, previews, tests, packaging, activation, import/export, and external AI-assisted generation guided by the module-builder-skill. No CLI actions. Develop basic authoring alongside extraction. | Another contributor generates/imports module code using their own harness and our skill, edits and checks it in the app, then packages and installs it on a second instance without a module CLI or public library. |
| M4: hosted library and commerce — Phase 2 | Add self-service publication, discovery, reputation, required purchases/payouts/refunds/offline entitlements, and separately maintained service operations. | An independent author publishes; another user inspects, purchases, installs and activates; payout/refund handling works; installed paid versions continue offline. |

The HTTP slice proves installation plumbing; it does not prove the unsupported-sensor outcome. Keep both that hardware acceptance test and the original eventual default-package extraction requirement.

## 6. Decisions between the core developer and AI on unresolved workshop questions

This section records follow-up decisions made between the core developer and AI about scope and implementation questions that the exported workshop research did not fully resolve. These are subsequent clarifications, not decisions attributed to the original workshop participants. Entries still marked open remain undecided.

D1, D2's workload scope, D3's required Phase 2 commerce, D4's moderation rollout, D5's initial UI scope, D6's app-level ownership, D7's user-directed lifecycle/export recovery, and the two-phase delivery split are agreed. D3's detailed commercial policies remain open, as do D8 and detailed check/moderation policies. Actual platform support values and app-wide export/restore implementation are app-level work. D8 is deliberately left open without a commitment to restricted redistribution enforcement. Publishing, ratings, moderation and commerce are Phase 2 work. Named service ownership and official-package ownership/support remain follow-ups to D2. A working recommendation is not a team decision.

| ID | Decision question | Working recommendation | Agreed outcome |
| --- | --- | --- | --- |
| D1 | Where do code editing, AI-assisted generation, and module tools belong? | Reflected in the agreed creation journey above. | **Agreed 2026-10-27:** Code editing is available in the app. Users generate code in their own AI harness with our planned module-builder-skill. The app provides templates, previews, tests, packaging, activation, and publishing. No CLI actions will be built. |
| D2 | What does core-workload ceiling 1 cover, and how is library maintenance handled? | Keep community module creation self-service; track platform and library responsibilities separately. | **Scope agreed 2026-10-27:** The low workload target mainly applies to community module creation. The web library will be maintained separately. Named service ownership and official-package ownership/support remain to be confirmed. |
| D3 | Is commerce included in Phase 2, and which commercial/offline rights apply? | Required paid official distribution with inspectable release source, offline entitlements, and publisher identity. Do not promise strong copy protection. | **Confirmed 2026-10-28:** Commerce is included in Phase 2, not optional. Includes purchases, contributor payouts/refunds and installed-version offline entitlements. Provider, pricing/subscriptions and detailed entitlement terms remain open; redistribution licensing remains D8. |
| D4 | What must pass before publication, and when is human review required? | Automated acceptance checks; no human publication-approval gate. Define checks, moderation rules, owners, and transition criteria. | **Rollout agreed 2026-10-27:** Initially, human moderation after publication filters spam and inappropriate uploads. End goal: community-managed review/moderation with automated checks; AI-assisted checks are an option to evaluate. No mandatory human pre-publication review or code-safety certification. |
| D5 | Are schema-defined forms, guides, and wizard steps enough initially? | Defer arbitrary custom UI until a required example demonstrates the need. | **Agreed 2026-10-27:** Yes. Start with schema-defined forms, guides, and wizard steps; defer arbitrary custom UI until a concrete required example demonstrates the need. |
| D6 | Who defines supported runtimes, Pi/OS/architecture combinations, and app-version policy? | Inherit Edge Studio's app-wide policy; declare and check individual module compatibility. | **Ownership agreed 2026-10-27:** This is an Edge Studio-wide decision, not a separate Module Builder support matrix. Actual support values remain app-level work; the builder supplies compatibility metadata and checks. |
| D7 | What installation/update/recovery guarantees are required? | Simple user-directed lifecycle actions, a pre-install/update backup prompt using app-wide exports, and tested user-directed restore. | **Agreed 2026-10-27:** Prompt users to back up through planned Export device/Export logs functionality before any extension installation/update. Keep manual updates, compatibility checks, retained configuration/history, disable/uninstall/reinstall, and documented recovery. Restore uses the app-wide backup/restore functions; arbitrary privileged host changes are not universally reversible. |
| D8 | What package/source formats, licenses, and redistribution/fork rights apply? | Preserve inspectable release source for the agreed paid-module direction. Do not rely on enforcing restricted redistribution; retain clear provenance and attribution. | **Left open 2026-10-27:** No mandatory restrictive license or strong redistribution enforcement is adopted. Exact licenses, redistribution/fork rights, and accepted package formats remain undecided. |

For each resolution, record the date, agreed scope, owner where relevant, and the consequence for the implementation plan. Leave unresolved entries open instead of treating the working recommendation as accepted.

## 7. After the decisions

Revise the existing implementation plan with agreed scope, acceptance criteria, milestones, supported targets, and ownership. Reassess path requirement assumptions against that concrete proposal and actual implementation evidence. Preserve the original workshop exports; a later comparison should be a separate revision.

Record durable architecture decisions through the repository's ADR workflow once agreed.
