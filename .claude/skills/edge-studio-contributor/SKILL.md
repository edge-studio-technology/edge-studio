---
name: edge-studio-contributor
description: Guide a source contribution to Edge Studio, including hardware/device setup, workflow behaviour, tests, guides and pull-request preparation. Use for contributions in a local Edge Studio checkout, not for building the deferred Module Builder platform.
---

# Edge Studio Contributor

Help the user complete a focused source contribution using the public guides shipped with their checkout. This skill is instructions, not permission to publish, deploy, install host services or access hardware/accounts.

## Locate the matching checkout

Find the Edge Studio repository supplied by the user; use `git rev-parse --show-toplevel` and `git status --short --branch` there. If invoked outside it, ask for the checkout path. All paths below are relative to **that repository root**, not this skill's install folder. Use its current files, not a different release's online copies.

Read `CONTRIBUTING.md` and `AGENTS.md` first. Preserve existing user changes. Public contribution terms must permit submission before publishing code; a public repository is not itself a license. Local implementation may proceed within the user's authorization while unresolved launch decisions remain explicit.

## Choose the smallest complete route

- Setup/build questions: `docs/guides/contributor-quickstart.md`.
- System boundaries and file ownership: `docs/guides/contributor-architecture.md`.
- Hardware, readable/event/capture/output devices, templates, wizard fields or setup guides: `docs/guides/contributing-devices.md` and the matching existing implementation.
- Workflow blocks, event listeners, configuration, execution or history: `docs/guides/contributing-workflows.md`.
- Issue/PR handling: `docs/guides/contribution-review.md`.

Read only the relevant detailed project rules and guides. Do not require internal OpenProject, team `.env.local`, a team Pi or a particular AI vendor. The human guides are the source of contribution expectations; do not invent a competing ruleset.

Before coding, identify the user's observable goal, whether an existing protocol/block/type already supports it, a complete existing example, all affected surfaces and verification that can actually be performed. Prefer a template/configuration change over a new driver when it accurately represents the device; never claim a similar but untested chip is supported.

## Implement the complete user journey

For devices, consider provider/config validation, helper/capability prerequisites, visible templates, active setup wizard and saved-device editing, guide actions, workflow role and tests together. For workflows, trace UI/library/configuration through backend validation, execution, persistence and history. Modify only the owners the requested behaviour requires.

Keep current API-first, credential/egress, opt-in hardware and narrow host-agent boundaries. Preserve saved IDs/configuration/history and media/hash/proof semantics. A source PR does not require a module runtime, module package format or new generic host execution interface.

Use the matching guide for concrete steps and commands. If a necessary policy or hardware fact is unknown, isolate that dependency and ask rather than silently selecting a license, collecting sensitive data or marking physical support verified.

## Verify and hand off

Run the relevant focused tests and required checks; record commands, exit/results and checks not reached. Do not describe a failed full check as passed because focused tests succeeded. Mocked tests do not prove physical behaviour. Do not deploy on a live Pi, operate outputs/capture or send payments without the user's authorization.

Review the diff for private configuration/credentials, unrelated changes, incomplete UI/backend/guide wiring and stale docs. Keep mirrored rules/skills synchronized if changed. Prepare a PR description with the problem/result, scope, actual verification, hardware evidence and remaining limitations. Propose against `dev`; publishing, opening a public issue/PR and merging require the user's authorization. No external messages or private-feedback export are implied by loading this skill.

Return a concise explanation of changed behaviour, relevant files, evidence and remaining decisions/manual checks. Do not invent a completed independent-contributor trial.
