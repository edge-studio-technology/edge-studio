# Assumptions, gaps and contradictions

**Disposition:** unresolved unless explicitly stated otherwise in the [PRD](../../../tasks/prd-module-builder.md). This register does not accept new product policies. Suggested decision roles are copied from the PRD; no person has been appointed by this report.

## Assumptions and interpretation limits

| ID | Assumption / limit | Basis and consequence |
| --- | --- | --- |
| A-01 | PRD dated 2026-10-30 is the governing product baseline | PRD §1.1; older plans/demo terms do not override it |
| A-02 | Repository files reviewed describe a design-time baseline, not actual deployed health/configuration | No SSH/runtime audit requested or performed; current-state observations are qualified accordingly |
| A-03 | C1–C6 and hosted boxes group logical responsibilities | Not invented microservices, deployment units or selected technologies; actual bindings need design decisions |
| A-04 | Cookbook's referenced ArchiMate 3.2 vocabulary is the modelling reference for this pack | Cookbook p.4; standalone normative standard missing; no claim about the latest edition or formal conformance |
| A-05 | HLD/LLD delivery can proceed with documented holds | PRD §9 expressly permits specification work while isolating dependencies; a dependent milestone cannot pass unresolved gates |

## PRD decision gates — all remain open

| Gate | Required decision preserved from PRD | Blocks / suggested decision roles |
| --- | --- | --- |
| OQ-01 | Export device coverage/exclusions, protected credential handling, restore targets/versions and whether explicitly continuing without an export is allowed | Lifecycle UX and restore acceptance; app product owner, security, engineering |
| OQ-02 | App-wide supported app/runtime/Pi/OS/architecture versions; module-supported subsets | Compatibility contracts and physical test matrix; Edge Studio product/engineering |
| OQ-03 | Source/artifact formats, dependency rules, app-driven build/package routes, source association and compatibility/integrity rules; no required CLI | M1/M3 final contracts; platform engineering/product |
| OQ-04 | Exact automated blocking checks/limits/content rules, report/removal handling, optional AI-check value and community transition criteria | Hosted publication/moderation launch; library product/service owner, moderation, engineering |
| OQ-05 | Rating eligibility/abuse and successful-download event/counting rules including retries, users/devices, tests, withdrawn/deleted modules and ownership transfers | Reputation launch; library product/engineering |
| OQ-06 | Commercial model/provider/markets/currencies/tax/compliance/fees, payouts/refunds/disputes, source inspection before purchase, update/re-download/post-refund rights | Commerce launch and paid UX; business/product, finance/legal, engineering |
| OQ-07 | App and module licenses, fork/redistribution rights; MPL/Apache recommendation is not adopted | Public release terms; rights holders, product, legal |
| OQ-08 | Named official-package/service/moderation owners, backups, incident/report handling, community handover | Hosted operating readiness; engineering/service leadership, product |
| OQ-09 | Website-to-instance handoff/import and account flow preserving explicit authenticated install/activation | Phase 2 UX completion; product/design/engineering |

## Technical design gaps to refine

These are specification tasks, not additional product scope or newly decided requirements.

| ID | Missing detail | Impact and required refinement |
| --- | --- | --- |
| G-01 | Executable contract bindings | Select manifest/schema dialect/version syntax and limits, namespaces, runtime ABI/transport/authentication, errors/deadlines, consent scope/lifetime, dependency/cycle resolution, archive rules and migration semantics; OQ-02/03 remain prerequisites |
| G-02 | Persistent layout, retention and capacity | Define artifact/draft/state paths, local schema/constraints, evidence/log/history retention, artifact retention for runs, quotas/disk handling, backup protection and deletion rules; preserve PRD defaults and OQ-01 |
| G-03 | Hosted non-functional targets/topology | Define hosting/regions/scale, availability/latency targets, backup schedule/RPO/RTO, alerting and privacy/data-retention/compliance requirements with owners; PRD has no numerical commitments |
| G-04 | Transaction/concurrency/reconciliation protocols | Specify locks and install/update/disable/uninstall interactions with in-flight runs, active-selection commit and state migration, crash journal/worker observation, cancellation, non-replay rules and provider event/financial deduplication |
| G-05 | Identity and version/state mapping | Resolve legacy contribution aliases, simultaneous installed/active-version policy, local publisher to hosted identity mapping, module state schema compatibility, ownership transfers and exact rights multiplicities |
| G-06 | Library API/query and display details | Select DTOs/routes, sort ties/pagination, source inspection presentation, availability/report visibility and account/handoff flow; OQ-04/05/06/09 apply |
| G-07 | Complete existing capability inventory and parity evidence | Current PRD/plan names some families but supplies no completed choice-to-package inventory, actual default artifacts or passing M2 results; do not treat example families as exhaustive |
| G-08 | Complete standards source set | Folder lacks standalone ArchiMate standard and full TOGAF standard; official online access failed. Supply licensed/accessible full texts or perform independent standards review before formal compliance claims |

## Contradictions and reconciliation

No internal PRD contradiction was established in this review. The following are source/baseline conflicts or unresolved tensions; they must not be silently resolved by diagram wording.

| ID | Conflicting statements / apparent tension | Treatment in this pack |
| --- | --- | --- |
| C-01 | Current ADR 0019/SECURITY/project rules permit fixed host actions and prohibit arbitrary shell paths; PRD FR-04 requires arbitrary privileged module code/setup | Current and target drawn separately. During implementation deliberately replace the fixed dispatcher and update ADR/security/project rules and mirrors together; keep backend non-root and authenticated package dispatch. No runtime change made here |
| C-02 | Demo backup/unsigned entitlement/source/publish screens versus FR-10/27/37–42 real evidence | Demo is inert frontend evidence of journey intent. It does not satisfy restoration, source delivery, money movement, real module or hardware gates |
| C-03 | Supplied material described as TOGAF and ArchiMate standards versus actual PDFs | Corrigendum is corrections to a missing base text; cookbook/playbook are guidance. Pack states partial source coverage, without substituting guide text for a normative standard |
| C-04 | Earlier journey/session wording called commerce optional; PRD §1/FR-37–40/M4c makes it mandatory | PRD controls; Phase 2 cannot finish with only publication/discovery/reputation |
| C-05 | Earlier MPL/Apache recommendation versus PRD FR-40/OQ-07 unselected license | No license chosen. Inspectability, purchase rights and copyright/redistribution remain separate |
| C-06 | PRD requires inspectable paid source but leaves pre-purchase source access unselected | Preserve source/version association; mark buyer inspection access dependent on OQ-06. Do not claim either universal pre-purchase access or paid-source secrecy |
| C-07 | Withdrawal blocks new official downloads while retrieval/post-refund rights remain unsettled | Keep installed offline execution; hold exact existing-purchaser retrieval/refund behaviour for OQ-06; do not add a license heartbeat |
| C-08 | Recovery availability/preserved data versus full-host-privileged modules | Recovery is contingent on operable host/app; no guarantee against malicious privileged code or arbitrary OS/hardware modification |

## Review exit conditions

This report is reviewable now. It is not final implementation authorization for unresolved policies. Decision participants should resolve each dependency before its affected contract/milestone is finalized, update PRD/tickets together, record engineering decisions in the project's ADR process when adopted, and refresh traceability. Standards review and real acceptance evidence remain separate activities.
