# Use an AI assistant for an Edge Studio contribution

AI assistance is optional. Read [CONTRIBUTING.md](../../CONTRIBUTING.md) and use the same [quickstart](./contributor-quickstart.md), [device recipe](./contributing-devices.md) and [workflow recipe](./contributing-workflows.md) whether you write the code yourself or use an assistant. Current licensing/contribution terms still apply.

## Load the matching skill

The public entry skill is [edge-studio-contributor](../../.agents/skills/edge-studio-contributor/SKILL.md), mirrored for repository tool compatibility under `.claude/skills/` and `.cursor/skills/`. It is a folder with a SKILL.md instruction file, not an executable plugin or account integration.

1. Clone the desired Edge Studio branch locally. Keep guides, code and skill on that same commit/branch.
2. If your harness discovers repository-local skills, select `edge-studio-contributor` using that harness's documented skill picker/invocation. If it supports installing skill folders, copy this folder into the supported skill location without replacing unrelated personal skills.
3. If your tool has no skill support, ask it to read SKILL.md directly from the Edge Studio repository you opened. If it cannot locate that checkout, give it the absolute path. This is the supported manual route; the instructions locate the checkout and use its public files.
4. Check the assistant names the correct checkout, branch and applicable guide before accepting edits. After updating your checkout, refresh an installed copy of the skill from that same version. A copied skill does not auto-update.

No particular AI vendor, paid account, internal OpenProject connection, team Pi or `.env.local` credentials are needed. Tools differ in how they discover skills; this guide does not claim automatic discovery in every harness. Use your tool's own documentation for its installation directory and permissions.

Use the [copyable starting prompt in CONTRIBUTING.md](../../CONTRIBUTING.md#start-with-an-ai-assistant). It uses the repository currently open in your coding tool. Fill in your device name/model, a manufacturer documentation link if available, and what you want to use it for, such as reading temperature and humidity in workflows. If you are unsure what is possible, ask the assistant to help you understand that first; it should ask for missing details and explain choices in plain language. The rest of the prompt covers repository instructions, implementation, verification and preparation of a PR against upstream `dev`. Publishing requires your authorization and GitHub authentication; when tools are unavailable, the assistant should provide the commands and PR text.

The skill routes to human guides instead of maintaining another set of architecture rules. It asks for real test results and clear physical-test limitations. Inspect the diff, understand dependencies and error cases, and review generated code before submitting it. A tool saying “safe” or “all tests passed” is not evidence unless the relevant commands actually ran and produced that result.

## Finish the PR handoff

Before calling a PR ready, walk through any unfinished items in its template with the contributor. Ask them to confirm that they have the right to submit the work under the project's MIT terms; only the contributor can make that confirmation, and the assistant must not check the box on their behalf. Help put relevant test results and available screenshots on the PR itself after checking for private information. Do not refer reviewers to evidence that exists only in a private chat. If a required confirmation or evidence is missing, state exactly what remains and leave the PR as a draft. Never invent evidence or claim a physical test that was not performed.

## Skill verification and feedback

When preparing a Pi test, follow the [fork installation steps and handoff checklist](./contributor-quickstart.md#fork-source-build-on-a-disposable-pi). The assistant should provide the actual fork/branch and expected pushed commit, label which commands run on each computer, include installed-commit and container checks, and explain how to install the next revision. If publishing or Pi access is not authorized or available, provide the instructions and state what remains unperformed.

When trying the skill in a clean harness, record the skill/app commit, request, files consulted/changed, commands/results and assistance required. Check that it locates the correct repository, reuses an existing integration, considers all affected surfaces, preserves the private-feedback/current host boundaries and prepares a focused PR description. Record any loading or routing failure and improve the guide/skill from that evidence. A syntax validator proves file shape, not successful harness usage or an independent hardware contribution.
