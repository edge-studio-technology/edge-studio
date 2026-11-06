# Release-please activation — 2026-11-06

Release preparation is active on main with dedicated GitHub App authentication. The first production release is prepared in [PR #176](https://github.com/edge-studio-technology/edge-studio/pull/176), version 0.44.0. Publishing it remains a maintainer decision. No production tag was created for testing.

## Verified

- Organization secrets RELEASE_APP_ID/RELEASE_APP_PRIVATE_KEY and variable RELEASE_APP_BOT_LOGIN are available to edge-studio. The installed App has Contents/Issues/Pull requests write and Metadata read, scoped to selected repositories. Private key values were not displayed.
- [PR #170](https://github.com/edge-studio-technology/edge-studio/pull/170), [#172](https://github.com/edge-studio-technology/edge-studio/pull/172), [#174](https://github.com/edge-studio-technology/edge-studio/pull/174), and main promotions [#171](https://github.com/edge-studio-technology/edge-studio/pull/171)/[#175](https://github.com/edge-studio-technology/edge-studio/pull/175) passed full Ubuntu CI before merging. Feature squash commits and promotion merge commits preserve Conventional history.
- [App run 42203955119](https://github.com/edge-studio-technology/edge-studio/actions/runs/42203955119) verified authentication and bot identity. [Run 42208099887](https://github.com/edge-studio-technology/edge-studio/actions/runs/42208099887) created the intended combined release PR, whose real source/title policies pass and whose normal CI is triggered by App-created events.
- Main ruleset 21546434 retains check-source-branch, check, merge-only PRs, review settings and no bypass actors; conventional-title is additionally required. Dev ruleset 21551039 requires conventional-title and permits squash features plus merge synchronization, preserving its review settings and no bypass actors. Rule snapshots were compared before mutation and API responses verified afterward.
- The pre-existing Minima route test's Windows filesystem redirect was corrected; all 18 route tests pass. A camera cutoff fixture exposed a filesystem fractional-timestamp flake in promotion CI; whole-second fixture time fixes it without changing production retention or deletion assertions. Full local application coverage passed: backend 1,495, frontend 1,838, update-agent 194 tests. Root script tests retain Windows/POSIX/CRLF limitations; Ubuntu full checks passed.
- Existing 14 unreleased changelog bullets were retained in the generated 0.44.0 release. Version 0.43.0 and older changelog history remains unchanged.

## Activation corrections

Retaining pull_request for the existing main source workflow avoids a missing-check transition while main predates the new policy. Only trusted base code executes; before the script exists, the fallback accepts same-repository dev only. Title checks remain read-only pull_request_target. No status was fabricated and no protection bypass was used.

Release-please 17.6 defaults to separate PRs when the manifest contains one package. Explicit separate-pull-requests=false selects the documented combined branch. The original component-branch PR #173 was rejected by the source guard and subsequently closed; the guard was not widened. Earlier offline checks exercised the Merge plugin but missed this manifest default; live validation caught it.

## Still required

- Review and approve PR #176; after any further release-please run, recheck the final notes/diff because the bot can regenerate notes.
- Verify the App-created production tag starts the existing signed image/runtime/manifest pipeline and that publication succeeds before announcing a released update.
- Merge main back into dev through a reviewed merge PR, preserving ancestry and the released app version/changelog.
- Complete separate public-contribution licensing, human form/fork, independent harness/contributor and physical Pi acceptance gates. No project license was chosen and no hardware trial was claimed by this activation.

See the [release guide](../../guides/releases.md) and [release decision](../../adr/0007-release-channels-and-compose-generation.md). The implementation plan was retired after publication; this report retains its activation-time findings.
