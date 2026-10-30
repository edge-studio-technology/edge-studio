# Sources, provenance and modelling method

## Source register

Page references below mean **PDF page index starting at 1**, not printed page numbers. Original PDFs remain in the supplied folder and are not redistributed in this pack.

| ID | Source and identity | Authority / use |
| --- | --- | --- |
| S1 | [Module Builder PRD](../../../tasks/prd-module-builder.md), created 2026-10-30 | Product authority: scope, terms, roles, all FRs, lifecycle/error cases, phases, metrics and open decisions |
| S2 | [ArchiMate Cookbook](../architecture-docs/ArchiMate-Cookbook.pdf), Eero Hosiaisluoma; cover v1.0, modified 2022-08-05; PDF metadata created 2024-10-02; 66 pages | Non-normative recipes. §1.2 p.4 cites ArchiMate 3.2. Use actual file content without conflating cover and PDF-generation dates |
| S3 | [The Agile Enterprise Architect Playbook](<../architecture-docs/The Agile Enterprise Architect Playbook.pdf>), Open Group Guide G226, v1.0, November 2022; 47 pages | Supporting guide: iterative minimum viable/transition architectures, stakeholder collaboration and fit-for-purpose documentation |
| S4 | [TOGAF Standard, 10th Edition Technical Corrigendum 1](<../architecture-docs/The TOGAF® Standard, 10th Edition Technical Corrigendum 1.pdf>), U254, May 2025; 28 pages | Corrections to Fundamental Content C220, not the full TOGAF Standard. Apply relevant corrected terms; do not assert full normative coverage |
| S5 | [Project shape](../../../.agents/rules/project-shape.md), [PROJECT](../../PROJECT.md), [SECURITY](../../../SECURITY.md), [Compose](../../../docker-compose.yml), [README](../../../README.md), [.env.example](../../../.env.example), backend Dockerfile and reviewed source features | Baseline implementation evidence only; code/document inspection, no live deployment verification |
| S6 | [ADR 0019](../../adr/0019-hardware-access-through-host-helpers.md), [implementation plan](../../plans/module-builder.md), [workshop revision](../../plans/module-builder/workshop-revision.md) | Existing host design and future migration context subordinate to S1. Plan proposals do not become selected bindings through inclusion here |

### Supplied PDF SHA-256 fingerprints

- S2: `2f4579c054e1efadf10de90ede92c57e626f6d3c584b3a227cb79f2d7590d998`
- S3: `19cb2da0a2c4d18040ea56f23e045590e968093d1d81c3db476ed3ae145c84f0`
- S4: `617ad12f38f417c1084625f9e443db9a76dbe5350eff9d52c98b3f36564e315f`

