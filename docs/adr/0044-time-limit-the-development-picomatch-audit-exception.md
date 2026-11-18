# 0044: Time-limit the development picomatch audit exception

**Status:** Accepted
**Date:** 2026-11-18

## Context

The dependency audit blocked the documentation-only PR #188 after all tests passed. [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) describes denial of service through crafted picomatch patterns. The registry's latest version is 4.0.7 and the advisory lists no patched version as of this decision. Vitest/Vite and their dependency chains bring it into all three application packages as a development dependency. Production Docker builds remove development dependencies or serve only compiled frontend assets.

The project owner explicitly approved a temporary exception for this advisory while retaining the existing moderate audit gate. This accepts development/build exposure; it does not fix the vulnerable dependency or certify third-party code as safe to build.

## Decision

Keep the current tooling. Accept only this advisory for picomatch 4.0.7 and its exclusively derived development-only audit findings. Resolve npm's dependency-report cycles while examining every reachable advisory and affected lockfile node; a package name alone is not sufficient to exempt it.

The exception expires at **2026-12-02 00:00 UTC**. Fail when picomatch is production-reachable, the installed version changes, or the exception expires. Audit all dependencies, including development dependencies, in backend/frontend/update-agent; additionally audit each package with development dependencies omitted and apply no exceptions to those production reports. Other moderate/high/critical findings still block. Command failures and unsupported or malformed audit reports fail closed. The separate existing root-package audit coverage follow-up is unchanged.

Print the accepted advisory and expiry in CI. Preserve restricted fork workflow permissions and the absence of repository secrets from contributor builds. Update picomatch and remove the exception as soon as a suitable patch is available; any extension of the deadline requires explicit review and updated evidence.

## Alternatives considered

- Disabling audits or excluding all development dependencies would hide unrelated findings.
- Force downgrading or replacing the test/build stack adds compatibility risk and is not an established fix for this advisory.
- Waiting for upstream would retain the block on source/documentation contributions despite the accepted, limited development exposure.

## Consequences

Untrusted repository code and file patterns remain a development/CI risk. The exception is visible, version-bounded and temporary; it does not authorize privileged fork builds or claim a clean raw npm audit. CI resumes blocking on the deadline until the exception is removed or explicitly reviewed.
