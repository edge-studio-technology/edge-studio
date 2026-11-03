# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

- Added `install.sh --advanced` with terminal prompts for seven host ports, saved-value defaults, numeric/duplicate validation, and early TCP/Docker conflict checks that recognize the existing installation's containers and systemd helpers.
- Updated installation instructions, network security documentation, and the changelog; added regression tests for arguments, prompts, persistence, preflight ordering, Docker ownership, helper socket ownership, and occupied ports.
- Verified focused installer tests, shell syntax, lint/docs, Knip, typechecks, all three application builds, and Compose configuration. `npm run check` stopped at the already-tracked Minima backup-restore fallback test (502 versus 200; 1,424 backend tests passed). Existing release-trust/version script tests also hit Windows line-ending/path/POSIX mock limitations.

## Next Steps

- Verify a fresh piped advanced install and an installer rerun on a Pi, including enabled optional helpers and an occupied default port.

## Notes / Open Questions

- Port preflight requires Python 3 before package installation; missing Python or an unavailable existing Docker daemon produces an actionable error. Ports are not reserved between preflight and startup.
