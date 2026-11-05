# Contributing to Edge Studio

Help us understand a problem, improve a guide, test hardware, or develop a change. You do not need to write code to help. Edge Studio maintainers triage public requests and review proposed changes; requests do not promise delivery or a response deadline.

## Before contributing code

**Licensing and contribution terms are not yet agreed.** This checkout does not grant a project-wide open-source license. Ask the maintainers to resolve the applicable rights before submitting code for inclusion; maintainers must not merge external code without agreed terms. This guide is a development and review process, not a license, copyright assignment, CLA or DCO. Third-party dependencies retain their own licenses. Public bug reports and feature discussions can proceed without including contributed code.

## Choose your route

| I want to… | Start here |
| --- | --- |
| Report something broken | [Report a problem](https://github.com/edge-studio-technology/edge-studio/issues/new/choose) |
| Request a device, workflow feature or other improvement | [Public request forms](https://github.com/edge-studio-technology/edge-studio/issues/new/choose) |
| Find something to help with | [Browse requests](https://github.com/edge-studio-technology/edge-studio/issues) and read the maintainer's latest scope/availability comment |
| Report a security concern | Follow [the private reporting policy](SECURITY.md#reporting-a-vulnerability), not a public issue |
| Send private feedback | Use **Send feedback** in the app; its Integritas consent and availability rules still apply |
| Run a modified build | [Contributor quickstart](docs/guides/contributor-quickstart.md) |
| Add hardware/device support | [Device integration recipe](docs/guides/contributing-devices.md) |
| Add workflow behaviour | [Workflow integration recipe](docs/guides/contributing-workflows.md) |
| Work with an AI assistant | [Contribution skill instructions](docs/guides/contributor-ai.md) |

GitHub accounts are required to submit or comment; public issues can be read without an account. GitHub loads issue forms from the repository's default branch (`main`). New forms and documentation become available at the public links after this work is released to `main`, not merely committed to a feature branch or merged into `dev`.

## Explain the need

Search existing issues first. Describe the result you need, what happens now, and an example. For a device, include its model and public documentation, and whether you can help test it. You can write “Unknown” for details you cannot find. Do not include credentials, wallet recovery information, device backups, full feedback/log exports, private payloads or personal details. Check screenshots before attaching them.

For a large change, new dependency, driver or architectural change, discuss the approach before investing substantial work. Small focused fixes may go straight to a draft pull request, subject to the contribution-terms gate above. Comment before taking an issue so people can coordinate; a comment alone does not reserve it indefinitely.

## Develop and propose a change

1. Read the [quickstart](docs/guides/contributor-quickstart.md) and [architecture map](docs/guides/contributor-architecture.md). Work on a branch in your own fork from current upstream `dev`.
2. Read the relevant [project rules](AGENTS.md#project-rules). Reuse existing patterns and services; keep changes focused on the agreed problem.
3. Complete the whole user journey: validation, runtime behaviour, configuration screens, setup guide, saved-data compatibility and relevant tests. Hardware tests must name the actual model/OS and results.
4. Run the checks described in the quickstart and relevant recipe. Record failed or unrun checks honestly. Mocked tests do not verify physical hardware. AI-written code needs the same evidence and review.
5. Update the affected operator guides, configuration documentation and branch changelog. Public contributors do not need internal OpenProject access or internal ticket identifiers. PRs may link public issues.
6. Push your branch to your fork and open a PR **against this repository's `dev` branch**. Use the PR template and explain the problem, resulting behaviour, evidence and remaining limitations. Keep unrelated work separate.

Reviewers may request changes, ask for hardware evidence, defer or decline a change. Passing CI does not automatically approve it. Accepted changes are released through the normal `dev` → `main` process; a merge is not an immediate deployment. Installing a fork is an unofficial source build with its own maintenance/update obligations.

## Maintainer workflow and community conduct

Be respectful, provide reproduction details, discuss the change rather than the person, and avoid posting personal information. Maintainers may remove spam, harassment or sensitive content. See [triage and review guidance](docs/guides/contribution-review.md) for request states, review evidence, private-feedback handling and the public launch checklist.

GitHub is the public conversation; OpenProject is internal planning. Maintainers can manually link related records without copying private feedback. The deferred Module Builder is a separate future route for installable packages. Source contributions and Module Builder can coexist; this process uses today's source code and security boundaries.
