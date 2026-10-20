# Module Builder: stakeholder discussion

**Date:** 2026-10-20
**Status:** Discussion material; implementation has not started.
**Companion:** [Implementation plan](../module-builder.md).

This document preserves questions and alternatives from the research that are absent from, or only briefly covered by, the implementation plan. It does not introduce approved implementation commitments. Durable implementation decisions should be recorded in ADRs when adopted; the current security policy remains unchanged until implementation updates it.

## 1. Agreed direction and the question for stakeholders

Module Builder turns Edge Studio into a locally extensible application. Users can write, import, download, activate, and remove packages that contribute hardware capabilities, device setup, and workflow blocks. Packages can remain private and local; publication to a centrally hosted public library is optional.

Full host access is an explicit product decision, including arbitrary privileged hardware-agent code. The initial research recommended restricted execution and broker-enforced capabilities. That recommendation was superseded by the user's full-host-access requirement. Separation into processes or containers can help operations, but must not be marketed as protection against a root-capable extension.

The delivery direction is agreed. The stakeholder discussion concerns delivery gates, ownership, supported environments, and the later public-library operating model. It is not a claim that a production marketplace is included in the first milestone.

## 2. What this adds to the implementation plan

| Research point | Coverage in the plan | Additional discussion here |
| --- | --- | --- |
| Local extensibility and optional central publishing | Agreed scope | Distinguish developer freedom from central publication eligibility |
| A complete authoring experience | Planned tools | Audience needs, adoption/support, documentation and examples |
| Public package pages and publisher accounts | Deferred after local demo | Identity, source visibility, licensing, namespace ownership, moderation |
| Central storage and distribution | Future-compatible demo protocol | Catalog, object storage/CDN, OCI artifacts, build infrastructure |
| Immutable releases and pinned execution | Included | Signing, key compromise, withdrawal and offline advisories |
| Permission-based execution | Superseded by full host access | Honest trust communication and dependency trust |
| Custom UI beyond generated forms | Hooks included | Schema-only, arbitrary UI, and hybrid tradeoffs |
| Compatibility, updates, rollback | Included | Support matrix, auto-update policy and maintenance responsibility |
| Stakeholder value | Implicit | Expected benefits and observable evidence without invented ROI |
| Similar platforms | Not developed | Verified precedents and limits of the analogy |

## 3. Expected value and evidence

For operators, modules make device choices and workflows installable without rebuilding the app. For developers, a stable contract and local tools reduce the need to modify core feature folders. For the product team, default extensions become reference implementations and the same library can later distribute community work.

These are expected benefits, not measured outcomes. The first evidence is a real existing capability removed, downloaded, and restored with its original configuration and history. Later evidence is a new device and block created through the authoring tools and installed on another instance without core-source edits. Track how many core changes that requires, setup completion, failed activations, recovery results, and maintenance effort. Set targets after baseline measurement; no dates, staffing estimate, adoption forecast, or financial return has been established.

## 4. What similar projects demonstrate

The following are documented platform behaviors. The lessons for Edge Studio are our interpretation, not claims that those projects endorse this design. Sources were checked on 2026-10-20.

