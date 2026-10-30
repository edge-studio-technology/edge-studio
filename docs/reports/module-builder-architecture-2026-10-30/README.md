# Module Builder architecture pack

**Date:** 2026-10-30 · **Status:** review draft, not an implementation or release sign-off.

Edge Studio's [PRD](../../../tasks/prd-module-builder.md) is the product authority. This pack covers both required phases. Open policies remain open; no vendors, runtime matrix, license, receipt format, hosted topology or delivery dates have been selected.

- [High-Level Design](HLD.md): scope, business responsibilities, baseline, target, integration boundaries, deployment and transition gates.
- [Low-Level Design](LLD.md): logical contracts, state, persistence, operation sequencing, failure handling and verification obligations. Wire schemas and dependent implementation decisions remain explicitly incomplete.
- [Requirements traceability](traceability.md): all 42 FRs, user stories, error cases and backlog features.
- [Assumptions, gaps and contradictions](decisions-and-gaps.md): nine PRD decision gates, additional design gaps and reconciliation requirements.
- [Sources and method](sources-and-method.md): source inventory, PDF page references, hashes, TOGAF tailoring and diagram conventions.
- [Verification record](verification.md): checks performed on this pack and their limits.

## PNG architecture infographics

Every diagram is a standalone 2600 × 1600 PNG. The target diagrams describe required responsibilities and logical contracts, not deployed services. Shared colours identify business (yellow), application (blue), technology (green), data (lavender) and unresolved/security concerns (amber). State and phase are written explicitly; colour alone carries no status.

| PNG | View / audience | Read with |
| --- | --- | --- |
| [01 Current state](diagrams/01-current-state.png) | Baseline application cooperation; management and platform team | HLD §3 |
| [02 Target layered architecture](diagrams/02-target-layered.png) | Typed ArchiMate subset; all stakeholders | HLD §4 |
| [03 Transition and release gates](diagrams/03-transition-roadmap.png) | Required outcomes and dependencies; management | HLD §8 |
| [04 Local components and interfaces](diagrams/04-local-components.png) | Logical service boundaries; engineering | LLD §2–3 |
| [05 Data and retention](diagrams/05-data-model.png) | Logical data associations; engineering and security | LLD §4 |
| [06 Lifecycle and execution boundary](diagrams/06-lifecycle.png) | Separate state dimensions and acknowledgement; operators | LLD §5–7 |
| [07 Install and interruption flow](diagrams/07-install-flow.png) | Guarded activity flow; engineering and QA | LLD §6–7 |
| [08 Deployment and trust boundaries](diagrams/08-deployment.png) | Baseline deployment versus target additions; operations | HLD §6–7 |
| [09 Hosted commerce and offline operation](diagrams/09-hosted-commerce.png) | Phase 2 online exchanges and local continuity; management and engineering | LLD §10–11 |
| [10 Runtime data flows](diagrams/10-runtime-data-flows.png) | Inputs, configured execution, service effects, retained results and exports; engineering and security | HLD §6; LLD §3–7 |

![Target layered architecture](diagrams/02-target-layered.png)

## Reproduction

The diagrams are rendered from [build_diagrams.py](build_diagrams.py) using Pillow. No generated imagery or AI-rendered text is used. Run with Python 3.12+ and Pillow available: `python docs/reports/module-builder-architecture-2026-10-30/build_diagrams.py`. The renderer checks text fit and emits a PNG inventory with SHA-256 hashes. It uses installed Windows Segoe UI fonts, with DejaVu Sans as a fallback; font substitution can change pixels.

[validate_pack.py](validate_pack.py) checks local links, requirement/decision rows, source fingerprints and PNG integrity. [validation-results.json](validation-results.json) records the scoped result; it is distinct from the failed repository-wide docs lint.

The supplied sources are incomplete as a standards set: there is no standalone ArchiMate standard and the TOGAF PDF is a corrigendum rather than the full standard. Attempts to retrieve official online references were blocked by sign-in/403 responses. The applied guidance is grounded in the supplied cookbook, playbook and corrigendum; formal full-standard conformance has not been established. See the source register before treating this as a standards-certified model.
