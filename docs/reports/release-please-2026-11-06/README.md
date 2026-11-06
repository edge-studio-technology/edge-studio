# Release-please adoption verification — 2026-11-06

Local implementation is complete on `github-contributions`; activation is pending. Both external and internal feature PRs continue to target `dev`. The deferred Module Builder branch was not changed. See the [maintainer release guide](../../guides/releases.md) and [active plan](../../plans/release-please.md).

## Evidence

| Check | Result |
| --- | --- |
| Stable baseline | GitHub and local `v0.43.0` resolve to `d379d2e9265e108708cc3dd716bc802dec4ac721`, also current main; root app version is 0.43.0 |
| GitHub settings, read-only | Main requires check/source checks and merge-only PRs; dev is squash-only. Repo squash subject is PR title. Only manifest App/signing secrets exist; no release App secrets or variables yet |
| PR policy tests | 15 passed: Conventional/invalid/breaking titles, same-repo promotions/sync, wrong bot identity/type, wrong release branch, fork impersonation, deleted head repo and hostile ref text |
| Docs checker regression tests | 14 passed |
| Config/schema | Validated against upstream release-please JSON schema, including the grouped release PR title pattern |
| Workflow validation | actionlint 1.7.12 passed all three changed/new workflows; YAML parsed successfully |
| Offline generation | release-please 17.6.0 strategy and manifest Merge plugin: feat -> 0.44.0, fix/perf -> 0.43.1, breaking feat -> 0.44.0, docs -> no release |
| Generated files | Root package and lockfile versions align; service package files are not updated; historical and existing unreleased changelog sections survive; manifest Merge produces the configured branch and versioned Conventional title |
| Repository checks | Lint/docs, Knip and all three typechecks passed |
| Production builds | Backend, frontend and update-agent passed; existing Vite native-config/chunk-size warnings remain |
| Package audits | Backend, frontend and update-agent each reported zero vulnerabilities; network retry outside sandbox was required |
| AI skill validation | Five modified skills passed quick_validate; docs checker confirmed mirror consistency |
| Full npm check | Failed at existing backend Minima restore fallback test, HTTP 502 vs 200, tests/features/minima/minima.routes.test.ts:243; 1,494 backend tests passed. Later stages were not reached by this command |

Offline generation used ignored temporary tooling and mocked local file reads, not a GitHub API release or tag. It verifies version/file behavior, not live App authentication, CI event delivery or publication. No application source or dependency manifests were changed for validation. The existing tag-driven signed image/runtime/manifest workflow was left unchanged.

## Remaining activation checks

- [ ] Provision the dedicated GitHub App, repository secrets RELEASE_APP_ID/RELEASE_APP_PRIVATE_KEY and public variable RELEASE_APP_BOT_LOGIN.
- [ ] Merge policy/configuration through dev and main; the first adoption PR uses the previously installed base policy.
- [ ] Require conventional-title after the workflow is available on each protected branch; retain existing checks/reviews and no bypass actors.
- [ ] Permit merge commits in dev for main-to-dev synchronization, retaining squash for feature PRs and merge-only main.
- [ ] Resolve the existing full-check failure through its own appropriate fix; do not waive it for release automation.
- [ ] Verify a real title edit refreshes the check, the real App's release PR runs normal checks/source policy, and a maintainer-approved release tag starts signed publication.
- [ ] Reconcile legacy unreleased notes into the first generated release and verify main-to-dev merge synchronization.

No live branch rules were changed ahead of workflow deployment, and no production release was created as a test.

## Upstream references

- [Release-please Action credentials and event delivery](https://github.com/googleapis/release-please-action#github-credentials).
- [Manifest release configuration and bootstrap behavior](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md).
- [Pinned release-please Action v5.0.0](https://github.com/googleapis/release-please-action/tree/45996ed1f6d02564a971a2fa1b5860e934307cf7).
