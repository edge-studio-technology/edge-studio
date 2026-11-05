# Use an AI assistant for an Edge Studio contribution

AI assistance is optional. Read [CONTRIBUTING.md](../../CONTRIBUTING.md) and use the same [quickstart](./contributor-quickstart.md), [device recipe](./contributing-devices.md) and [workflow recipe](./contributing-workflows.md) whether you write the code yourself or use an assistant. Current licensing/contribution terms still apply.

## Load the matching skill

The public entry skill is [edge-studio-contributor](../../.agents/skills/edge-studio-contributor/SKILL.md), mirrored for repository tool compatibility under `.claude/skills/` and `.cursor/skills/`. It is a folder with a SKILL.md instruction file, not an executable plugin or account integration.

1. Clone the desired Edge Studio branch locally. Keep guides, code and skill on that same commit/branch.
2. If your harness discovers repository-local skills, select `edge-studio-contributor` using that harness's documented skill picker/invocation. If it supports installing skill folders, copy this folder into the supported skill location without replacing unrelated personal skills.
3. If your tool has no skill support, ask it to read SKILL.md directly and give it the absolute path to your Edge Studio checkout. This is the supported manual route; the instructions locate the checkout and use its public files.
4. Check the assistant names the correct checkout, branch and applicable guide before accepting edits. After updating your checkout, refresh an installed copy of the skill from that same version. A copied skill does not auto-update.

No particular AI vendor, paid account, internal OpenProject connection, team Pi or `.env.local` credentials are needed. Tools differ in how they discover skills; this guide does not claim automatic discovery in every harness. Use your tool's own documentation for its installation directory and permissions.

Example prompt:

> Read the edge-studio-contributor skill and use my Edge Studio checkout at the path I provide. I want to add support for a device that sends JSON over MQTT. First check whether the existing MQTT device path is enough, identify a complete existing example, and propose the smallest change. Implement and test only the agreed scope. Do not publish, deploy or access hardware without my authorization.

The skill routes to human guides instead of maintaining another set of architecture rules. It asks for real test results and clear physical-test limitations. Inspect the diff, understand dependencies and error cases, and review generated code before submitting it. A tool saying “safe” or “all tests passed” is not evidence unless the relevant commands actually ran and produced that result.

## Skill verification and feedback

When trying the skill in a clean harness, record the skill/app commit, request, files consulted/changed, commands/results and assistance required. Check that it locates the correct repository, reuses an existing integration, considers all affected surfaces, preserves the private-feedback/current host boundaries and prepares a focused PR description. Record any loading or routing failure and improve the guide/skill from that evidence. A syntax validator proves file shape, not successful harness usage or an independent hardware contribution.
