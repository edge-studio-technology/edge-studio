[← Back to index](./README.md)

# Phase 3 — Session lifecycle

**Status: done** (2026-09-09).

**Covers:** [9], GAP-08, GAP-17.

TOTP remains present for this branch, so session invalidation covers both existing credential-change
paths. There is no sequencing dependency on a TOTP product decision or removal branch.

`deleteAllUserSessions` already exists in both repository and service layers and is already
unit-tested; it has zero production call sites.

1. Wire it into `changePassword` and `verifyTotpReset` in `backend/src/features/auth/auth.service.ts`.
2. Policy (decided in the archived high-risk plan, carried forward): revoke every session including
   the caller's, and require a fresh login. Keeping the current session alive would first require
   extending the service/route contract so the current token can be identified explicitly.
3. **Clear the caller's cookie on the way out of both credential-change routes.** Neither returns
   anything that touches the cookie today — only `/logout` calls `res.clearCookie`
   (`auth.routes.ts:34`). Deleting the session row without clearing the cookie leaves the browser
   presenting a dead session and collecting 401s on its next call instead of landing on the login
   screen. Reuse `sessionCookieOptions`, and check the frontend routes to login after password
   change and TOTP reset rather than showing a stale shell.
4. GAP-08: `deleteExpiredSessions()` exists but is never scheduled. Start it from
   `backend/src/index.ts` after migrations, same pattern as the other schedulers.

**Tests:** extend `backend/tests/features/auth/auth.service.test.ts` and the session/route suites —
invalidation on both credential paths, the cleared `Set-Cookie` on both route responses,
the audit events, and the current-session policy.

**How it landed.** `changePassword` and `verifyTotpReset` call `deleteAllUserSessions` after the
credential is written, so a rejected change leaves sessions alone. Both routes then
`res.clearCookie` with a new `sessionClearCookieOptions()` — the same attributes as
`sessionCookieOptions()` minus `maxAge`, which Express would otherwise turn back into a future
`Expires` and defeat the clear; `/logout` uses the same helper instead of its own literal. The
routes return `sessionsRevoked: true`; the frontend shows the confirmation, then signs out after a
short delay so the login screen replaces the shell. The TOTP "Reset again" button went with it — it
could only ever 401 after revocation.

`startSessionCleanupScheduler()` lives in `session.service.ts` and is started from `index.ts` after
migrations: one sweep immediately, then hourly. It runs `deleteExpiredSessions()` as-is, which
matches on absolute expiry only — sessions past the *idle* timeout but not past absolute expiry are
still reaped by `validateSession` on next use, and are recorded as a residual in
`docs/security/auth-and-transport.md` rather than widened here.

No new audit action was added: `settings.password_changed` and `settings.totp_reset` already record
the events that cause revocation, and revocation is now unconditional on those paths.
