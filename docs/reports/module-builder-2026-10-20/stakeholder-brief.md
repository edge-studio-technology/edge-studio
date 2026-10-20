# Module Builder: stakeholder presentation source

**Prepared:** 2026-10-20. **Audience:** mixed product, business, and technical stakeholders.
**Format:** 16:9 editable PowerPoint; approximately 15-20 minutes plus discussion. Slides 19-22 are optional appendix material.
**Status:** Proposed delivery; implementation not started. No budget, staffing, schedule, or ROI commitment is implied.

The presentation draws on the [implementation plan](../../plans/module-builder.md) and [discussion](../../plans/module-builder/discussion.md). Milestone labels below group the plan's implementation steps. External comparisons are based on official documentation; their implications for Edge Studio are our interpretation.

## 01 | Module Builder
Layout: cover
Kicker: EDGE STUDIO / STAKEHOLDER DISCUSSION
Subtitle: From fixed capabilities to an open extension platform
Takeaway: Build locally. Add capabilities. Share optionally.

### The direction
Hardware agent + device setup + workflow blocks

### The first proof
Remove an existing capability. Download it. Restore it.

Notes: Introduce Module Builder as an evolution of the current application. The plan is documented but implementation has not started. Full host access is intentional. The initial delivery proves local extensibility; a production public marketplace is a later phase.

## 02 | Adding capabilities currently means changing the app
Layout: cards
Kicker: THE PROBLEM
Subtitle: Hardware, device setup, and workflows are defined across compiled frontend and backend code.
Takeaway: Every new choice should arrive as an installable package.

### Hardware support
Fixed capability branches for Camera, GPIO, Sensors, and MQTT.

### Device setup
Templates, forms, wizard choices, and guides are compiled into the app.

### Workflow blocks
Types, configuration, validation, presentation, and execution use fixed mappings.

Notes: This is a repository finding, not an industry-wide claim. A new picker alone does not solve extensibility: runtime behavior, validation, configuration, and help must also move to package contracts. The expected benefit is fewer core edits for new capabilities; no reduction in effort has yet been measured.

## 03 | One module can connect the whole experience
Layout: package
Kicker: THE PRODUCT MODEL
Subtitle: A package may contribute one feature or a complete device-to-workflow experience.
Takeaway: Definitions, executable behavior, guides, and examples travel together.

### Hardware adapter
Read a sensor, operate a device, or expose events.

### Device setup
Add a card, configuration fields, connection test, and guide.

### Workflow blocks
Add actions, data operations, triggers, and starter workflows.

Notes: Use an air-quality sensor as an illustrative future module. Its code, setup experience, and blocks share a package identity and version. Packages can also contain only a preset or a block. Configured instances and secrets remain separate from distributable package definitions. Exact default-package boundaries follow the inventory.

## 04 | The direction is agreed; delivery details remain open
Layout: split
Kicker: DECISION STATUS
Subtitle: Keep the product ambition separate from unresolved operating choices.
Takeaway: Local freedom is agreed. Public-library policy still needs design.

### Agreed direction
Full host access, including the hardware agent.
Dynamic hardware, Devices, and workflow contributions.
Removable default packages and a real local demo library.
Local authoring; optional central publication.

### Still to define
Runtime tooling and package boundaries.
Supported OS and architecture matrix.
Public publishing, review, and update policies.
Owners, cost, staffing, and delivery estimates.

Notes: Do not ask stakeholders to reapprove the full-host-access product requirement. Ask them to align on sequencing and operating responsibility. Recommendations later in the deck are discussion proposals unless the implementation plan already commits to them. App runtime behavior has not changed.

## 05 | Established platforms offer useful patterns
Layout: cards
Kicker: EXTERNAL PRECEDENTS
Subtitle: Use proven extension patterns while keeping Edge Studio's local and hardware focus.
Takeaway: Borrow contracts and lifecycle ideas; preserve our workflow semantics.

### Node-RED
Packages extend the node palette with behavior, editor resources, and examples.
Lesson: package the complete capability.

