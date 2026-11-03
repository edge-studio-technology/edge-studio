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
| Retention policy and camera retention | App-setting candidates; retention API/UI stays with #857/#819, camera retention needs a separate change coordinated with #861 |
| Session lifetimes | Potential advanced admin settings requiring their own policy review |
| Service URLs, executable names, debug flags and technical timeout/resource defaults | Built-in defaults with optional deployment overrides; no automatic requirement for UI controls |

Minima monitoring settings use one atomic settings document. Its first read, normally during backend startup, seeds valid legacy environment values once. Later environment edits do not override SQLite. Invalid or out-of-range legacy numeric values use the existing defaults with a warning; malformed stored settings fail validation rather than silently being replaced.

The admin API rejects non-numbers, fractions and out-of-range values, and saves the settings and actor/old/new audit event in one transaction. Health polling accepts 10–3600 seconds, stall detection 60–86400 seconds, and automatic-resync cooldown 1–10080 minutes. These are conservative operator guardrails against accidental high-frequency work or effectively unbounded delays, not measured performance limits. Defaults remain 60 seconds, 300 seconds, disabled automatic resync, and a 30-minute cooldown.

Changes apply without restarting Minima or the backend. A changed interval replaces the timer without immediately polling; other policy changes are read on the next use. Saving does not cancel or replay an existing resync, clear its reservation, reset the cooldown, or enable the separately disabled automatic node-restart feature.

Export eligibility is explicit and independent of storage location. A later #643 export must allowlist portable settings and resolve device/workflow dependencies (#230/#620). It must not dump the settings table or clone infrastructure values, local identities, sessions, `APP_SECRET`, helper credentials or wallet keys. Secret transfer and full device migration need their own encrypted design; history remains separate under ADR 0040.

## Alternatives considered

- Move every environment variable to SQLite: Docker and host processes would depend on a backend/database they help start.
- Keep environment overrides authoritative forever: an app save could appear successful while an older deployment value continued to win.
- Seed lazily without persisting defaults: an installation that never saved settings could change behaviour after an unrelated environment edit or reinstall.
- Export the whole settings table: it includes state and secrets that are not portable preferences.

## Consequences

Legacy environment inputs remain wired through Compose for migration compatibility, but new operators use Minima settings. Changing environment values after migration has no effect. Restoring the same SQLite database retains monitoring policy; a new database starts from bootstrap values/defaults. Existing legacy values outside the documented ranges are replaced with defaults and reported in backend logs. This decision does not implement settings export, retention controls, credential migration, or a general-purpose database editor.
