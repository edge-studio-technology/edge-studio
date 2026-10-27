# Full Module Builder: workshop revision and open decisions

**Status:** Discussion draft; D1 and the workload scope in D2 agreed on 2026-10-27. D3-D8 and named ownership remain open; implementation not started.
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
6. Activate locally, export, or publish a version.

Code editing is in scope inside Edge Studio. AI-assisted code generation is expected to happen in the user's own harness, guided by our planned module-builder-skill. The team's expectation that this will account for roughly 99% of generation is a planning assumption, not measured adoption or a requirement to use AI. An in-app AI generation harness is not part of this agreed creation model. The workshop's IDE exclusion does not exclude a code editor or the agreed module tools.

We will not build CLI actions for module creation, testing, packaging, activation, or publishing. Templates, previews, tests, packaging, activation, and publishing belong in the app's supported journey. The implementation of any required source builds remains to be designed within that app-driven flow. Previewing schemas and fixtures must be distinguished from executing privileged code on the real host.

The module-builder-skill is a planned authoring aid, not an implemented feature. It should give the user's AI harness the module contracts, templates/examples, expected file structure, and testing/packaging requirements needed to produce compatible code. Its exact contents and distribution still need definition. No automatic harness connection, project synchronization, or specific AI provider is assumed by this decision.

Provide two authoring routes using the same package model: profile/template authors configure existing protocols, while code authors implement new behavior through documented contracts. Templates can remove boilerplate; they cannot make an unfamiliar hardware driver a moderate-skill task. The skill ceiling must be interpreted separately for these routes.

### UI and runtime

Use schema-defined forms, guides, and wizard steps first. Defer arbitrary custom views and block editors unless a concrete required integration cannot use the initial contracts.

Keep supervised extension processes and full host access available. A privileged package is trusted host software; process separation helps operation and fault handling but does not constrain malicious root code. The initial supported runtime/SDK and target architectures still need selection. An extensible runtime protocol does not imply equally polished tools for every language from the first release.

### Installation and publication

Keep immutable package releases, explicit activation, compatibility checks, retained device/workflow configuration, missing-package states, logs, and disable/uninstall controls. Start with manual version selection and updates. Defer automatic dependency upgrades, staged rollout management, and advanced recovery automation where manual procedures meet the agreed scope.

Basic publication checks should cover package structure and manifest validity. Installer correctness, artifact integrity, failed-install handling, and application regression tests remain necessary. Author testing evidence and reviewer responsibilities must be defined separately. Routine core-team review of every release would conflict with the independence goal.

Initially prefer prepared artifact uploads over a centrally hosted build service. Central hosting still requires publisher identity, immutable downloads, reports/withdrawals, and service ownership. Ratings, download counts, and builder aggregates remain planned reputation features; they do not certify code safety.

### Commercial distribution and offline use

Proposed baseline: purchase/download requires connectivity; an installed purchased version continues working offline. This is not yet an agreed licensing model. Offline operation concerns the platform/library dependency; a module that calls an external service may still require that service.

Commercial distribution adds purchase entitlements, publisher payments, refunds, update eligibility, and support expectations. A fully privileged user-controlled host cannot provide a strong technical guarantee against copying or bypassing local license checks. Decide the commercial promise before designing enforcement. Paid distribution does not by itself settle whether source must be public or whether binary-only artifacts are accepted.

## 4. Ownership and resource feasibility

| Owner | Proposed responsibility |
| --- | --- |
| Core team | Runtime contracts, installer, platform defects, and compatibility policy. Ownership and support of official packages still need confirmation. |
| Module author/community | Module behavior, device compatibility evidence, module documentation, and troubleshooting. |
| Library operator | Web-library maintenance is handled separately from community module creation. Publisher accounts, artifact hosting, reports, withdrawals, and service incidents need a named owner. |

These are responsibilities, not an assumption that three separate teams exist. Name the actual owner and available capacity for each before public launch.

**D2 agreed scope:** The workload ceiling of 1 is mainly aimed at community module creation: users should be able to create modules with little recurring core-team involvement. Web-library maintenance is handled separately. This ceiling is not a combined limit on all platform and library maintenance.

