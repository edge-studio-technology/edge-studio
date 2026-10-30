# Requirements and acceptance traceability

**Authority:** [PRD](../../../tasks/prd-module-builder.md), 2026-10-30. All requirements remain required in their assigned phase. Coverage below means documentation coverage, not implementation or passing acceptance. Sections refer to [HLD](HLD.md) and [LLD](LLD.md).

## Functional requirements

| FR | Preserved obligation | Design coverage | Required implementation evidence / hold |
| --- | --- | --- | --- |
| FR-01 | Three dynamic contribution surfaces without core edits/rebuild | HLD §4; LLD §2–3 | New contributions discovered/executed without type branches; M1–M3 |
| FR-02 | Permanent auth/management/supervision/persistence/render/history/recovery core | HLD §4; LLD §2 | Zero extensions still permits administration/history/recovery; M2 |
| FR-03 | Namespaced release identity, metadata/entry/dependency/API/target/privilege/docs; pre-execution checks | LLD §3.1 | Invalid/incompatible/dependency/integrity rejection; OQ-02/03 |
| FR-04 | Full host privilege, disclosed; supervision not sandbox | HLD §7; LLD §12 | Privileged supported hardware/setup proof and truthful warning |
| FR-05 | Inert intake/source/validation/preview; acknowledged code execution | LLD §§3, 6, 8 | No executable entry on inspection; labelled executable tests/consent |
| FR-06 | Durable drafts/releases/state/versions/operations and immutable snapshots | LLD §§4–5 | Restart/update persistence; draft edit cannot mutate release/evidence applicability |
| FR-07 | Authenticated local mutations and redacted acknowledged operation records | LLD §§2–4, 12 | Unauthorized mutation rejected; useful module/version/action/outcome/ack records |
| FR-08 | Manual inspect/install/activate/disable/uninstall/reinstall/update; separate enable/create | LLD §§5–6 | Distinct states and explicit actions; no silent activation/update |
| FR-09 | Mandatory access/backup prompt before privileged hooks/draft work; cancel executes nothing | LLD §6.2 | Export device/log offers and cancel guard; skip rule OQ-01 |
| FR-10 | Restorable declared app-wide managed state, credentials/history/module coverage | HLD §8; LLD §7 | Backup prerequisite actual restore, exclusions/credential protection; OQ-01 |
| FR-11 | Preserve IDs/devices/workflows/history/state; separate delete; removed defaults stay removed | LLD §§4, 6.5 | Retention through disable/remove/restart/update; M1/M2 |
| FR-12 | Unavailable saved references visible, blocked runs, compatible reinstall recovers usage | LLD §§5–7 | Retained identity/config/history and original use after activation |
| FR-13 | Guard dependencies/update, prepare before switch, pin run version; define migration/interruption | LLD §§3–7 | Shared dependency/update/in-flight and interrupted switch tests; G-01/04 |
| FR-14 | Truthful progress/failure/reboot/partial effects and independent recovery | LLD §§6–7 | Fault injection/restart and documented user repair/restore; no OS reversal promise |
| FR-15 | Complete inventory/ownership/behaviour-preserving extraction, no permanent fallback | HLD §§3, 8; LLD §9 | 100% choice inventory, migration IDs/secrets/history and parity evidence |
| FR-16 | Camera/GPIO/I2C Sensors/Local MQTT dynamic hardware and helper parity | LLD §§3.2, 9 | Real supported Pi setup/retry/shared dependencies/partial/reboot/events; M2 |
| FR-17 | Dynamic device roles/schemas/defaults/validation/guides/tests/starters and existing data semantics | LLD §§3.2, 6.3, 9 | New device descriptor without frontend branch; read/event/capture/output/hash/credential parity |
| FR-18 | Dynamic block contracts/handlers/cancellation/help; retained execution infrastructure | LLD §§3.2, 6–7, 9 | New block without hard-coded dispatch; uncertain irreversible effect never auto-retried |
| FR-19 | Separate real local catalog; actual bytes through normal installer; optional same-artifact seed | HLD §4; LLD §§6.1, 9 | Network-served artifact identity, no copying installed/built-in source; M1/M2 |
| FR-20 | Every default's original/remove/download/install/activate/restart cycle and zero-extension proof | HLD §8; LLD §9 | Start HTTP JSON Source/Fetch; complete all defaults and restore set; M1/M2 |
| FR-21 | Local workspace/template/edit/preview/fixture/validate/test/log/package/import/export/activate | LLD §8 | App-driven local journey without public account |
| FR-22 | Versioned module-builder-skill for user's AI harness; import/edit/manual coding supported | LLD §8 | Independent use of guidance/examples/file structure/test/package instructions; no required CLI/provider |
| FR-23 | Share material excludes configured devices/credentials; source/artifact distinction and safe import | LLD §§3.1, 4, 8 | Negative archive cases, export inspection, missing build/runtime explanation; OQ-03 |
| FR-24 | Revision/version-linked validation/test evidence; no safety/hardware certification claims | LLD §§3.1, 4, 8 | Metadata/schema/dependency/integrity checks and stale-revision test |
| FR-25 | External author, new physical device + block, second supported Pi, actual reading/run, no core/CLI/cloud dependency | HLD §8; LLD §8 | M3 versioned physical reproduction record; fixtures/HTTP-only insufficient |
| FR-26 | Stable account/publisher identity and authorized ownership; independent local authoring | HLD §5; LLD §§4, 10 | Unauthorized publishing denied, local work with no library login |
| FR-27 | Immutable prepared hosted versions, matching source/artifact and full release metadata | LLD §§3.1, 10 | Same-version replacement rejected, exact inspected/downloaded identity; OQ-03 |
| FR-28 | Automated acceptance checks and useful errors without mandatory human/core gate | LLD §10 | Failed/corrected publication and independent publish; OQ-04 |
| FR-29 | Public discovery/profiles/search/compatibility/access/source/license/price/reputation/counts and sorting | LLD §10 | Listing/detail completeness, unrated state, sort tests; G-06 |
| FR-30 | Hosted add journey uses Phase 1 download/inspect/purchase/backup/install/explicit activation | HLD §5; LLD §§6, 11 | Real bytes through same installer; website/purchase/download no code execution; OQ-09 |
| FR-31 | Exact-release source and inspection/problem reports; evidence classes distinct | LLD §§4, 10 | Immutable source identity and linked report/status; paid access OQ-06 |
| FR-32 | Human post-publication moderation initially; reporting/triage/withdrawal; community end goal | HLD §5; LLD §10 | Post-publication action and visible outcome; no safety guarantee; OQ-04/08 |
| FR-33 | Outage errors preserve installed operation; withdrawal prevents new official downloads | HLD §5; LLD §§7, 10–11 | Unreachable library plus withdrawal cases; retrieval rights OQ-06 |
| FR-34 | One identified 1–5 star vote/member/module; replace, service uniqueness/calculation | LLD §10 | Duplicate/concurrent replacement retains count; eligibility/abuse OQ-05 |
| FR-35 | Builder weighted aggregation by count/stable owner; no separate vote or zero for unrated | LLD §10 | 4.1/10-vote example, empty/unrated tests and stable identity |
| FR-36 | Service-side module download totals across releases, including installed listings; distinct from purchases/installs | LLD §10 | Defined success-event/retry/test/abuse/transfer policy; OQ-05 |
| FR-37 | Traceable purchase/rights/amount/outcome; only successful purchase enables entitled delivery | LLD §11 | Provider success/decline/cancel/uncertainty cases; OQ-06 |
| FR-38 | Traceable payouts/refunds; retries/callbacks cannot duplicate financial/entitlement effects | LLD §§7, 11 | Actual payout/refund/pending/failed paths and duplicate tests; OQ-06/G-04 |
| FR-39 | Installed paid version operates offline, no continuous license check; online new purchases/downloads | LLD §11 | Installed paid run with unreachable library/license service; terms/format open OQ-06 |
| FR-40 | Inspectable paid release source/provenance; rights distinct from license, no strong DRM | HLD §§1, 5; LLD §11 | Source inspection and published agreed rights; OQ-06/07 |
| FR-41 | Platform/author/service/moderation ownership separated; monitoring/backup/incident readiness | HLD §§2, 7–8; LLD §12 | Named owners/runbooks and hosted restore proof; OQ-08 |
| FR-42 | Reproducible tested version/target evidence for every gate; no simulation substitute | HLD §8; LLD §13 | Backup, M1–M3 and M4a–c evidence packages; no gate passed by this report |

