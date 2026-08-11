# Session

Scratch log for the session in progress. Update it as you go; reset it when a session's work is done and merged. Not a changelog — see `CHANGELOG.md` for user-facing history.

## Progress

Branch `refactor/repalce-openssl-with-node`. (Previous log entries here were for earlier merged branches; reset below per this file's own reset-when-merged rule.)

- Replaced `install.sh`'s host-`openssl`-dependent Ed25519 manifest signature verification with a check run inside a disposable `node:20-bookworm-slim` container (`scripts/verify-manifest.mjs`), removing the previous silent "verification disabled" fallback on OpenSSL < 3.
- Merged `main` into this branch to pick up everything released as `0.33.0`/`0.34.0` since this branch diverged.
- Fixed brand logo assets (`es_logo/`) 404ing on Pi/Docker installs: `frontend/Dockerfile`'s build stage never `COPY`'d the `public/` directory into the build context, so Vite's build output (`dist/`) was missing it in the container image even though it worked in native dev. Added `COPY public ./public`; verified with a real `docker build`/`docker compose build` that `es-logo-white.svg` and siblings now land in `/usr/share/nginx/html/es_logo/`.

## Next Steps

- See `docs/TASKS.md` for outstanding manual-check items.

## Notes / Open Questions

- `frontend/src/app/brand.ts` and `frontend/src/app/names.ts` both export an identical `APP_NAME = "Edge Studio"` constant and are imported from different call sites — pre-existing duplication, not touched this session (out of scope; flagged here for whoever consolidates it).