No standalone ArchiMate standard PDF or full TOGAF standard was present in the supplied directory. Supplemental official references were attempted on 2026-10-30: [ArchiMate relationships](https://pubs.opengroup.org/architecture/archimate32-doc/ch-Relationships.html), [TOGAF ADM](https://pubs.opengroup.org/togaf-standard/adm/), [TOGAF overview](https://www.opengroup.org/togaf) and [ArchiMate overview](https://www.opengroup.org/archimate-forum/archimate-overview). Access failed through sign-in redirects/inaccessible pages or HTTP 403. Those links are access-attempt records, **not read evidence**. The pack does not claim external text was verified or that normative ArchiMate relationship tables were validated.

## Applied TOGAF / playbook guidance

| Source location | Application in this pack |
| --- | --- |
| S4 p.4, Introduction §3.6 | Distinguish required logical capabilities/ABBs from actual implementation choices/SBBs; logical target responsibilities do not choose runtimes/hosting |
| S4 pp.6–7, ADM §13.3–13.4 | Use **Requirements Impact Assessment** when changing requirements; PRD/ticket updates and impacted design/gates stay linked |
| S4 pp.8–9, gap analysis/migration artifacts | Identify current-to-target gaps and dependencies; roadmap is evidence-gated, no invented delivery dates |
| S4 p.11, Architecture Content §3.6.2 | Separate stakeholder catalog (HLD §2) from concern-to-view mapping; identify architecture customers without inventing named owners |
| S4 pp.14–16, governance | Describe review obligations and business stakeholders; no claim of completed formal architecture contract or full compliance |
| S3 §2.4, pp.24–26 | Fit governance to change risk; document ownership, expectations and decision review points |
| S3 §3.2, p.28 | Minimum Viable Architecture and Transition Architecture: M1 slice → complete local platform → hosted/commerce, with every required phase retained |
| S3 §3.3, pp.29–30 | Stakeholder-specific views and business outcomes: management infographic versus engineering contracts/evidence |
| S3 §3.4, pp.31–32 | Coherent baseline/target views and fit-for-purpose scope; explicit gaps/risk and early decision needs |
| S3 §4.1, pp.38–40 | Incremental review/learning without reducing mandatory final release gates |
| S3 §4.2, pp.41–43 | Markup documents plus diagrams; enough information for the next decision, without claiming a mandated TOGAF HLD/LLD template |

The HLD/LLD split is a practical delivery structure; it is not a claim that TOGAF mandates those exact templates. No ISO edition text is inferred from the corrigendum, and no ADM cycle diagram is reproduced. Architecture governance is distinct from the explicitly excluded mandatory human review of each module release.

## Applied cookbook and ArchiMate guidance

| Cookbook section / PDF pages | Applied view |
| --- | --- |
| §1.1 p.4; §§3–4 pp.38–45 | Small vocabulary; explicit structure/behaviour/data types and relation semantics |
| §2.2.5 pp.14–15 | Transition roadmap, diagram 03; implementation outcomes and dependencies |
| §2.3 pp.16–21 | Layered business/application/technology overview, diagram 02 |
| §2.4 pp.22–23 | Current/target cooperation and information exchanges, diagrams 01/04/09/10 |
| §§2.6–2.7 p.25 | Conceptual/logical data object associations, diagram 05; no invented SQL types/cardinalities |
| §2.8 p.26 | Technology/deployment boundaries, diagram 08; logical hosting separated from concrete baseline |
| §§2.9.1–2.9.2 pp.27–29 | Logical application structure and interfaces, diagram 04; component != service != interface |
| §§2.9.5–2.9.6 pp.32–34 | Explicit messages/steps, diagrams 07/09/10; detailed activity flow is labelled an engineering supplement |

### Notation and scope of claims

Diagram 02 uses a deliberately small **typed ArchiMate subset**: Business Role, Application Service, Application Component, Technology Service and Node. Colour identifies layer, explicit type text identifies concept. Application components realize application services (dashed line, hollow triangular head); services serve consuming roles/components (solid line, open arrow). Technology services serve application components; nodes realize technology services. These simplified direct relations follow the cookbook patterns. No generic data arrow is silently treated as serving. Full normative model/relationship validation remains G-08.

Other diagrams are **management or engineering supplements informed by cookbook viewpoints**, not formal ArchiMate models: solid labelled arrows carry requests, messages or prerequisite/transition direction; diagram 05 lines are undirected conceptual associations without unspecified cardinalities; diagram 07 is an ordered activity flow, not UML timing notation; diagram 08 boxes are deployment/trust zones, not claims of security confinement. Each PNG has its own notation/state/phase note.

Node containment in deployment drawings means location/hosting; logical responsibilities can share a deployment. All target titles say target or required; baseline and target additions in diagram 08 occupy separate labelled lanes. Amber decision panels flag unsettled policy or privilege, not readiness status. Diagrams omit wire details intentionally; LLD records those gaps.

## Source handling and limits

PDF text was locally extracted for review; this pack paraphrases relevant concepts and creates original diagrams rather than copying standard figures or extended passages. Source hashes identify the exact supplied files. PRD scope takes precedence over generic reference examples. The existing backlog is referenced only as the PRD's recorded snapshot, not live status. The documents and diagrams provide no evidence that module runtime, hardware, restore, hosted service or commerce gates have passed.
