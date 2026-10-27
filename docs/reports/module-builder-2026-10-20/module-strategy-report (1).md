# Team meeting workshop

Long-term vision · Facilitated research workshop
Exported: 2026-10-27T12:18:58.032Z

Participants: Rasmus, Patrik, Adam
Creators: A mix of skill levels
Operators: A mix of skill levels

## Scope and outcomes
1. A user should be able to write code that can interface with edge studio.
2. A user should be able to Identify (if already exist), (otherwise can) create, drivers for devices.
3. Monitize shareable user extensions

Success: A user identifies that there are no support for a sensor inbuilt, they create or find on the marketplace support for it.
Out of scope: IDE
Environments: Depends on Edge studio app
Commercial scope: Part of the long-term vision

## Team capability profile
| Dimension | Desired level | Importance | Interpretation | Discussion |
| --- | --- | --- | --- | --- |
| Contribution breadth | 4/5 | Essential | At least this level |  |
| Operator guidance | 1/5 | Important | At least this level |  |
| Creator tools | 5/5 | Important | At least this level |  |
| UI customization | 3/5 | Important | At least this level |  |
| Sharing and distribution | 5/5 | Important | At least this level |  |
| Validation depth | 1/5 | Important | At least this level |  |
| Lifecycle and recovery | 2/5 | Important | At least this level |  |
| Contributor independence | 5/5 | Important | At least this level |  |

## Scale definitions
### Contribution breadth
What should people outside the core team be able to contribute?
1. No external contribution; the team implements requests
2. Device presets, mappings, and guides
3. Device integrations and reusable workflow blocks
4. New drivers, protocols, and executable logic
5. Cross-surface extensions: drivers, logic, and custom experiences

### Operator guidance
How guided should installing and using capabilities be?
1. Technical documentation and manual setup
2. Examples and a documented setup checklist
3. Guided configuration with some manual steps
4. A mostly guided setup and troubleshooting experience
5. End-to-end discovery, setup, testing, and helpful recovery

### Creator tools
What tools should we provide to people creating contributions?
1. Documentation; contributors use their own tools
2. Reference implementations and starter templates
3. A supported SDK/CLI with validation and packaging
4. An in-app editor with configuration and previews
5. A complete module workspace: templates, preview, tests, packaging, and publishing

### UI customization
How much should a contribution be able to change the user experience?
1. Use the existing UI without adding fields or screens
2. Add presets and values to existing forms
3. Define forms, setup guides, and wizard steps
4. Provide custom block editors and device interactions
5. Provide new views and experiences across the app

### Sharing and distribution
How far should self-service distribution go?
1. Capabilities ship only in core app releases
2. Manual file sharing or repository links
3. Independent versioned packages with install/import support
4. A curated catalog with managed delivery and updates
5. A public self-service library with publisher profiles and reputation

### Validation depth
How much evidence should be required before a contribution is usable?
1. Basic manifest/schema and format checks
2. Author checks and documented manual tests
3. Repeatable functional tests and an explicit review process
4. Automated compatibility checks, regression tests, and release checks
5. Qualification on supported hardware plus ongoing compatibility verification

### Lifecycle and recovery
How much should the system manage after installation?
1. Manual replacement and recovery
2. Documented installation/removal and backup procedures
3. Version tracking, compatibility checks, and preserved configuration
4. Dependency handling, pinned versions, staged updates, and recovery
5. A managed lifecycle with health, recovery, migrations, and verified restoration

### Contributor independence
How independently should contributors be able to release and maintain additions?
1. The core team implements and releases every addition
2. Contributors submit changes; the team reviews and releases
3. Authors maintain contributions with regular core-team involvement
4. Independent releases with limited curation or integration support
5. Self-service creation, distribution, and maintenance without core releases

## Constraints and responsibilities
- Independent contributed code: required
- Contributor full host access: required
- Drivers without core releases: required
- Public self-service library: required
- Offline operation: required
- Maximum platform build investment: 4
- Maximum ongoing core-team workload: 1
- Maximum creator technical skill: 3
- Maximum distribution service operations: 3
- Validation owner: Hybrid: automated checks, authors, and core/community review
- Support owner: Community

