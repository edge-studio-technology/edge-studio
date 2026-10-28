# Development estimate basis

Prepared 2026-10-28 for the [user-journey presentation](./presentation-source.md), using the [implementation plan](../../plans/module-builder.md) and [workshop revision](../../plans/module-builder/workshop-revision.md).

These are provisional engineering judgments, not commitments, quotations, industry benchmarks, or a conversion of the workshop's 1–5 resource scores. The production extension system has not been implemented. Re-estimate after M1 using measured integration and migration evidence.

## Capacity and arithmetic

- Assume two full-time engineers: one primarily backend/runtime/hardware, one primarily frontend/tools, with shared integration ownership.
- Assume part-time QA/hardware and infrastructure support is available. Its separate staffing/cost is not priced here; it must actually be allocated.
- An engineer-week is five focused workdays. Engineering effort includes implementation, engineering review, automated tests, documentation, integration and representative physical-Pi acceptance.
- Raw elapsed weeks are effort divided by two. They are a simple capacity calculation, not a guarantee of perfect parallelism.
- Scheduling envelopes add approximately 20% to raw elapsed time, rounded to whole weeks. This is a visible allowance for interruptions/integration, not a statistically calibrated confidence interval.
- Totals conservatively sum milestones; no overlap discount is taken. M3 can begin after M1 contracts stabilize, but parallel work consumes the same engineering capacity.
- Reuse the current application behavior and frontend demo. Do not assume that mocked workflows, backups, packaging, signatures, checkout or publishing already provide production functionality.
- Do not apply an assumed AI productivity multiplier. End-user generation in their own harness is a product decision, not evidence of faster platform delivery.

## Milestone effort and completion evidence

| Phase / milestone | Engineer-weeks | Raw elapsed with 2 engineers | Scope and completion evidence |
| --- | --- | --- | --- |
| Phase 1 prerequisite: app-wide device/log export and restore | 6–10 | 3–5 weeks | Define coverage and credential handling, export managed state and diagnostics, and restore on a test device through a documented recovery route. |
| M1: contracts and lifecycle slice | 8–12 | 4–6 weeks | Inventory capability owners; define package/contribution/runtime contracts; implement storage, installer and supervisor foundation; extract HTTP/Fetch; demonstrate actual local-demo download, uninstall, inactive install, activation, restart and preserved state. |
| M2: default-capability parity | 16–24 | 8–12 weeks | Migrate hardware supervisor, device definitions/setup and workflow execution; extract the existing default packages; preserve legacy IDs/configuration/history; verify missing-module, failure, offline and physical-Pi behavior. |
| M3: local authoring proof | 10–16 | 5–8 weeks | Deliver app editing, templates, module-builder-skill, schema previews, test/log tools, packaging/import/export and explicit activation; an independent author adds a sensor/block and installs it on another instance without core changes or a CLI. |
| M4a: hosting and self-service publication | 10–16 | 5–8 weeks | Publisher accounts, namespaces, immutable artifacts, automated acceptance, catalog/listings, delivery and app integration; establish backups/monitoring and service ownership. |
| M4b: reputation and community tools | 6–10 | 3–5 weeks | Ratings and builder aggregation, download accounting, release-source inspection, reporting and post-publication moderation tooling; prove another user can discover/install and continue offline. |
| M4c: required commerce | 8–14 | 4–7 weeks | One payment-provider integration, a simple purchase model, contributor payouts, refunds, purchase entitlements and a tested offline-receipt path. Commercial policies must be settled first. |

M4a/M4b/M4c are planning subdivisions of M4, not additional product phases. Commerce is a required part of Phase 2, confirmed 2026-10-28. The Phase 2 baseline is 24–40 engineer-weeks, including M4c; a catalog-only delivery does not complete this phase. Provider, purchase/update terms, subscription policy and payout/refund details remain to be specified.

## Totals

| Scope | Engineer-weeks | Raw elapsed with 2 engineers | With approximately 20% scheduling allowance |
| --- | --- | --- | --- |
| Phase 1 including export/restore prerequisite | 40–62 | 20–31 weeks | About 24–38 weeks |
| Phase 1 excluding separately delivered export/restore | 34–52 | 17–26 weeks | About 21–32 weeks; prerequisite still gates recovery acceptance |
| Phase 2 / M4 including required commerce | 24–40 | 12–20 weeks | About 15–24 weeks |
| Both phases including prerequisite and commerce | 64–102 | 32–51 weeks | About 39–62 weeks |

Rounding individual rows and rounding the aggregate can differ by a week. The aggregate envelope is calculated from aggregate raw effort, not by adding already-rounded envelopes. One engineer roughly doubles raw elapsed time; a larger team does not eliminate the contract, migration, hardware, and policy dependencies. No start or finish date is committed.

## Assumptions, exclusions and uncertainty

The ranges assume a bounded app-approved Pi/OS/architecture baseline and the current default capabilities, not universal hardware support. Platform support is app-owned (D6); these estimates do not decide a new Module Builder matrix. Native runtime/dependency behavior and legacy state migration are major M2 risks.

The backup prerequisite is especially uncertain until its inventory is agreed. Coverage must address configuration, module versions/state/artifacts, histories/media, credentials, and any necessary node/wallet backup integration. Device/log exports are not assumed to be a full OS image or universal rollback of root actions. Full disk imaging, unspecified external-service state, or significantly broader backup requirements need a new estimate.

M3 includes a focused code editor and app-operated module tools, not a full IDE, a built-in AI harness, module CLI actions, arbitrary custom UI, or equally rich tools for every programming language. It does not promise that AI makes unfamiliar driver development require no expertise.

M4 includes implementing production-service setup and community tools. Continuous hosting charges, moderation staffing, community support, abuse response and ongoing maintenance are operating commitments outside these development totals. Central source compilation and AI review infrastructure are not included; optional AI checks need their own scope if adopted.

Commerce assumes one established provider and a simple purchase model. Subscriptions, multiple payment providers, strict anti-copy enforcement, unresolved licensing/fork policy, and broad commercial-service integrations are not included. Policy/legal/accounting work, provider approvals and third-party waiting time are unestimated dependencies rather than assumed free engineering work.

Source inspection, integrity checks and signed provenance are not safety guarantees. Root-capable code limits rollback promises. Unknown requirements can exceed these ranges; they are not a maximum-price commitment.

## Estimate checkpoints

1. Confirm staffing, app-wide support/backup scope, and the capability inventory before scheduling.
2. After M1, revise runtime, migration and authoring estimates against actual interfaces and failures.
3. Before M4, confirm service/moderation ownership, publication acceptance rules and infrastructure requirements.
4. Refine the required commerce estimate once purchase/update rights, payout/refund policies and provider integration are chosen; keep it inside the Phase 2 baseline.
