# GitHub Contributions OpenProject backlog

Created and read back on 2026-11-04 in Integritas Team, tagged Edge Studio. Two epics and ten features are New, unassigned and unscheduled, with no estimates or committed dates.

[Implementation plan](../../plans/github-contributions.md) · [Structured backlog and acceptance criteria](./backlog.json)

The new records share the existing Module Builder bucket so they appear [alongside that backlog in query #307](https://openproject.privateprivate.org/projects/integritas-team/work_packages?query_id=307). The GitHub Contributions names distinguish this near-term source contribution route from future installable modules.

## [#1249: GitHub Contributions: Let users request improvements and share fixes](https://openproject.privateprivate.org/work_packages/1249)

Give users a public place to explain what they need and give contributors a clear way to offer improvements. Our team reviews submitted code before including accepted changes in an official Edge Studio release.

| Feature | What it delivers | Dependencies |
| --- | --- | --- |
| [#1251: Agree contribution rules and how public requests are handled](https://openproject.privateprivate.org/work_packages/1251) | Explain how people can ask for improvements or offer code, and how our team will respond and review it. Agree the rights and responsibilities before inviting public code contributions. | None in this new backlog |
| [#1252: Give users simple forms for public requests](https://openproject.privateprivate.org/work_packages/1252) | Let people report bugs or ask for hardware support, workflow features and other improvements through simple GitHub forms. Other users and contributors can browse these requests and help solve them. | [#1251](https://openproject.privateprivate.org/work_packages/1251) |
| [#1257: Link Edge Studio to public requests and contribution guides](https://openproject.privateprivate.org/work_packages/1257) | Help users find community requests and contribution instructions from the app. Keep the existing private feedback option clearly separate so users understand what will be public. | [#1251](https://openproject.privateprivate.org/work_packages/1251), [#1252](https://openproject.privateprivate.org/work_packages/1252), [#1253](https://openproject.privateprivate.org/work_packages/1253) |
| [#1258: Review community changes and release accepted contributions](https://openproject.privateprivate.org/work_packages/1258) | Give contributors and reviewers a clear process for checking a proposed change, discussing improvements and deciding whether to accept it. Accepted changes reach other users through the normal Edge Studio release process. | [#1251](https://openproject.privateprivate.org/work_packages/1251), [#1252](https://openproject.privateprivate.org/work_packages/1252), [#1253](https://openproject.privateprivate.org/work_packages/1253), [#1255](https://openproject.privateprivate.org/work_packages/1255), [#1256](https://openproject.privateprivate.org/work_packages/1256) |

## [#1250: GitHub Contributions: Help people build and test new capabilities](https://openproject.privateprivate.org/work_packages/1250)

Publish clear instructions and optional AI guidance that help people add hardware, devices and workflow behaviour to their own copy of Edge Studio. Prove that a new contributor can build, test and submit a complete improvement.

| Feature | What it delivers | Dependencies |
| --- | --- | --- |
| [#1253: Help contributors run their own version of Edge Studio](https://openproject.privateprivate.org/work_packages/1253) | Give contributors reliable steps to run Edge Studio locally and on a test Pi with their own changes. Check that they are really running their modified code rather than an unchanged official build. | None in this new backlog |
| [#1254: Explain how Edge Studio works for contributors](https://openproject.privateprivate.org/work_packages/1254) | Provide a clear map of the app so contributors know where a change belongs. Explain how the screens, saved data, hardware services and workflows work together. | [#1253](https://openproject.privateprivate.org/work_packages/1253) |
| [#1255: Show how to add hardware, devices and setup guides](https://openproject.privateprivate.org/work_packages/1255) | Show contributors the full set of changes needed to support a device, including hardware setup, saved settings and the screens and guides users see. Use a complete working example so important steps are not missed. | [#1253](https://openproject.privateprivate.org/work_packages/1253), [#1254](https://openproject.privateprivate.org/work_packages/1254) |
| [#1256: Show how to add workflow steps and logic](https://openproject.privateprivate.org/work_packages/1256) | Explain how to add or extend a workflow step from its settings screen through to what it does when a workflow runs. Include examples and tests that preserve saved workflows and useful run history. | [#1253](https://openproject.privateprivate.org/work_packages/1253), [#1254](https://openproject.privateprivate.org/work_packages/1254) |
| [#1259: Provide an AI skill that guides complete contributions](https://openproject.privateprivate.org/work_packages/1259) | Give contributors reusable instructions they can load into their own AI tools. The instructions help the AI understand Edge Studio, make a complete change, run checks and prepare a useful pull request. | [#1251](https://openproject.privateprivate.org/work_packages/1251), [#1253](https://openproject.privateprivate.org/work_packages/1253), [#1254](https://openproject.privateprivate.org/work_packages/1254), [#1255](https://openproject.privateprivate.org/work_packages/1255), [#1256](https://openproject.privateprivate.org/work_packages/1256) |
| [#1260: Prove a new contributor can complete a real integration](https://openproject.privateprivate.org/work_packages/1260) | Ask someone outside the core team to follow the public guidance, add a real device and related workflow behaviour, test it on a Pi and submit the change. Use what they struggle with to improve the guides and AI skill. | [#1252](https://openproject.privateprivate.org/work_packages/1252), [#1257](https://openproject.privateprivate.org/work_packages/1257), [#1258](https://openproject.privateprivate.org/work_packages/1258), [#1255](https://openproject.privateprivate.org/work_packages/1255), [#1256](https://openproject.privateprivate.org/work_packages/1256), [#1259](https://openproject.privateprivate.org/work_packages/1259) |

## Boundaries and verification

Each ticket starts with a plain-English summary and contains checkable acceptance criteria, dependency links, related existing work and a plan section reference. Dependencies are description links, not new scheduling relations. Licensing/contribution terms and operational ownership remain decisions to resolve before public launch. No product implementation or deployment was performed.

Existing #690 contribution rules, #692 AI guidance and #618 contribution-entry discovery are referenced for reuse/coordination. They were not moved or edited. Legacy #953 is marketplace module publication, a separate scope.

The Module Builder branch remains at `81cb06d55833efc35ae86b3a3c3f26cb20e58f2e`. Its two epics #1081/#1082 and sixteen features #1083–#1098 were read back unchanged, including their lock versions. Their deferred plans/documentation remain on that branch; this branch does not import them. The two contribution paths can coexist.

Verified all twelve new records against the planned titles, complete descriptions, types, product, bucket and hierarchy (four features under #1249; six under #1250). Verified initial status and empty assignment, sprint/version, date and effort fields.