## Comparison
| Path | Constraint status | Weighted gap (0 best, 4 maximum) | Included answers | Assumption confidence |
| --- | --- | --- | --- | --- |
| Full module builder | conflict | 0.00 | 8/8 | Low |
| Developer SDK and CLI | conflict | 0.59 | 8/8 | Low |
| Curated extension packages | conflict | 0.71 | 8/8 | Low |
| External adapters | conflict | 1.06 | 8/8 | Low |
| Community contributions to core | conflict | 1.18 | 8/8 | Medium |
| Declarative device profiles | conflict | 1.29 | 8/8 | Medium |
| We develop everything ourselves | conflict | 2.18 | 8/8 | Medium |

Fit is a weighted gap, not a probability or a measured success prediction. Importance weights are Optional=1, Important=2, Essential=3. Minimum needs penalize only shortfalls; target needs penalize distance in either direction. Unanswered/unresolved dimensions are excluded. Constraints are assessed first; no score overrides a conflict. Unspecified path features under a constraint require review. Resource levels are relative workshop assumptions, not sprint or cost estimates. Approaches can be combined.

## We develop everything ourselves
Contribution: Users request capabilities; our team implements and ships them in the core app.
Advantage: Smallest new extension-platform investment and one controlled release process.
Limitation: Every new capability remains dependent on the team's time and release queue.
Assumption: Low platform investment does not mean low ongoing device-development effort. UI scores describe external contributions; operators can still get a polished built-in experience.

- Contribution breadth: 1/5. No external extension contract is offered.
- Operator guidance: 5/5. The team can ship integrated, guided built-in experiences.
- Creator tools: 1/5. No external creator tooling is assumed.
- UI customization: 1/5. Users cannot add their own interface through a module.
- Sharing and distribution: 1/5. Capabilities arrive with app releases.
- Validation depth: 4/5. Assumes core-team review and release regression checks; actual depth must be agreed.
- Lifecycle and recovery: 4/5. Assumes the existing app update and recovery path is maintained.
- Contributor independence: 1/5. All implementation and releases depend on the core team.
- Platform build investment: 1/5
- Ongoing core-team workload: 5/5
- Creator technical skill: 5/5
- Distribution service operations: 1/5
- Independent contributed code: Not included
- Contributor full host access: Not included
- Drivers without core releases: Not included
- Public self-service library: Not included
- Offline operation: Included
- CONFLICT: Independent contributed code: required, but not included in this path profile.
- CONFLICT: Contributor full host access: required, but not included in this path profile.
- CONFLICT: Drivers without core releases: required, but not included in this path profile.
- CONFLICT: Public self-service library: required, but not included in this path profile.
- CONFLICT: Ongoing core-team workload: draft requirement 5 exceeds the team's ceiling 1.
- CONFLICT: Creator technical skill: draft requirement 5 exceeds the team's ceiling 3.

## Community contributions to core
Contribution: Drivers, devices, and workflow blocks contributed through pull requests.
Advantage: Low platform investment; our team reviews and releases everything.
Limitation: The core team remains the review and release bottleneck.
Assumption: A pull request can change almost any core feature, but that is not an independently installed module. Host access here means independently contributed runtime code, not reviewed core source.

- Contribution breadth: 5/5. Core-source contributions can add drivers, protocols, blocks, and UI.
- Operator guidance: 4/5. Merged contributions use the existing guided app experience; polish depends on review.
- Creator tools: 2/5. Assumes contribution guides, examples, and repository tooling.
- UI customization: 5/5. Contributors can propose new core views and editors.
- Sharing and distribution: 1/5. Accepted work still ships through the core release process.
- Validation depth: 4/5. Core maintainers gate review and test checks.
- Lifecycle and recovery: 4/5. Contributions inherit the app lifecycle rather than a separate module lifecycle.
- Contributor independence: 2/5. Authors can contribute but cannot bypass core review/release ownership.
- Platform build investment: 2/5
- Ongoing core-team workload: 5/5
- Creator technical skill: 5/5
- Distribution service operations: 1/5
- Independent contributed code: Not included
- Contributor full host access: Not included
- Drivers without core releases: Not included
- Public self-service library: Not included
- Offline operation: Included
- CONFLICT: Independent contributed code: required, but not included in this path profile.
- CONFLICT: Contributor full host access: required, but not included in this path profile.
- CONFLICT: Drivers without core releases: required, but not included in this path profile.
- CONFLICT: Public self-service library: required, but not included in this path profile.
- CONFLICT: Ongoing core-team workload: draft requirement 5 exceeds the team's ceiling 1.
- CONFLICT: Creator technical skill: draft requirement 5 exceeds the team's ceiling 3.

