# Release-please publication verification — 2026-11-06

The user approved production publication of [v0.44.0](https://github.com/edge-studio-technology/edge-studio/releases/tag/v0.44.0). Release preparation, App-created tagging, signed builds and public artifact delivery have now been verified end to end. No Pi installation/update was performed.

## Evidence

| Check | Result |
| --- | --- |
| Approved release | PR #176 merged after full CI and explicit user approval |
| Tagged source | v0.44.0 resolves to b614f4f9ddc997846440e0477088ad858c7e495b, the approved PR merge |
| App publication | [Run 42235136248](https://github.com/edge-studio-technology/edge-studio/actions/runs/42235136248) succeeded; published GitHub release at 2026-11-06T14:34:40Z |
| Tag-triggered pipeline | [Release run 42235161146](https://github.com/edge-studio-technology/edge-studio/actions/runs/42235161146) succeeded: changes, image build and signed manifest publication jobs |
| Artifact manifest | Signature verifies against the existing repository public key; version v0.44.0; frontend/backend/update-agent references are digest-pinned |
| Artifact runtime | Signature verifies; SHA-256 matches the signed manifest: 804e486379beef5b2e5b6a87700d6ad2d232cb85016011adb3b246971c92ede7 |
| Installer checksum | Matches install.sh read directly from the approved tag: 2d7a07fbd9845f5e48de957f688d5e3d061c1dae48aa369fd9b81adabff092d9 |
| Public delivery | Public release manifest reports v0.44.0 with a valid signature; public runtime signature and SHA-256 match that signed manifest |
| Release identity correction | PR #177 and promotion #178 passed CI. Empty root package-name override makes release-please recognize the combined approved PR without changing package.json's app name or manually creating/moving tags |
| Synchronization | Completion branch is based on main b16415c4 and includes only verification/lifecycle docs afterward; merging it into dev with a merge commit retains released main ancestry and app version 0.44.0 |

Verified public endpoints are [the release manifest](https://edgestudio.technology/manifest/release/manifest.json) and [runtime bundle](https://edgestudio.technology/manifest/release/edge-studio-runtime.tar.gz). Downloads used a version query to avoid stale cache responses. No downloaded public key was trusted: verification used the checkout's existing manifest public key.

## Publication correction

The first post-approval run completed without publishing because release-please 17.6 compared the combined PR's absent branch component against a derived edge-studio package component. Before promoting the fix, the actual configuration parser, strategy factory, approved PR body and merge SHA were exercised together and verified to produce v0.44.0 with all reconciled release notes. The correction reached main through normal dev/main checks; the App then published the originally approved commit. No check was bypassed and no tag was fabricated or moved.

## Remaining scope

Physical installation/update testing and the separate contributor licensing, form walkthrough, external-fork, independent harness and hardware acceptance gates remain outside this release automation verification. The deferred Module Builder branch was not changed. See [the release guide](../../guides/releases.md) and [ADR 0007](../../adr/0007-release-channels-and-compose-generation.md).
