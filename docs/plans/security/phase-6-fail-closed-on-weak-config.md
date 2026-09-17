[← Back to index](./README.md)

# Phase 6 — Fail closed on weak config

**Status:** Split. Finding [12] is implemented by task 704; finding [6] remains a separate image-pinning task.

**Covers:** [12], [6], GAP-04.

The original phase coupled two independent changes. The `APP_SECRET` work is now owned by
[task 704](./704-fail-closed-on-weak-config.md), with the reduced scope and compatibility decision
recorded in [ADR 0021](../../adr/0021-app-secret-fail-closed-without-migration.md):

- Remove every shipped `dev-change-me` default.
- Refuse backend startup when `APP_SECRET` is absent or empty, before database or background work.
- Keep `install.sh` unchanged because it already generates a random value and preserves upgrades.
- Accept any deliberately supplied non-empty value; do not add a migration or development bypass.

Digest-pinning `minimaglobal/minimacore`, `eclipse-mosquitto:2`, `minimaglobal/minima:dev`, and
`alpine:3.20` remains open as a separate task. It shares no implementation or release dependency
with the startup guard.

Task 704 carries its focused automated, Docker, and upgrade verification checklist. The separate
pinning task must verify both checked-in and generated Compose artifacts and document the pin-bump
procedure.