## Stories, errors and acceptance metrics

| PRD stories | Design coverage | Release evidence |
| --- | --- | --- |
| US-01 / US-02 / US-03 / US-04 operator | HLD §4; LLD §§3–7 | Backup, M1/M2 and trust warning |
| US-05 template author | LLD §§3.2, 8 | Schema/template journey |
| US-06 code author | LLD §8 | Skill/manual code import/edit/test/package |
| US-07 independent author | HLD §8; LLD §8 | M3 second-Pi physical-device/block |
| US-08 publisher | LLD §10 | M4a independent authorized publish |
| US-09 buyer / US-10 contributor | LLD §11 | M4c actual purchase/payout/refund/offline |
| US-11 member / US-12 moderator/operator | HLD §§2, 5, 7; LLD §10 | M4a/b reports/moderation/reputation and owner readiness |

All eleven PRD §4.10 interruption/error situations are individually specified in LLD §7. All nine §8 success metrics map to evidence: inventory/parity → M2; core independence/authoring → M3; recovery → backup prerequisite; publication → M4a; reputation → M4b; commerce → M4c; offline continuity → FR-33/39 network-isolation checks. No new telemetry, numerical service levels or commercial growth targets are added.

## Recorded backlog alignment

Snapshot references only; this work does not query or modify OpenProject and makes no live-status claim.

| Epic / feature | Design mapping |
| --- | --- |
| #1081 Phase 1 | HLD §4/8; FR-01–25/41/42 |
| #1083 Export/restore | LLD §§4, 6.2, 7; FR-09/10/14 |
| #1084 Inventory/contracts | LLD §§3, 9; FR-01–07/15 |
| #1085 Lifecycle/HTTP | LLD §§5–7, 9; FR-08–14/19/20 |
| #1086 Hardware | LLD §§3.2, 9; FR-04/14–16 |
| #1087 Devices/setup | LLD §§3.2, 9; FR-12/15/17 |
| #1088 Workflows | LLD §§3.2, 6.3, 9; FR-12/13/15/18 |
| #1089 Default parity | LLD §9; FR-15–20 |
| #1090 Workspace | LLD §8; FR-05/06/09/21–24 |
| #1091 Skill/author proof | LLD §8; FR-22–25 |
| #1082 Phase 2 | HLD §5/8; FR-26–42 |
| #1092 Publisher/releases | LLD §§4, 10; FR-26/27 |
| #1093 Discovery/app integration | HLD §5; LLD §10/11; FR-29/30/33 |
| #1094 Publication/moderation | LLD §§10, 12; FR-28/32/33/41 |
| #1095 Source/reports | LLD §10/11; FR-27/31/40 |
| #1096 Reputation/downloads | LLD §10; FR-34–36 |
| #1097 Money flows | LLD §11; FR-37/38 |
| #1098 Entitlements/offline | LLD §11; FR-33/39/40 |