### Home Assistant
Integration manifests describe devices; separate apps declare runtime and host needs.
Lesson: distinguish device semantics from host operations.

### VS Code
Manifests declare contributions; extension hosts execute code.
Lesson: stable contracts plus clear publisher trust.

Notes: These are documented behaviors; the lessons are our interpretation. This is not a recommendation to embed any of these platforms. Node-RED distributes through npm and its Flow Library; our planned library hosts artifacts centrally. Home Assistant has its own supervisor model. VS Code's desktop permissions are not equivalent to root access on a Pi.
Sources:
- https://nodered.org/docs/creating-nodes/
- https://nodered.org/docs/creating-nodes/packaging
- https://contributors.home-assistant.io/core/integrations/manifest/
- https://contributors.home-assistant.io/apps/reference/configuration/
- https://code.visualstudio.com/api/references/extension-manifest
- https://code.visualstudio.com/api/advanced-topics/extension-host

## 06 | Full host access means trusting host software
Layout: trust
Kicker: AN INTENTIONAL PRODUCT CHOICE
Subtitle: A module may run privileged code, install dependencies, and extend the hardware agent.
Takeaway: Process separation improves operations; it does not constrain root-capable code.

### Freedom
Custom drivers, languages, setup logic, services, and hardware operations.

### Responsibility
The operator trusts the module and its dependencies with the host and its data.

### Honest controls
Show identity and access; manage activation, logs, backups, and recovery.

Notes: The earlier research recommended restricted execution; the user deliberately selected full host access. A root-capable module can bypass application policy and reach credentials. Do not describe manifests or containers as enforcing a security boundary against that module. VS Code documents that desktop extensions inherit the application's permissions, illustrating why publisher trust matters. Our host privileges can be broader still. Signing verifies origin/integrity, not harmless behavior.
Sources:
- https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security
- https://docs.docker.com/engine/security/

## 07 | Keep a small core that can restore every extension
Layout: architecture
Kicker: TARGET ARCHITECTURE
Subtitle: Dynamic contributions enter through versioned contracts and an extension manager.
Takeaway: The app must remain recoverable with zero extensions installed.

### Permanent application core
Authentication, package management, generic UI/canvas, persistence, execution history, recovery.

### Installed contribution registry
Hardware capabilities, device definitions, wizard steps, blocks, guides, and templates.

### Supervised runtimes
Package entry points and services; full host access available for trusted extensions.

### Local demo library
Real catalog and immutable downloads. Later: the same distribution model hosted centrally.

Notes: This diagram describes responsibilities, not a sandbox boundary. The app owns generic orchestration and persistence; packages provide the choices and handlers. The core installer and recovery controls cannot themselves disappear when defaults are removed. An installed module should run without a live library connection. Transport/runtime details remain to be designed.

## 08 | Default capabilities become ordinary packages
Layout: migration
Kicker: USE THE PRODUCT TO PROVE THE PLATFORM
Subtitle: Existing implementations become the first extension library and reference examples.
Takeaway: No hidden built-in fallback after a capability is uninstalled.

### Today
Hard-coded choices inside hardware, device, and automation features.

### Extract
Give each capability an owner, contract, version, configuration, and lifecycle.

### Default extensions
Camera, GPIO, Sensors, MQTT, HTTP, webhook, system data, and workflow contributions.

Notes: The inventory sets final package boundaries and identifies shared dependencies. Wallet and Integritas services may stay in the application while their workflow contributions become packages. Existing source IDs, block IDs, configuration, secrets, and histories must survive. Default packages use the same installation path as future community modules and must stay removed across restart/update when the operator removes them.

## 09 | M1: prove one complete lifecycle before scaling
Layout: milestone
Kicker: FIRST DELIVERY GATE / PLAN STEPS 1-2
Subtitle: Start with HTTP JSON Source device setup and its Fetch block contribution.
Takeaway: Expand only after the original configuration and behavior are restored.