The implementation should prioritize self-service templates, contracts, the module-builder-skill, and in-app tools so community creators do not routinely need the core team to implement their modules. Publication review and approval remain open under D4; this clarification does not settle those rules. Named library-service ownership and official-package ownership/support still need confirmation.

## 5. Proposed changes to implementation sequencing

The existing plan remains unchanged while these recommendations are discussed.

| Existing milestone | Proposed adjustment | Evidence needed |
| --- | --- | --- |
| M1: lifecycle proof | Keep the HTTP device/Fetch block vertical slice and real local-library download. Introduce starter tooling once contracts work. | Removal, download, activation, restart, configuration/history preservation, and missing-package behavior work through the real installer. |
| M2: default capability parity | Keep extraction across hardware, device setup, and workflows; prioritize schema-driven UI. Test an independently authored module before every default package has migrated. | A new physical sensor/driver works on a Pi without core-source edits or a core release; all defaults eventually meet parity. |
| M3: authoring proof | Provide in-app editing, templates, previews, tests, packaging, activation, and publishing, with external AI-assisted generation guided by the module-builder-skill. No CLI actions. Develop basic authoring alongside extraction. | Another contributor generates/imports module code using their own harness and our skill, edits and checks it in the app, then packages and installs it on a second instance without a module CLI. |
| Future M4: public library | Make self-service publication, reputation, and operational ownership explicit. Decide whether payments belong in the first public launch. | An independent author publishes, another user downloads and activates, and installed capabilities keep working without the library. |

The HTTP slice proves installation plumbing; it does not prove the unsupported-sensor outcome. Keep both that hardware acceptance test and the original eventual default-package extraction requirement.

## 6. Decisions to resolve together

D1 and D2's workload scope are agreed; D3-D8 remain open. Named service ownership and official-package ownership/support remain follow-ups to D2. A working recommendation is not a team decision.

| ID | Decision question | Working recommendation | Agreed outcome |
| --- | --- | --- | --- |
| D1 | Where do code editing, AI-assisted generation, and module tools belong? | Reflected in the agreed creation journey above. | **Agreed 2026-10-27:** Code editing is available in the app. Users generate code in their own AI harness with our planned module-builder-skill. The app provides templates, previews, tests, packaging, activation, and publishing. No CLI actions will be built. |
| D2 | What does core-workload ceiling 1 cover, and how is library maintenance handled? | Keep community module creation self-service; track platform and library responsibilities separately. | **Scope agreed 2026-10-27:** The low workload target mainly applies to community module creation. The web library will be maintained separately. Named service ownership and official-package ownership/support remain to be confirmed. |
| D3 | Must the first public library support payments? Which commercial model and offline rights do we promise? | Consider a free initial catalog with commercial distribution later; preserve installed-version offline use. Do not assume subscriptions or continuous license checks. | Open |
| D4 | What must pass before publication, and when is human review required? | Automate basic acceptance checks; require author evidence and define exceptions/reports. Avoid mandatory core review for every routine release. | Open |
| D5 | Are schema-defined forms, guides, and wizard steps enough initially? | Defer arbitrary custom UI until a required example demonstrates the need. | Open |
| D6 | Which runtimes, Pi/OS/architecture combinations, and app versions are supported? What skill level is expected for new-driver authors? | Start with a narrow, tested authoring route and explicit target matrix. Separate template creation from driver development. | Open |
| D7 | What installation/update/recovery guarantees are required? | Keep manual updates and essential compatibility/configuration protection; document backup and recovery. Do not promise reversal of arbitrary privileged host changes. | Open |
| D8 | What package/source formats may be imported and publicly distributed? Must source be available? | Separate arbitrary local development freedom from public-library acceptance. Define source visibility, artifact readiness, and licensing metadata before publication. | Open |

For each resolution, record the date, agreed scope, owner where relevant, and the consequence for the implementation plan. Leave unresolved entries open instead of treating the working recommendation as accepted.

## 7. After the decisions

Revise the existing implementation plan with agreed scope, acceptance criteria, milestones, supported targets, and ownership. Reassess path requirement assumptions against that concrete proposal and actual implementation evidence. Preserve the original workshop exports; a later comparison should be a separate revision.

Record durable architecture decisions through the repository's ADR workflow once agreed.