## Declarative device profiles
Contribution: Configuration, mappings, setup guides, and starter workflows for existing protocols.
Advantage: Many devices become supportable without running contributed code.
Limitation: Cannot introduce a new driver or protocol.
Assumption: Assumes schema-defined configuration and manual profile sharing. A hosted catalog or visual authoring form would be extra scope.

- Contribution breadth: 2/5. The contribution is data for existing protocols, not a new executable driver.
- Operator guidance: 4/5. Profiles can generate guided configuration and setup instructions.
- Creator tools: 2/5. Assumes schemas/examples; no full in-app editor is included.
- UI customization: 3/5. Fields, guides, and wizard metadata can be declared.
- Sharing and distribution: 2/5. Profile import/export and repository/file sharing are assumed.
- Validation depth: 3/5. Schemas and repeatable configuration checks are feasible; behavior still needs testing.
- Lifecycle and recovery: 3/5. Profile versions and saved configuration can be tracked without executable package migrations.
- Contributor independence: 3/5. Authors can maintain profiles, but new protocol support still depends on the team.
- Platform build investment: 2/5
- Ongoing core-team workload: 3/5
- Creator technical skill: 2/5
- Distribution service operations: 2/5
- Independent contributed code: Not included
- Contributor full host access: Not included
- Drivers without core releases: Not included
- Public self-service library: Not included
- Offline operation: Included
- CONFLICT: Independent contributed code: required, but not included in this path profile.
- CONFLICT: Contributor full host access: required, but not included in this path profile.
- CONFLICT: Drivers without core releases: required, but not included in this path profile.
- CONFLICT: Public self-service library: required, but not included in this path profile.
- CONFLICT: Ongoing core-team workload: draft requirement 3 exceeds the team's ceiling 1.

## External adapters
Contribution: Separate services exposing hardware through HTTP or MQTT.
Advantage: Contributors choose their language and dependencies; Edge Studio stays simpler.
Limitation: Installing and operating the adapter adds work for users.
Assumption: Assumes locally running adapters and documented HTTP/MQTT contracts. Adapter installation, privileges, and validation vary by deployment; full host access needs discussion.

- Contribution breadth: 4/5. Adapters can implement new drivers and protocols behind existing transports.
- Operator guidance: 2/5. Users must install/configure another service.
- Creator tools: 2/5. Examples and adapter contracts are assumed; contributors use external tools.
- UI customization: 1/5. The app uses its existing HTTP/MQTT interface.
- Sharing and distribution: 2/5. Adapter artifacts are shared separately, without an app package catalog.
- Validation depth: 2/5. Assumes author/manual integration tests, not a central qualification service.
- Lifecycle and recovery: 2/5. The user or adapter operator handles service updates and recovery.
- Contributor independence: 4/5. Adapters can be released independently of core changes.
- Platform build investment: 2/5
- Ongoing core-team workload: 2/5
- Creator technical skill: 5/5
- Distribution service operations: 2/5
- Independent contributed code: Included
- Contributor full host access: Unspecified
- Drivers without core releases: Included
- Public self-service library: Not included
- Offline operation: Included
- CONFLICT: Public self-service library: required, but not included in this path profile.
- CONFLICT: Ongoing core-team workload: draft requirement 2 exceeds the team's ceiling 1.
- CONFLICT: Creator technical skill: draft requirement 5 exceeds the team's ceiling 3.
- REVIEW: Contributor full host access: the path's configuration is unspecified.

## Curated extension packages
Contribution: Executable integrations installed through a small package manager.
Advantage: Independent releases without an in-app editor or public marketplace.
Limitation: Still requires runtime contracts, compatibility checks, and recovery.
Assumption: Assumes reviewed packages, metadata-driven UI, and a real installer. Runtime permissions and custom UI are unspecified, not guaranteed.

