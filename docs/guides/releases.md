# Releasing Edge Studio

Both internal and external contributors start from upstream `dev` and send feature PRs to `dev`. Release-please prepares production releases on `main`; a maintainer decides when to merge its release PR. A feature merge is not a deployment.

## Contributor workflow

Use a Conventional PR title describing the resulting behavior:

| Title | Release effect |
| --- | --- |
| `feat(devices): support a new sensor` | Minor version; a new capability |
| `fix(workflows): handle an unavailable device` | Patch version; a correction |
| `perf: reduce dashboard loading time` | Patch version; a performance improvement |
| `docs: explain sensor wiring` | No release by itself |
| `ci: automate release preparation` | No release by itself |
| `feat(api)!: replace the device configuration format` | Breaking change; explain migration in the PR |

Other accepted types are `refactor`, `test`, `build`, `chore`, `style` and `revert`. They do not normally cause a version bump by themselves. Select the type for the actual change, not to force or suppress a release. Before 1.0, breaking changes bump the minor version; from 1.0 onward they bump the major version. Ordinary features also bump the minor version before 1.0.

Maintainers **squash-merge feature PRs into `dev`**, keeping the Conventional PR title as the squash commit subject. Individual development commits need not all follow the convention; the final squash subject must. Put public issue references in the PR body; internal OpenProject identifiers are not required. Include breaking-change and migration information in the squash commit body as well as the PR. The `!` in the title signals the version bump even if a body is omitted.

Do not manually increment the root app version or add new branch-specific changelog sections. Release-please updates the root package/version lockfile, release manifest and changelog in its release PR. Update the actual operator guides with each feature. Historical changelog entries remain intact; maintainers review generated release notes for omissions, clarity, security notices and migration steps.

## Maintainer release sequence

1. Review the changes and checks on `dev`. Open a PR from this repository's `dev` to `main` and **create a merge commit**. Never squash a promotion: that would hide the individual Conventional feature commits from release-please. Promotion titles can be descriptive, such as “Promote tested changes”.
2. On the main push, release-please creates or updates `release-please--branches--main` with a release PR such as `chore(main): release 0.44.0`. Documentation-only or maintenance-only changes may produce no release PR. No version is published merely because the PR exists.
3. Review the proposed version, release notes, root package lockfile and migration/security documentation. Read README, SECURITY, TASKS and the QA gaps against what is shipping. Confirm CI and `check-source-branch` pass. Keep the release-please branch, generated release metadata and release labels intact; do not reuse it for unrelated changes.
4. Approve the release by merging that PR into `main` using the repository's allowed **merge commit** method. The App then creates the `vX.Y.Z` tag and GitHub release. This triggers the existing Release workflow, which builds changed images, the runtime bundle and signed manifests. A GitHub release entry alone does not mean distribution succeeded: check the Release workflow and published signed artifacts before announcing success. Do not reuse or move a published tag if a build fails; inspect the failure and rerun the failed workflow when appropriate.
5. Open a PR from this repository's **`main` to `dev`** and merge it with a **merge commit**. This preserves ancestry and brings the released version/changelog back to development. Do not squash the synchronization, reset either branch or force-push. Resolve conflicts deliberately and rerun checks. Complete synchronization before the next promotion.

Release-please manages one app version, starting after stable `v0.43.0`. Service package versions are not separate releases. Existing manually created development/canary tags remain supported by the tag build workflow; automating those prereleases is outside this change. Development tags such as `v0.50.0-dev.9` do not set the next stable version. Version ordering across those channels should be considered before moving an installed device between them.

## One-time GitHub setup and activation

This checkout supplies configuration; it is not proof that the bot has run. An organization/repository administrator must provision the App:

1. Register a dedicated GitHub App, with no webhook required, and install it only on `edge-studio`. Grant repository **Contents: read/write**, **Pull requests: read/write** and **Issues: read/write** (for release labels); Metadata read is automatic. It does not need signing secrets, manifest-repository access, Actions write permission or ruleset bypass. Keep the separate manifest App unchanged.
2. Add repository Actions secrets **RELEASE_APP_ID** and **RELEASE_APP_PRIVATE_KEY**. Store the downloaded PEM securely; do not add it to the repo, an issue or chat. Add an Actions **variable** named **RELEASE_APP_BOT_LOGIN** containing the exact App bot login, for example `your-app-slug[bot]`. It is a public identity, not a secret. The source guard fails closed for bot release PRs if this variable is missing or wrong.
3. Merge the configuration through `dev` into `main`. The first main push can create a release PR; check the baseline is still the latest stable release before promotion. If another stable version ships first, update the bootstrap SHA and manifest together before activation. No legacy commit history is rewritten. Existing unprefixed commits since `v0.43.0` are not automatically classified: carry their existing unreleased notes into the first generated release section during review, then remove those migrated unreleased sections without losing entries.
4. After the metadata workflow exists on each target branch, make **conventional-title** a required check in that branch's ruleset. Keep the existing **check** and **check-source-branch** requirements on `main`. Do not require a new check before its workflow can run. The first adoption PR will use the old base-branch policy; subsequent PRs use the new one.
5. In the `dev` ruleset, permit **merge** as well as **squash** so `main` can be merged back without losing ancestry. Feature PRs still use squash; only main-to-dev synchronization uses merge. Keep `main` merge-only. Do not add bypass actors or relax review requirements. The repository's squash subject setting must remain **PR title**.
6. Verify a feature PR's title check updates when its title is edited. Verify the actual bot release PR runs normal CI, passes the source guard with its configured identity and remains subject to required review. Finally, verify a maintainer-approved release creates a tag that starts the signed Release workflow, and synchronize `main` back to `dev`.

Do not substitute `GITHUB_TOKEN` for the App token. Tags and PRs it creates normally do not start downstream Actions workflows; a successful release-please job would then give a misleading result. See [release-please credentials](https://github.com/googleapis/release-please-action#github-credentials).

## Security and recovery

Build/test workflows continue to use `pull_request` and no release secrets. The title policy uses read-only `pull_request_target`; the source policy retains `pull_request` so its existing required check also runs during adoption. Both check out only the trusted **base SHA** without persisted credentials. If the base predates the policy script, the source policy accepts only this repository's `dev` branch; once deployed it uses the script and configured bot exception. Never change these metadata jobs to check out a contributor's head/merge SHA, install contributor dependencies or execute contributor code. They run no build and receive no App private key or signing credentials.

Only this repository's `dev` can promote ordinary changes to `main`. The additional release exception requires the exact configured bot identity, Bot account type, same repository and exact release-please branch; a fork with a matching branch name does not qualify. Maintainers still review the release PR. See [ADR 0007](../adr/0007-release-channels-and-compose-generation.md).

If preparation fails, correct configuration/credentials and rerun Release please on `main`; do not create an emergency tag to test it. If the generated notes are incomplete, edit the release PR and review the final diff after the next bot update. Revoke/rotate the App key if exposed. Disabling the Release please workflow stops preparation/tag automation and leaves existing signed builds and installed devices unchanged.
