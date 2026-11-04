# 0041: Separate Deployment Configuration From Runtime Settings

**Status:** Accepted
**Date:** 2026-11-03

## Context

Ticket #628 asks which environment values belong in app settings. Docker and host helpers need configuration before the backend can read SQLite, while monitoring policies are operator choices that can change during normal use. Ticket #643 also needs a portable settings boundary: the current settings table includes encrypted secrets, device identities and operational state alongside preferences.

## Decision

| Category | Authority |
| --- | --- |
| Ports, bind addresses, subnet/gateway, mounts, paths, GPIO access, timezone and shared-process ceilings | Deployment configuration; retain in `.env` |
| `APP_SECRET`, helper credentials and helper endpoints | Installation configuration; retain outside SQLite runtime settings |
| Hardware enablement and Compose profiles | Host agent/configuration, even when controlled through the app |
| Image references, manifests, release channel and update-agent state | Deployment/update configuration independent of the backend database |
| Minima monitoring and automatic-resync policy | SQLite app settings; implemented in this change |
| Retention policy | SQLite app settings with opt-in cleanup and reviewed previews in Storage & history (#857/#819; ADR 0022) |
| Camera retention | SQLite policy with reviewed file previews, optional-extension status, paused migration and protected proof media (ADR 0022; proof-media part of #861) |
| Session lifetimes | SQLite policy in Settings → Security, with current-credential confirmation and bounded session enforcement |
| Service URLs, executable names, debug flags and technical timeout/resource defaults | Built-in defaults with optional deployment overrides; no automatic requirement for UI controls |

Minima monitoring settings use one atomic settings document. Its first read, normally during backend startup, seeds valid legacy environment values once. Later environment edits do not override SQLite. Invalid or out-of-range legacy numeric values use the existing defaults with a warning; malformed stored settings fail validation rather than silently being replaced.

The admin API rejects non-numbers, fractions and out-of-range values, and saves the settings and actor/old/new audit event in one transaction. Health polling accepts 10–3600 seconds, stall detection 60–86400 seconds, and automatic-resync cooldown 1–10080 minutes. These are conservative operator guardrails against accidental high-frequency work or effectively unbounded delays, not measured performance limits. Defaults remain 60 seconds, 300 seconds, disabled automatic resync, and a 30-minute cooldown.

Changes apply without restarting Minima or the backend. A changed interval replaces the timer without immediately polling; other policy changes are read on the next use. Saving does not cancel or replay an existing resync, clear its reservation, reset the cooldown, or enable the separately disabled automatic node-restart feature.

Export eligibility is explicit and independent of storage location. A later #643 export must allowlist portable settings and resolve device/workflow dependencies (#230/#620). It must not dump the settings table or clone infrastructure values, local identities, sessions, `APP_SECRET`, helper credentials or wallet keys. Secret transfer and full device migration need their own encrypted design; history remains separate under ADR 0040.

Camera retention age can later be a portable preference, but resuming file deletion is a target-installation decision. A settings import must not copy an unpaused cleanup state or enable camera hardware.

**Session policy**

Maximum lifetime (1–30 days, default 7) and authenticated-request inactivity (1–168 hours, default 24) are a separate SQLite settings document. Legacy environment values seed once at startup/first use; invalid numeric bootstrap values use defaults and warn, while malformed stored settings fail closed. These ranges allow normal personal-device use without unlimited sessions or very frequent accidental lockouts. `COOKIE_SECURE`, cookie attributes, deployment secrets and sessions/tokens remain outside portable policy.

Inactivity continues to use server-side authenticated requests, including background polling. Browser interaction tracking would require a separate definition and cannot be silently substituted for the existing behavior. The UI explains that an open app can keep its inactivity deadline moving until absolute expiry.

Both policy routes are admin-only. Saves require the current credential through the existing five-failures/15-minute limiter. After asynchronous verification, the same credential hash, current admin role and valid caller session must still exist. The transaction removes sessions expired under the old policy before applying increases, clips stored expiries to the minimum of their current expiry and login time plus the new maximum, removes sessions expired under the new policy, saves policy and records an actor/old/new/count audit. Audit failure rolls back all changes. No credential or token enters the audit. A newly invalid caller receives success plus a cleared cookie and returns to login.

Shorter limits apply to current sessions. A longer maximum affects new logins without extending an existing or previously shortened absolute expiry; otherwise changing policy could unintentionally prolong a stolen cookie. Inactivity changes apply to remaining valid sessions, never restoring previously expired ones. Cookies are not refreshed during save: their original browser expiry remains an upper bound, while request validation and startup/hourly sweeps enforce the current server policy. Expiry is inclusive at the deadline; malformed session timestamps fail closed. A future settings import must use the same credential-confirmed policy boundary rather than restoring sessions or writing the setting directly.

## Alternatives considered

- Move every environment variable to SQLite: Docker and host processes would depend on a backend/database they help start.
- Keep environment overrides authoritative forever: an app save could appear successful while an older deployment value continued to win.
- Seed lazily without persisting defaults: an installation that never saved settings could change behaviour after an unrelated environment edit or reinstall.
- Export the whole settings table: it includes state and secrets that are not portable preferences.
- Extend current cookies or retain expired rows when increasing session limits: this could prolong or restore access through a stolen session. Existing absolute expiry remains an upper bound and already-expired rows are removed first.

## Consequences

Legacy environment inputs remain wired through Compose for migration compatibility, but new operators use Minima, Storage & history and Security settings. Changing environment values after migration has no effect. Restoring the same SQLite database retains policy; a new database starts from bootstrap values/defaults. Invalid monitoring/session bootstrap values use defaults and produce warnings; invalid/non-positive camera retention values mean keep until deleted. Camera migration always starts paused and needs a confirmed preview. This decision does not implement settings export, credential migration, or a general-purpose database editor.

## History

- 2026-11-03: Added credential-confirmed session policy, inclusive expiry and transactional existing-session enforcement without extending absolute expiries or restoring expired sessions.
- 2026-11-03: Moved camera retention to a separate SQLite document; retained optional camera enablement and helper configuration as deployment settings.
