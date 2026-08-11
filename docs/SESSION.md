# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

Branch `refactor/repalce-openssl-with-node`. (Previous log entries here were for earlier merged branches; reset below per this file's own reset-when-merged rule.)

- Replaced `install.sh`'s host-`openssl`-dependent Ed25519 manifest signature verification with a check run inside a disposable `node:20-bookworm-slim` container (`scripts/verify-manifest.mjs`), removing the previous silent "verification disabled" fallback on OpenSSL < 3.
- Merged `main` into this branch to pick up everything released as `0.33.0`/`0.34.0` since this branch diverged.

## Next Steps

- See `docs/TASKS.md` for outstanding manual-check items.

## Notes / Open Questions

- `frontend/src/app/brand.ts` and `frontend/src/app/names.ts` both export an identical `APP_NAME = "Edge Studio"` constant and are imported from different call sites — pre-existing duplication, not touched this session (out of scope; flagged here for whoever consolidates it).