| Project | Documented approach | Interpretation for Edge Studio | Limit of comparison |
| --- | --- | --- | --- |
| Node-RED | Custom nodes extend the palette; packages can contain runtime code, editor resources, examples, and dependency/version metadata; distribution uses npm and the Flow Library. [S1](https://nodered.org/docs/creating-nodes/), [S2](https://nodered.org/docs/creating-nodes/packaging) | Ship behavior, configuration, documentation, and examples together; prove local packaging early. | Our central library will host artifacts rather than depend on npm as the sole artifact store. |
| Home Assistant | Integration manifests describe integrations and dependencies; separate apps declare architectures, device mappings, host access, and privileges. [S3](https://contributors.home-assistant.io/core/integrations/manifest/), [S4](https://contributors.home-assistant.io/apps/reference/configuration/) | Separate device semantics from runtime installation and host operations, even if one package contributes both. | Its supervisor and protection modes are not an implementation we can assume already exists here. |
| VS Code | Manifests declare extension contributions and compatibility; extension hosts execute code in supported locations. Desktop extension hosts inherit the application's permissions. [S5](https://code.visualstudio.com/api/references/extension-manifest), [S6](https://code.visualstudio.com/api/advanced-topics/extension-host), [S7](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security) | Stable contribution contracts and publisher trust fit an open system. | Our root-capable modules can exceed the privileges of an ordinary desktop editor. A separate host is not proof of sandboxing. |
| TUF | Signed, versioned, expiring metadata binds artifacts to trusted keys and addresses several repository/update attacks. [S8](https://theupdateframework.io/docs/overview/) | Evaluate an established update-trust framework before inventing central distribution security. | Artifact integrity/provenance does not establish code safety or reverse host changes. |

## 5. Alternatives: runtime and host integration

| Option | Pros | Cons | Position |
| --- | --- | --- | --- |
| Load all code into the backend or root agent process | Simple direct calls; low protocol overhead | Crashes and dependency conflicts affect the core; difficult independent restart/uninstall | Avoid as the default; do not make this the public extension contract |
| Supervised host processes/services with full access available | Fits privileged setup, arbitrary languages and existing helpers; independent health/restart | Host dependencies and setup effects require ownership and recovery handling | Recommended first execution path for host capabilities; exact protocol still to be designed |
| Container-packaged runtimes | Bundles dependencies; clearer runtime versions and multi-language support | Architecture-specific builds; device mapping and privileged access add complexity; shared kernel | Useful supported packaging path, not a mandatory sandbox claim |
| Restricted runtime and broker-only hardware/API access | Stronger enforceable boundaries when genuinely restricted | Cannot satisfy unrestricted host access; more policy work and compatibility limits | Initial research alternative, not the selected product requirement; could be an optional future mode |

An extension with root access can read credentials, alter app policy, or damage the host. The product should support this freedom while describing the installation as trusting host software. Administrative confirmation and package identity help users make that decision; they do not technically constrain root code. Docker likewise treats daemon control as highly sensitive. [S9](https://docs.docker.com/engine/security/)

## 6. Alternatives: package scope and UI

| Decision | Option and benefits | Costs | Working recommendation |
| --- | --- | --- | --- |
| Package boundaries | One package per individual contribution enables fine selection | More dependencies and difficult ownership | Package coherent capabilities; allow multiple device/block/hardware contributions |
| Package boundaries | One large default bundle simplifies initial install | Removal is coarse; obscures missing dependency behavior | Use several meaningful default packages, with exact boundaries set by inventory |
| Configuration UI | Schema-only forms provide consistent validation and easy previews | Cannot express every guide, hardware tool, or interaction | Default to schemas; keep versioned custom UI hooks |
| Configuration UI | Arbitrary UI supports sophisticated tools | More compatibility, accessibility and support work | Treat custom UI as a supported integration contract, not arbitrary injection into every core component |
| Runtime language | TypeScript-first tooling matches the app | Less convenient for existing Python hardware code | Offer a strong first authoring path without making the runtime protocol language-specific |
| Runtime language | All languages with equally rich tooling from day one | Broad build, debug and support scope | Package supported runtimes; expand tooling based on real modules |

## 7. Alternatives: migration and library foundations

| Option | Pros | Cons | Position |
| --- | --- | --- | --- |
| Rewrite hardware, Devices and canvas together | Consistent new design at the end | Large regression surface; lifecycle assumptions discovered late | Avoid; migrate through working slices |
| Extract one existing capability end to end | Tests contracts, download, missing states, persistence and reinstall early | Temporary adapters need removal criteria | Selected starting approach |
| Keep built-ins as a permanent fallback | Easier initial compatibility | Uninstall can appear successful while hidden code still runs | Reject; default packages must use the real extension path |
| Link the library to external repositories only | Cheap hosting; familiar developer workflow | Mutable/deleted upstream artifacts and fragmented installation | Useful source links, not the chosen central artifact-hosting model |
| Host catalog and immutable artifacts ourselves | Consistent releases, discovery, support and integrity checks | Storage, bandwidth, moderation and operational responsibility | Selected eventual model; local demo first |
| Embed an existing workflow platform | Mature ecosystem and tools | May change workflow semantics, persistence and UX; hardware/device integration remains | Consider only after a separate integration spike; not part of the agreed plan |

The HTTP JSON Source plus Fetch block is the first lifecycle slice. It does not prove privileged hardware behavior. The next evidence must include a real hardware package on a Pi, and the full migration must cover every current capability.

## 8. The public library is an operated service

The original research proposed more than a searchable list. A production service would need the following, after the local lifecycle works:

| Service area | Responsibilities | Decision still needed |
| --- | --- | --- |
| Publisher identity | Accounts, scoped credentials, namespace ownership, account recovery | Who can publish, and how are publisher ownership disputes resolved? |
| Catalog and public pages | Search, compatible releases, source links, license, support, changelog, declared privileges | Is source publication mandatory, or are source links/binary-only packages permitted? |
| Artifact distribution | Immutable package/source storage, CDN; OCI distribution where container images are supported | Hosting provider, retention, maximum artifacts, operating budget |
| Validation and builds | Manifest checks, archive safety, secret scanning, tests, isolated optional source builds | Accept prebuilt artifacts, offer hosted builds, or both? |
| Trust and integrity | Digests, signatures, signing-key rotation, release metadata | TUF adoption and separation of publisher and registry signing responsibilities |
| Governance | Reports, withdrawals, vulnerability advisories, maintainer contact, appeals | Immediate publication, review before listing, or a staged trust model? |
| Support | Compatibility policy, abandoned packages, dependency advisories | Who owns official packages, and what support applies to community modules? |

Publication is optional, but publication eligibility need not be unrestricted. Local developers may run their own code even when it would not qualify for public listing. A verified publisher badge, automated-check badge, and manual-review badge should describe separate facts. None should imply that root-capable code is guaranteed safe.

VS Code documents publisher trust and several marketplace checks. This is a precedent for treating ecosystem operations as product work, not evidence that our demo needs all of its controls immediately. [S7](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security)

## 9. Update, withdrawal and offline policy

The plan already calls for immutable releases, version pinning, and staged activation. The later public service still needs policy choices:

| Alternative | Advantages | Disadvantages |
| --- | --- | --- |
| Manual updates by default | Operator controls timing, privilege changes and hardware disruption | Security fixes require operator action |
| Automatic updates | Faster distribution and lower maintenance effort | New code can change host behavior; migrations and side effects complicate rollback |
| Advisories and blocked new downloads | Preserves local operator control and offline continuity | Already-installed vulnerable packages may keep running |
| Automatic remote disable/removal | Can respond rapidly to a known malicious release | Can stop physical workflows and conflicts with offline/local autonomy; root changes may remain |

Working recommendation: manual activation initially, visible dependency/privilege changes, and explicit advisories. Do not introduce a remote kill policy without a product decision. New downloads should fail closed if their integrity cannot be verified. Previously installed local execution should not require a live registry connection. Define stale advisory/trust metadata behavior separately from ordinary offline operation.

## 10. Operating and support responsibilities

Name owners before offering a public ecosystem: platform contract/versioning, official default packages, hardware compatibility, public service operations, security response, and developer documentation. These can be roles rather than new hires; staffing remains unestimated.

Choose a supported Raspberry Pi OS, CPU architecture, and runtime matrix before promising that all uploaded code runs everywhere. Source import, build success, compatible installation, and physical hardware validation are separate outcomes. Builds that execute third-party code must use isolated disposable environments without infrastructure or publishing credentials.

Uninstall is not a promise of restoring the original host. Package-owned files/services can be tracked; arbitrary host modifications and physical effects cannot always be reversed. Backups, a recovery path that avoids auto-starting extensions, known-good package sets, and a documented reinstall procedure should be assessed against realistic failures.

## 11. Milestones and decision gates

Presentation milestones group the implementation plan's steps; they are not additional workstreams or date commitments.

| Presentation milestone | Plan steps | Exit evidence |
| --- | --- | --- |
| M1: Prove the lifecycle | 1-2 | Existing HTTP device/block works; uninstall makes it unavailable; real download, install and activation restore configuration/history; restart preserves state |
| M2: Make defaults dynamic | 3-6 | All current capabilities have real package owners; hardware parity verified; zero-extension core works; complete default set can be restored |
| M3: Prove authoring | 7 | A new block and hardware/device capability built with the tools work on another instance without core-source edits |
| M4: Operate a public library | Future product phase | Publishing, central artifacts, trust, governance, support and funding decisions resolved; public beta criteria defined |

M1 should unlock further migration only after its acceptance checks pass. M2 and authoring work can overlap once contracts stabilize. M4 planning can proceed earlier, but a production public library is not part of the local demo exit gate.

## 12. Stakeholder discussion prompts

1. Who owns the first lifecycle proof and the official default packages?
2. Which Pi OS/architecture/runtime combinations receive first-class support?
3. What evidence is required before expanding from M1 to all capabilities?
4. What support and recovery promise can we make for full-host-access extensions?
5. What publication/review and source-visibility policy should the future public library use?
6. Who funds and operates the public service, signing, moderation, and incident response?
7. Which update/withdrawal policy preserves the intended local operator control?

The next engineering deliverable remains the inventory/contracts and first working lifecycle slice. Delivery estimates should follow that investigation. These discussion questions do not reopen the user's decision to support full host access.