### 01 / Baseline
Configure the device and run a workflow.

### 02 / Remove
Uninstall; show missing device and block states.

### 03 / Download
Retrieve real package bytes from the separate local library.

### 04 / Activate
Install and activate the compatible release.

### 05 / Verify
Restore behavior, preserve history, and survive app restart.

Notes: M1 groups inventory/contracts and the first implementation slice; it is not merely the inventory checklist item. Verify that uninstall really removes the contribution, rather than falling back to core code. Missing devices/blocks retain configuration. The extension manager remains available. This HTTP slice does not prove privileged hardware; that is required in M2. This is planned acceptance evidence, not a completed demo.

## 10 | M2: migrate all defaults and verify real hardware
Layout: cards
Kicker: PLATFORM PARITY / PLAN STEPS 3-6
Subtitle: Repeat the proven lifecycle across hardware, device setup, and workflow capabilities.
Takeaway: A working HTTP demo is the start; hardware parity is a separate gate.

### Dynamic hardware
Package Camera, GPIO, I2C Sensors, and Local MQTT, including setup and repair.

### Dynamic experience
Load device forms/guides and block configuration/behavior from installed packages.

### Complete restoration
Remove all extensions, retain a usable core, then reinstall the default set.

Notes: Pi verification must cover actual devices, prerequisite jobs, event subscriptions, camera media hashing, shared resources, reboot requirements, failed hooks, and persisted state. Existing workflow order, budgets in ordinary app service calls, error ownership, watch/replay, and history should retain parity. Privileged module code can bypass app protections; do not claim otherwise.

## 11 | M3: prove that developers can extend the app
Layout: journey
Kicker: AUTHORING TOOLS / PLAN STEP 7
Subtitle: Begin tooling once the first contracts and lifecycle work; overlap with later migration.
Takeaway: A new module must work on a second instance without core-source edits.

### Create
Start from templates, or import source and supported runtimes.

### Develop
Edit code/schemas; preview setup and blocks; inspect tests and logs.

### Release
Package an immutable version; activate locally or export it.

### Share
Install on another instance; optionally publish when the public service exists.

Notes: My Modules, Builder, and Library are the main user areas. Keep local drafts separate from active releases. Create both a new workflow block and a new hardware/device capability using the tools as acceptance evidence. Source import does not guarantee a compatible executable artifact. Testing root-capable hooks can affect the host; a disposable test target is a separate environment, not a simulated safety guarantee.

## 12 | The library starts locally and grows into a service
Layout: split
Kicker: DISTRIBUTION SCOPE
Subtitle: Separate the lifecycle demo from operating a public extension ecosystem.
Takeaway: Central hosting distributes modules; local execution remains independent.

### Local demo / in plan
Separate catalog service with real downloads.
Versioned default packages and compatible installs.
Offline local activation and execution.
No public accounts or moderation required.

### Public service / later
Publisher accounts and public package pages.
Central package/image storage and distribution.
Signing, checks, reporting, and advisories.
Operational ownership, policy, and funding.

Notes: The first library is real local infrastructure, not mocked catalog data or shared installed files. A production library also needs namespace ownership, source/license policy, immutable artifacts, build security, key management, and support. Public publishing is optional for module authors. M4 is a future phase, not a committed expansion of M1. TUF is a candidate for update-trust design, not an adopted implementation.
Sources:
- https://theupdateframework.io/docs/overview/

## 13 | Compare the practical implementation choices
Layout: options
Kicker: RECOMMENDATIONS FOR DISCUSSION
Subtitle: Keep host freedom while choosing maintainable contracts and packaging.
Takeaway: Start with supervised runtimes and generated UI; retain extension hooks.

### In-process plugins
Benefit: direct calls.
Cost: shared failures.
Position: avoid as default.

### Supervised host runtimes
Benefit: host freedom.
Cost: dependency ownership.
Position: first host path.

### Container runtimes
Benefit: bundled dependencies.
Cost: ARM/device setup.
Position: packaging option.

