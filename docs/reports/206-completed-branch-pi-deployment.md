# #206 Pi verification summary

**Date:** 2026-10-07 · **Device:** Raspberry Pi 5, ARM64 (`192.168.0.108`)
**Current build:** `v0.42.2-dev+ef54f4ec.readiness.dirty`, frontend/backend rebuilt from source with the uncommitted compatibility fix.
**Result:** Installation, contact flows, and live wallet replacement passed; awaiting user signoff.

## Verified

- Automated verification: full check passed 3,326 tests, typechecks, coverage thresholds, and dependency audits; production builds and Compose configuration passed.
- Upgrade: legacy-schema migration preserved manual contacts, metadata, IDs, and references; repeat migrations and separate same-address managed contact creation passed. Source rebuilds preserved saved data/configuration.
- Clean installation: removed the old app/database and unfunded Minima wallet with user authorization, then reinstalled in `/opt/edge-studio`. First-run PIN setup and user-approved Integritas Connect completed. App services are healthy; hardware options use installer defaults (disabled).
- Initialization: one wallet-owned contact appeared before opening Wallet, named `1b0b70092842` to match the dashboard device. Backend and node restarts retained the same ID/address/name, with one creation audit and no duplicates.
- Authenticated Playwright on the real Pi: name/notes edits persisted, empty names were rejected, Local device identity remained visible, address was disabled, and Remove was absent. Direct address PATCH and DELETE returned structured 409 responses.
- Ordinary contacts: a separate contact sharing the managed address could be added, edited, and deleted. Test entries were removed and original/default contact values restored. SQLite integrity passed.

- Wallet replacement (headless Playwright, real app backup/restore API): same-wallet restore retained the contact/address with no replacement audit; a different unfunded wallet changed only the managed address and recorded one old/new audit. ID/name/notes/manual copy survived. Pending payments returned 409, the manual copy retained ordinary amount validation, and protection survived a backend restart. Read-only discovery confirmed ownership after recovery.
- Cleanup restored the original wallet and contact name/notes, removed the manual fixture, encrypted backups/password, and temporary wallet container/data. The return restore required a manual Minima restart after databases were saved because peer threads delayed exit; pending protection held until restart. Two address-change audits remain for the round trip. The recovered recipient selector shows Local device and requires explicit selection.

The ordinary-contact menu was outside Playwright's default viewport during one run; reopening it at 1440×1000 allowed the flow to complete. No alignment changes were made.

Historical QA backups and temporary source files were removed after explicit approval; no second app/wallet directory remains. Small logs remain, including `/home/devpi5/206-clean-install.log`.

## Remaining

The missing-`checkrestore` blocker is resolved: legacy nodes require a start after the persisted dispatch time, successful unlocked status, and validated wallet addresses. Readiness remains blocked before restart or on unavailable/malformed signals.

Live replacement checks used encrypted backups through `restoresync`; seed/console mutation paths and send/workflow races have automated coverage. No valid payment or workflow was executed. Commit the verified fix and obtain user signoff before merging.