- Contribution breadth: 4/5. Executable package handlers can add drivers and workflow behavior.
- Operator guidance: 3/5. The installer helps, but rich setup guidance is not guaranteed.
- Creator tools: 2/5. Authors use documentation/templates and their own editor.
- UI customization: 3/5. Assumes metadata-driven forms and guides; custom views are extra work.
- Sharing and distribution: 3/5. Packages are versioned and installed independently; no public marketplace is included.
- Validation depth: 3/5. Assumes a curated review process and repeatable package checks.
- Lifecycle and recovery: 4/5. Compatibility, dependencies, pinned versions, and recovery are necessary package-manager work.
- Contributor independence: 4/5. Authors release independently, subject to curation and contract compatibility.
- Platform build investment: 3/5
- Ongoing core-team workload: 3/5
- Creator technical skill: 4/5
- Distribution service operations: 2/5
- Independent contributed code: Included
- Contributor full host access: Unspecified
- Drivers without core releases: Included
- Public self-service library: Not included
- Offline operation: Included
- CONFLICT: Public self-service library: required, but not included in this path profile.
- CONFLICT: Ongoing core-team workload: draft requirement 3 exceeds the team's ceiling 1.
- CONFLICT: Creator technical skill: draft requirement 4 exceeds the team's ceiling 3.
- REVIEW: Contributor full host access: the path's configuration is unspecified.

## Developer SDK and CLI
Contribution: Modules built externally with templates, validation, and packaging tools.
Advantage: Tests developer demand before investing in an in-app authoring experience.
Limitation: Requires developer skills and is less accessible to ordinary users.
Assumption: An SDK is authoring infrastructure, not a runtime by itself. This profile assumes a minimal import/runtime contract; combine it with curated packages if appropriate. Host permission policy is unresolved.

- Contribution breadth: 4/5. SDK contracts can expose executable integration points.
- Operator guidance: 2/5. The path targets developers, with more manual operator setup assumed.
- Creator tools: 3/5. Templates, CLI validation, packaging, and examples are explicit scope.
- UI customization: 3/5. Assumes schema-based forms and guides; no arbitrary view system is promised.
- Sharing and distribution: 3/5. Build/import independent artifacts; a public catalog is not assumed.
- Validation depth: 3/5. CLI checks and integration tests validate contracts, not all hardware behavior.
- Lifecycle and recovery: 3/5. A minimal compatible package runtime is assumed; managed recovery needs extra scope.
- Contributor independence: 4/5. External authors can build and version modules without core releases.
- Platform build investment: 3/5
- Ongoing core-team workload: 3/5
- Creator technical skill: 5/5
- Distribution service operations: 2/5
- Independent contributed code: Included
- Contributor full host access: Unspecified
- Drivers without core releases: Included
- Public self-service library: Not included
- Offline operation: Included
- CONFLICT: Public self-service library: required, but not included in this path profile.
- CONFLICT: Ongoing core-team workload: draft requirement 3 exceeds the team's ceiling 1.
- CONFLICT: Creator technical skill: draft requirement 5 exceeds the team's ceiling 3.
- REVIEW: Contributor full host access: the path's configuration is unspecified.

## Full module builder
Contribution: The complete planned platform: hardware, device setup, workflow extensions, authoring, and a public library.
Advantage: The broadest self-service creation and distribution experience.
Limitation: Largest platform and ecosystem operating commitment; broad code freedom adds trust responsibilities.
Assumption: Describes the long-term plan, not the current mockup. Stronger authoring tools do not automatically deliver stronger validation. Full host access reflects the earlier proposed design and is deliberately open to challenge in this workshop.

- Contribution breadth: 5/5. The proposed contracts span drivers, protocols, device setup, blocks, and custom UI.
- Operator guidance: 5/5. The vision includes discovery, setup, testing, and restoration guidance.
- Creator tools: 5/5. The complete module workspace is explicit planned scope; this does not require building a general-purpose IDE.
- UI customization: 5/5. Versioned custom UI hooks extend schema-defined experiences.
- Sharing and distribution: 5/5. Public pages, publisher identity, reputation, and independent installation are part of the vision.
- Validation depth: 3/5. The plan includes package checks and testing; full third-party hardware qualification is not established.
- Lifecycle and recovery: 5/5. The plan includes dependency/version management, preserved state, and recovery.
- Contributor independence: 5/5. Authors can create, share, and maintain independent modules, with ecosystem operations still required.
- Platform build investment: 5/5
- Ongoing core-team workload: 4/5
- Creator technical skill: 3/5
- Distribution service operations: 5/5
- Independent contributed code: Included
- Contributor full host access: Included
- Drivers without core releases: Included
- Public self-service library: Included
- Offline operation: Included
- CONFLICT: Platform build investment: draft requirement 5 exceeds the team's ceiling 4.
- CONFLICT: Ongoing core-team workload: draft requirement 4 exceeds the team's ceiling 1.
- CONFLICT: Distribution service operations: draft requirement 5 exceeds the team's ceiling 3.

## Decisions and unresolved issues
Not recorded