Notes: These options do not change the agreed full-host-access requirement. Separate processes are an operational choice. UI recommendation: schemas for common forms and previews, versioned custom UI for advanced interactions. TypeScript-first authoring could match the app, while the protocol remains language-neutral; the plan does not yet select one final runtime implementation.

## 14 | Prove extensibility without losing existing users' work
Layout: cards
Kicker: ACCEPTANCE AND RECOVERY
Subtitle: Preserve configured instances and observable behavior through removal and reinstall.
Takeaway: Uninstall removes a capability; data deletion is a separate action.

### Preserve
Keep IDs, device settings, secrets, workflows, and execution history.

### Explain
Render missing-package placeholders with clear restoration steps.

### Recover
Exercise restart, interrupted installs, failed setup, version conflicts, and backups.

Notes: Exact package versions/digests bind workflow execution. An in-flight run keeps its resolved version; changes activate at a safe boundary. Code rollback does not reverse state migrations, root setup scripts, payments, or physical effects. Unknown outcomes need investigation and operation IDs, not blind retries. The demonstration must include real behavior and Pi tests; a visually complete canvas is insufficient evidence.

## 15 | Delivery gates control scope and investment
Layout: roadmap
Kicker: SEQUENCE / NO DATE COMMITMENT
Subtitle: Each gate produces evidence that supports the next delivery decision.
Takeaway: Estimate broader delivery after contracts and M1 expose the real coupling.

### M1 / Lifecycle proof
Inventory + contracts + HTTP slice + local download/reinstall.

### M2 / Default parity
All capability families packaged; physical hardware and restoration verified.

### M3 / Authoring proof
New block and device built in-app and installed on a second instance.

### M4 / Public service
Future phase: publishing, central operations, trust, governance, and support.

Notes: M1 maps to plan steps 1-2; M2 to 3-6; M3 to 7. M4 comes from the broader vision and discussion, not the current local-demo implementation scope. Authoring can overlap M2 once contracts stabilize. There is no invented schedule, headcount, or cost saving in this proposal. Owners and acceptance evidence should be named before implementation expands.

## 16 | Ecosystem maintenance is part of the product
Layout: cards
Kicker: OWNERSHIP TO ASSIGN
Subtitle: An open extension system creates continuing responsibilities beyond the editor.
Takeaway: Keep the first gate narrow; identify owners before public publishing.

### Platform ownership
Contracts, compatibility, core recovery, documentation, and default packages.

### Hardware support
Supported OS/CPU/runtime matrix and physical validation for official packages.

### Public operations
Hosting, publisher support, key management, moderation, and incident response.

Notes: These are responsibilities, not a staffing request with a known estimate. Discuss whether maintainers support only official packages or also troubleshoot community modules. Measure authoring effort and activation/recovery outcomes before setting targets. Open publication eligibility and local execution freedom are different policy decisions.

## 17 | Align on the next gate and the operating questions
Layout: decision
Kicker: STAKEHOLDER DISCUSSION
Subtitle: Keep the approved product direction; make the next delivery decision concrete.
Takeaway: Proceed through a bounded lifecycle proof, then review evidence.

### Next delivery discussion
Assign the M1 owner and agree on its acceptance demonstration.
Choose the initial supported test environment.
Review M1 evidence before broad capability migration.

### Later policy discussion
Who maintains official and community packages?
What publishing/review and source policy fits the public library?
Who funds operations, and what update/withdrawal policy preserves operator control?

Notes: This slide is a meeting prompt, not a claim that approval or staffing was obtained. Full host access and the dynamic extension direction are already specified by the user. Exact runtime contracts and implementation effort remain discovery work. Stakeholders can discuss future public policies now without adding them to the first demo gate.

## 18 | The proof is a capability that returns intact
Layout: closing
Kicker: MODULE BUILDER / EDGE STUDIO
Subtitle: Remove it. Download it. Activate it. Keep the user's work.
Takeaway: Then use the same platform to build something new.

### First evidence
An existing device and block restored from a real local library.

