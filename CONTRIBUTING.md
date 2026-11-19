# Contributing to Edge Studio

Help us understand a problem, improve a guide, test hardware, or develop a change. You do not need to write code to help. Edge Studio maintainers triage public requests and review proposed changes; requests do not promise delivery or a response deadline.

## Before contributing code

Edge Studio code and documentation are licensed under the [MIT License](LICENSE). By submitting a contribution for inclusion, you agree to license it under the same MIT terms and confirm that you have the right to do so. You retain copyright in your contribution. No separate CLA, DCO or copyright assignment is required. Preserve applicable third-party license and copyright notices; dependencies and separately licensed third-party material retain their own terms.

## Choose your route

| I want to… | Start here |
| --- | --- |
| Check what is already supported | [Hardware, device and workflow catalog](docs/guides/supported-capabilities.md) |
| Report something broken | [Report a problem](https://github.com/edge-studio-technology/edge-studio/issues/new/choose) |
| Request a device, workflow feature or other improvement | [Public request forms](https://github.com/edge-studio-technology/edge-studio/issues/new/choose) |
| Find something to help with | [Browse requests](https://github.com/edge-studio-technology/edge-studio/issues) and read the maintainer's latest scope/availability comment |
| Report a security concern | Follow [the private reporting policy](SECURITY.md#reporting-a-vulnerability), not a public issue |
| Ask a general question or send private feedback | Use **Help & feedback → Send quick feedback** in the app; its Integritas consent and availability rules still apply |
| Run a modified build | [Contributor quickstart](docs/guides/contributor-quickstart.md) |
| Add hardware/device support | [Device integration recipe](docs/guides/contributing-devices.md) |
| Add workflow behaviour | [Workflow integration recipe](docs/guides/contributing-workflows.md) |
| Work with an AI assistant | [Contribution skill instructions](docs/guides/contributor-ai.md) |

GitHub accounts are required to submit or comment; public issues can be read without an account. GitHub loads issue forms from the repository's default branch (`main`). New forms and documentation become available at the public links after this work is released to `main`, not merely committed to a feature branch or merged into `dev`.

## Explain the need

Search existing issues first. Describe the result you need, what happens now, and an example. For a device, include its model and public documentation, and whether you can help test it. You can write “Unknown” for details you cannot find. Do not include credentials, wallet recovery information, device backups, full feedback/log exports, private payloads or personal details. Check screenshots before attaching them.

For a large change, new dependency, driver or architectural change, discuss the approach before investing substantial work. Small focused fixes may go straight to a draft pull request under the MIT contribution terms above. Comment before taking an issue so people can coordinate; a comment alone does not reserve it indefinitely.

## Develop and propose a change

1. Read the [quickstart](docs/guides/contributor-quickstart.md) and [architecture map](docs/guides/contributor-architecture.md). Work on a branch in your own fork from current upstream `dev`.
2. Read the relevant [project rules](AGENTS.md#project-rules). Reuse existing patterns and services; keep changes focused on the agreed problem.
3. Complete the whole user journey: validation, runtime behaviour, configuration screens, setup guide, saved-data compatibility and relevant tests. Hardware tests must name the actual model/OS and results. Update the [support catalog](docs/guides/supported-capabilities.md) when capabilities change, with accurate requirements and verification evidence.
4. Run the checks described in the quickstart and relevant recipe. For hardware changes, follow [Test your fork on a Raspberry Pi](docs/guides/contributor-quickstart.md#fork-source-build-on-a-disposable-pi), including the expected-commit and container checks. Record failed or unrun checks honestly. Mocked tests do not verify physical hardware. AI-written code needs the same evidence and review.
5. Update the affected operator guides and configuration documentation. Release-please prepares version bumps and release notes; do not manually bump the app version or add branch changelog sections. Public contributors do not need internal OpenProject access or internal ticket identifiers. PRs may link public issues.
6. Push your branch to your fork and open a PR **against this repository's `dev` branch**. Use a Conventional title such as `feat(devices): support a new sensor` or `fix(workflows): handle an unavailable device`. Use the PR template and explain the problem, resulting behaviour, evidence and remaining limitations. Maintainers squash-merge contributions using that title. See the [release guide](docs/guides/releases.md) for types and release handling.

Before submitting, review every unfinished PR-template item with your AI assistant. It should ask you to confirm that you have the right to submit the contribution under the MIT terms before you check that statement yourself. Attach relevant test results and screenshots to the PR so reviewers can see the evidence there; review screenshots for private information first. If evidence or a required confirmation is missing, say so clearly and leave the PR as a draft until it is ready. Never invent evidence or let an assistant attest to your rights for you.

Reviewers may request changes, ask for hardware evidence, defer or decline a change. Passing CI does not automatically approve it. Accepted changes are released through the normal `dev` → `main` process; a merge is not an immediate deployment. Installing a fork is an unofficial source build with its own maintenance/update obligations.

### Start with an AI assistant

After cloning your fork, open it in your AI coding tool and copy the prompt below. Replace the bracketed values with your device details and what you want to use it for. For example: “Read temperature and humidity and use those readings in workflows.” You do not need to know which drivers or code changes that requires. If you are unsure, write: “Help me understand what this device could do in Edge Studio before we implement support.” See the [AI contribution guide](docs/guides/contributor-ai.md) for loading the skill when your tool does not discover it automatically.

```text
Work in the Edge Studio repository currently open.

Before making changes, read:
- AGENTS.md
- CONTRIBUTING.md
- .agents/skills/edge-studio-contributor/SKILL.md

Help me add support for this device:
[device name/model and manufacturer documentation link, if available]

I want to use it to:
[for example: read temperature and humidity and use those readings in workflows]

If you need more information about the device, its connection or
how I want to use it, ask me. Explain the choices in plain language.

Check whether an existing protocol or integration can be reused. Identify
a complete existing example and propose the smallest complete change.

Follow the contribution guides and relevant project rules. Work on a
topic branch in my fork based on upstream dev. Implement the agreed
scope across backend, device setup/editing, setup guides and workflows
where needed. Update documentation and run the relevant checks.
Report actual results, failed or unrun checks, and anything requiring
physical hardware verification.

For a Pi test, use the quickstart's installation handoff checklist.
Give me commands for my actual fork and branch, the expected pushed
commit, and the steps to verify it on the Pi and install later changes.

Review the diff and prepare a Conventional PR title and description
using the repository template, targeting upstream dev. Explain the
commit, push-to-my-fork and pull-request steps; perform those actions
when I authorize them and the required tools/accounts are available.
Leave merging and releasing to the maintainers.
```

The assistant needs access to the local files and development tools. Pushing and opening a PR also require your GitHub authentication and authorization; if those tools are unavailable, it should give you the commands and prepared PR text. Review its changes and verification evidence before submitting.

## Maintainer workflow and community conduct

Be respectful, provide reproduction details, discuss the change rather than the person, and avoid posting personal information. Maintainers may remove spam, harassment or sensitive content. See [triage and review guidance](docs/guides/contribution-review.md) for request states, review evidence, private-feedback handling and the public launch checklist.

GitHub is the public conversation; OpenProject is internal planning. Maintainers can manually link related records without copying private feedback. The deferred Module Builder is a separate future route for installable packages. Source contributions and Module Builder can coexist; this process uses today's source code and security boundaries.
