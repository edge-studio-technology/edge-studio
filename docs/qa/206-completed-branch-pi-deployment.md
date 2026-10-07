# #206 Pi verification summary

**Date:** 2026-10-07 · **Device:** Raspberry Pi 5, ARM64 (`192.168.0.108`)
**Current build:** `v0.42.2-dev+eb237911`, installed from committed source with DEV_MODE=true.
**Result:** Installation and contact flows passed; wallet-replacement signoff remains open.

## Verified

- Automated verification: full check passed 3,308 tests, typechecks, coverage thresholds, and dependency audits; production builds and Compose configuration passed.
- Upgrade: legacy-schema migration preserved manual contacts, metadata, IDs, and references; repeat migrations and separate same-address managed contact creation passed. Source rebuilds preserved saved data/configuration.
- Clean installation: removed the old app/database and unfunded Minima wallet with user authorization, then reinstalled in `/opt/edge-studio`. First-run PIN setup and user-approved Integritas Connect completed. App services are healthy; hardware options use installer defaults (disabled).
- Initialization: one wallet-owned contact appeared before opening Wallet, named `1b0b70092842` to match the dashboard device. Backend and node restarts retained the same ID/address/name, with one creation audit and no duplicates.
- Authenticated Playwright on the real Pi: name/notes edits persisted, empty names were rejected, Local device identity remained visible, address was disabled, and Remove was absent. Direct address PATCH and DELETE returned structured 409 responses.
- Ordinary contacts: a separate contact sharing the managed address could be added, edited, and deleted. Test entries were removed and original/default contact values restored. SQLite integrity passed.

The ordinary-contact menu was outside Playwright's default viewport during one run; reopening it at 1440×1000 allowed the flow to complete. No alignment changes were made.

Historical QA backups and temporary source files were removed after explicit approval; no second app/wallet directory remains. Small logs remain, including `/home/devpi5/206-clean-install.log`.

## Remaining

The deployed Minima image rejects `checkrestore` with `Command not found`. After an app-controlled wallet replacement, the current readiness helper would leave the contact pending and unavailable for payment. Resolve compatibility, then verify same/different-wallet replacement, pending recovery, and recipient behavior against the [manual acceptance checks](../plans/features/206-add-the-devices-own-node-address-to-the-addressbook-by-default.md).

No live wallet replacement, payment, or workflow execution was tested. Final feature signoff remains open.