### Platform evidence
Every default capability installable; new modules created without core edits.

Notes: Close on the observable result rather than marketplace ambition. The implementation plan remains not started. Refer the audience to the appendix for comparison details, future library tradeoffs, and primary sources.

## 19 | Appendix: what to borrow, and where the analogy stops
Layout: cards
Kicker: PLATFORM COMPARISON
Subtitle: Similar projects solve parts of this problem; none remove our integration work.
Takeaway: The contracts are the reusable idea; our lifecycle still needs proof.

### Node-RED
Borrow: a package with runtime, editor help, and examples.
Difference: our library owns central artifact delivery.

### Home Assistant
Borrow: distinct integration metadata and host-runtime configuration.
Difference: our supervisor is new work.

### VS Code
Borrow: contribution contracts and an extension host.
Difference: our root-capable modules carry broader host trust.

Notes: These comparisons are qualitative architectural interpretations of official documentation, not benchmarks. See discussion section 4 for the documented facts and their limits. We are not estimating ecosystem size, project quality, or comparative development costs.
Sources:
- https://nodered.org/docs/creating-nodes/packaging
- https://contributors.home-assistant.io/core/integrations/manifest/
- https://contributors.home-assistant.io/apps/reference/configuration/
- https://code.visualstudio.com/api/references/extension-manifest
- https://code.visualstudio.com/api/advanced-topics/extension-host

## 20 | Appendix: public-library policy choices
Layout: cards
Kicker: ALTERNATIVES TO RESOLVE LATER
Subtitle: Each choice balances developer access, operator control, and service responsibility.
Takeaway: Publication rules can be stricter than local module execution.

### Publication
Immediate listing: fast access, greater moderation exposure.
Review first: slower access, more operating work.

### Updates
Manual activation: operator timing, slower patch uptake.
Automatic activation: faster fixes, more disruption risk.

### Withdrawal
Advisories: operator control, installed risk remains.
Remote disable: faster response, can interrupt real devices.

Notes: Working recommendation is manual activation initially, explicit trust information, advisories, and a separately agreed public moderation model. No remote kill policy has been approved. Signing and scanning provide useful signals but are not a guarantee of harmless behavior. An outage of the library should not prevent already-installed modules from running locally.

## 21 | Appendix: official research sources
Layout: sources
Kicker: PRIMARY SOURCES / CHECKED 20 OCT 2026
Subtitle: External facts are sourced; Edge Studio recommendations are our interpretation.
Takeaway: Detailed citations and alternatives are in the companion discussion document.

### Node-RED / custom nodes and packaging
https://nodered.org/docs/creating-nodes/
https://nodered.org/docs/creating-nodes/packaging

### Home Assistant / integrations and apps
https://contributors.home-assistant.io/core/integrations/manifest/
https://contributors.home-assistant.io/apps/reference/configuration/

### VS Code / contributions and extension execution
https://code.visualstudio.com/api/references/extension-manifest
https://code.visualstudio.com/api/advanced-topics/extension-host
https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security

Notes: All research used primary documentation. Source links are also included in the relevant slides' speaker notes. Preserve the distinction between documented platform behavior and proposed Edge Studio design.

## 22 | Appendix: trust and internal references
Layout: sources
Kicker: SUPPORTING MATERIAL
Subtitle: The plan defines delivery; the discussion records unresolved choices and alternatives.
Takeaway: Current application security policy changes only when implementation lands.

### TUF / update metadata and repository trust
https://theupdateframework.io/docs/overview/

### Docker / daemon control and host exposure
https://docs.docker.com/engine/security/

### Repository documents
Implementation: docs/plans/module-builder.md
Discussion: docs/plans/module-builder/discussion.md
Presentation source: this stakeholder brief

Notes: The plan is the current delivery reference, while the companion discussion is working material rather than an adopted ADR. M4/public-service details are future discussion. The original restricted-only runtime recommendation was superseded by the explicit full-host-access requirement. No application code was changed to prepare this presentation.
