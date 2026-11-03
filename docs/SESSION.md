# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

- Added a Keep data / Delete data toggle to Settings uninstall instructions; the command and explanation change together, deletion includes `bash -s -- --delete-data`, and switching modes resets copy feedback. Verified both copied commands with a UI regression test; all three Settings tests, frontend lint/build, and docs checks passed.
- Added a terminal-only `uninstall.sh` with keep-data defaults, typed deletion confirmation, dry-run previews, installation ownership checks, graceful container stops, optional legacy-firewall cleanup, and configuration retention for retries/external data.
- Added Settings → App uninstall instructions using the shared copyable command control; included the local uninstaller in runtime bundles and documented retained paths, reinstall behavior, security boundaries, and host-agent lifecycle decisions in ADR 0019.
- Verified the uninstaller's 14 Python regression cases through the scripts test runner, focused installer/Settings tests, shell syntax, lint/docs, Knip/typechecks, the frontend build, Compose configuration, and a runtime-bundle build containing `uninstall.sh`. The full check stopped at the existing Minima restore test (502 versus 200; 1,424 backend tests passed).
- Added `install.sh --advanced` with terminal prompts for seven host ports, saved-value defaults, numeric/duplicate validation, and early TCP/Docker conflict checks that recognize the existing installation's containers and systemd helpers.
- Updated installation instructions, network security documentation, and the changelog; added regression tests for arguments, prompts, persistence, preflight ordering, Docker ownership, helper socket ownership, and occupied ports.
- Verified focused installer tests, shell syntax, lint/docs, Knip, typechecks, all three application builds, and Compose configuration. `npm run check` stopped at the already-tracked Minima backup-restore fallback test (502 versus 200; 1,424 backend tests passed). Existing release-trust/version script tests also hit Windows line-ending/path/POSIX mock limitations.

## Next Steps

- Verify uninstall on a disposable Pi installation: keep-data removal and reinstall, internal-data deletion, custom helper ports/subnet, external data, cancellation, and partially removed installations. No Pi services or data were changed during implementation.
- Verify a fresh piped advanced install and an installer rerun on a Pi, including enabled optional helpers and an occupied default port.

## Notes / Open Questions

- Port preflight requires Python 3 before package installation; missing Python or an unavailable existing Docker daemon produces an actionable error. Ports are not reserved between preflight and startup.
