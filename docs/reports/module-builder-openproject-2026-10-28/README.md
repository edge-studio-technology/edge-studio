# Module Builder OpenProject backlog

Created 2026-10-28 in Integritas Team, tagged with the Edge Studio product. Two new epics and sixteen child features were created and read back to verify type, parent, product, subject and commerce scope.

Commerce is required in Phase 2. The local builder remains Phase 1; the hosted library, publishing, reputation and purchases/payouts/refunds/offline entitlements are Phase 2.

**Title update — 2026-10-30:** The eighteen epic/feature titles below and in the JSON snapshot match the plain-English names verified in OpenProject. Original scope, acceptance criteria, estimates and dependencies are unchanged.

## Epics and features

### [#1081: Module Builder - Phase 1: Create and use modules in Edge Studio](https://openproject.privateprivate.org/work_packages/1081)

Provisional phase effort: 40–62 engineer-weeks.

| Feature | Milestone | Engineer-weeks | Dependency references |
| --- | --- | --- | --- |
| [#1083: Back up Edge Studio and restore it if a module causes problems](https://openproject.privateprivate.org/work_packages/1083) | Prerequisite | 6–10 | None in this new backlog |
| [#1084: Define what modules can add and how they work with Edge Studio](https://openproject.privateprivate.org/work_packages/1084) | M1 | 3–4 | None in this new backlog |
| [#1085: Install, update and remove modules, starting with a working example](https://openproject.privateprivate.org/work_packages/1085) | M1 | 5–8 | [#1084](https://openproject.privateprivate.org/work_packages/1084) |
| [#1086: Add hardware support by installing modules](https://openproject.privateprivate.org/work_packages/1086) | M2 | 5–8 | [#1085](https://openproject.privateprivate.org/work_packages/1085) |
| [#1087: Add device choices and setup guides through modules](https://openproject.privateprivate.org/work_packages/1087) | M2 | 3–5 | [#1085](https://openproject.privateprivate.org/work_packages/1085) |
| [#1088: Add new workflow steps through modules](https://openproject.privateprivate.org/work_packages/1088) | M2 | 4–6 | [#1085](https://openproject.privateprivate.org/work_packages/1085) |
| [#1089: Turn built-in features into modules users can remove and reinstall](https://openproject.privateprivate.org/work_packages/1089) | M2 | 4–5 | [#1086](https://openproject.privateprivate.org/work_packages/1086), [#1087](https://openproject.privateprivate.org/work_packages/1087), [#1088](https://openproject.privateprivate.org/work_packages/1088) |
| [#1090: Create, edit and test modules inside Edge Studio](https://openproject.privateprivate.org/work_packages/1090) | M3 | 5–8 | [#1085](https://openproject.privateprivate.org/work_packages/1085), [#1083](https://openproject.privateprivate.org/work_packages/1083) |
| [#1091: Help creators build modules and prove they work on another Pi](https://openproject.privateprivate.org/work_packages/1091) | M3 | 5–8 | [#1084](https://openproject.privateprivate.org/work_packages/1084), [#1090](https://openproject.privateprivate.org/work_packages/1090), [#1086](https://openproject.privateprivate.org/work_packages/1086), [#1087](https://openproject.privateprivate.org/work_packages/1087), [#1088](https://openproject.privateprivate.org/work_packages/1088) |

### [#1082: Module Builder - Phase 2: Share and sell modules in the online library](https://openproject.privateprivate.org/work_packages/1082)

Provisional phase effort: 24–40 engineer-weeks.

| Feature | Milestone | Engineer-weeks | Dependency references |
| --- | --- | --- | --- |
| [#1092: Give creators accounts and store published module versions](https://openproject.privateprivate.org/work_packages/1092) | M4a | 4–6 | [#1085](https://openproject.privateprivate.org/work_packages/1085), [#1091](https://openproject.privateprivate.org/work_packages/1091) |
| [#1093: Find modules online and add them to Edge Studio](https://openproject.privateprivate.org/work_packages/1093) | M4a | 3–5 | [#1092](https://openproject.privateprivate.org/work_packages/1092), [#1085](https://openproject.privateprivate.org/work_packages/1085) |
| [#1094: Check uploads automatically and handle spam after publication](https://openproject.privateprivate.org/work_packages/1094) | M4a | 3–5 | [#1092](https://openproject.privateprivate.org/work_packages/1092) |
| [#1095: Let users inspect module code and report problems](https://openproject.privateprivate.org/work_packages/1095) | M4b | 2–4 | [#1092](https://openproject.privateprivate.org/work_packages/1092), [#1094](https://openproject.privateprivate.org/work_packages/1094) |
| [#1096: Show module ratings, creator ratings and download numbers](https://openproject.privateprivate.org/work_packages/1096) | M4b | 4–6 | [#1092](https://openproject.privateprivate.org/work_packages/1092), [#1093](https://openproject.privateprivate.org/work_packages/1093) |
| [#1097: Let users buy modules, pay creators and receive refunds](https://openproject.privateprivate.org/work_packages/1097) | M4c | 5–9 | [#1092](https://openproject.privateprivate.org/work_packages/1092), [#1093](https://openproject.privateprivate.org/work_packages/1093) |
| [#1098: Keep purchased modules working when the library is offline](https://openproject.privateprivate.org/work_packages/1098) | M4c | 3–5 | [#1097](https://openproject.privateprivate.org/work_packages/1097), [#1095](https://openproject.privateprivate.org/work_packages/1095), [#1085](https://openproject.privateprivate.org/work_packages/1085) |

## Estimates and traceability

Each ticket contains its user outcome, checkable acceptance criteria, milestone, provisional effort range, dependency links, scope boundaries and repository references. Parent/child estimates cover the same work; do not sum both levels. Estimates are recorded as ranges in descriptions, not as misleading fixed-hour values or committed dates.

Phase 1 totals 40–62 engineer-weeks including the app-wide backup/restore prerequisite. Phase 2 totals 24–40 including required commerce. Both phases total 64–102, or 32–51 raw weeks at two engineers; approximately 39–62 with the visible ~20% scheduling allowance. These remain provisional engineering judgments.

- [Backlog snapshot and acceptance criteria](./backlog.json)
- [Implementation plan](../../plans/module-builder.md)
- [Workshop revision](../../plans/module-builder/workshop-revision.md)
- [Estimate assumptions and exclusions](../module-builder-journey-2026-10-28/estimate-notes.md)
- [Updated presentation](../module-builder-journey-2026-10-28/README.md)

## Existing tickets and scope boundaries

At initial backlog creation, existing module tickets were inspected and cross-referenced without edits. The subsequently approved legacy cleanup is recorded below. Earlier IDE/custom-UI/automatic-rollback assumptions in #339, #977, #978 and #980 do not replace the revised scope. Existing marketplace discovery tickets #926, #952 and #954 remain unchanged. The new app-wide restore feature references existing export/log work #643 and #819 rather than claiming that work does not exist. Coordinate overlaps before implementation.

Dependencies are clickable references in descriptions, not newly imposed scheduling relations. All newly created tickets retain the initial New status and are unassigned, with no sprint, version, due date or project-membership changes. The web-library operating owner and detailed commercial/provider/licensing policies remain to be specified; their existence does not make commerce optional.

## Approved legacy cleanup — 2026-10-28

[Module Builder query #307](https://openproject.privateprivate.org/projects/integritas-team/work_packages?query_id=307) now contains the two current epics and sixteen features (#1081–#1098), assigned to the Module Builder bucket.

| Records | Disposition | Retained scope |
| --- | --- | --- |
| #339, #977, #252, #253 | Subject prefixed `[Superseded]`; removed from active bucket | Replacement references to #1081/#1082 and #1084/#1090/#1091; original text preserved |
| #976, #955 | Subject prefixed `[Superseded]`; removed from active bucket | Recovery/lifecycle/supervision covered by #1083/#1085/#1086; no sandbox or universal rollback promise |
| #978, #981 | Backlog refinement; #978 detached from superseded #339 | Deferred arbitrary custom UI research; schema-driven forms/wizards remain initial scope |
| #980 | Backlog refinement; detached from superseded #976 | Deferred automatic restoration; current scope remains manual lifecycle and user-directed restore |
| #208 | Backlog refinement; reparented to Cloud Development #342 | Future remote-Pi build/rental feasibility; complete original #975/#979 descriptions copied into #208 |
| #975, #979 | Subject prefixed `[Superseded]`; removed from active bucket | Remote-service research consolidated into #208, outside both current Module Builder phases |

No records were deleted or marked Done. All thirty changed records retain their previous New status: this instance has no Superseded/Cancelled status, and the account cannot transition the deferred records to Proposed. Explicit disposition notes and bucket placement identify their planning status. Original descriptions and history remain accessible.

Read-back verification checked all thirty records, replacement notes, intended parents/buckets, unchanged assignment/product/priority/sprint/version/date/effort fields, and the exact eighteen-record query result. Completed driver work #340 and app-wide terminal research #263 were left unchanged. The global relations collection contained 67 relations, none involving the twelve reviewed legacy records; no relations were changed. The creation snapshot above remains a record of the initial delivery backlog.
