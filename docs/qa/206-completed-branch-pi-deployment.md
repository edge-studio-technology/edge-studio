# #206 completed branch: Pi deployment

**Date:** 2026-10-07

**Commit deployed:** `a7ddc75eccfe1550f5f342f4d291a2dbe3f4424c`

**Device:** Raspberry Pi 5, ARM64, `devpi5@192.168.0.108`

**Result:** Source rebuild and deployment passed; wallet-replacement compatibility issue found; final feature signoff remains open.

## Deployment and checks

- Transferred the clean feature branch as a Git bundle, updated the Pi's local bare repository, and ran this commit's installer with `DEV_MODE=true`, the feature branch as `APP_BRANCH`, and that repository as `APP_REPO_URL`.
- Backed up SQLite with its backup API and copied configuration to the root-only directory `/home/devpi5/edge-studio-206-backup-20261007-a7ddc75e`.
- Frontend and backend built from source on the Pi and were recreated successfully. Both report revision `a7ddc75e`, version `v0.42.2-dev+a7ddc75e`, and healthy status. Installer exit code was 0; Compose configuration validation passed.
- Minima and MQTT remained running. Existing app secret, host-agent token, data paths, and HTTPS port were preserved. SQLite `quick_check` passed.
- The previously empty address book automatically gained one `This device` contact, with one creation audit and no pending verification. Read-only compiled wallet discovery returned 64 receive addresses and confirmed that the selected address belongs to the current wallet. No test contacts were inserted.
- The HTTPS health endpoint returned `status: ok`. Playwright MCP rendered the login page at `https://192.168.0.108:8080/login`; authenticated feature interactions were not tested.

Installer log: `/home/devpi5/edge-studio-206-rebuild-a7ddc75e.log`.

## Protected-field UI follow-up (2026-10-07)

After the user reported active-looking name/address fields and a visible Remove action, confirmed that the deployed repository maps the actual app-created row to `isLocalDevice: true` and the served frontend contains the managed controls. The current code already omits Remove, but its read-only fields still accept focus and look enabled. Changed those two fields to disabled, using the existing disabled text/background/cursor styling. Notes remains enabled and focused. No backend behavior changed.

- Reproduced two failing disabled-state assertions before the fix. All 22 panel tests and `npm run check` passed (3,304 tests), as did both builds, Compose configuration, and diff checks.
- Playwright exercised the actual panel through a local Vite harness with isolated contact/preferences API fixtures. Confirmed hidden managed Remove, disabled name/address, grey disabled styling and `not-allowed` cursor, notes-only save, and ordinary-contact edit/remove controls. This was not an authenticated Pi test.
- Copied the verified modified source to the Pi, backed up the previous panel source, rebuilt both app images, and recreated only the frontend/backend services. Both images report `v0.42.2-dev+a7ddc75e.dirty` and revision `a7ddc75e-dirty`; the verified fix was subsequently committed locally, while these deployed image labels remain unchanged.
- Verified matching local/Pi source checksums, healthy services, HTTPS health, the login page, database integrity, and the original managed contact ID. Minima/MQTT remained running. Build log: `/home/devpi5/206-disabled-ui-build.log`.

The user's visible Remove action was not reproduced on the current code. Asked for the page URL and whether the row shows Local device; an older open tab is a possibility, not an established cause. Reload the updated frontend before repeating that check. No credentials or authenticated sessions were created.

## Compatibility issue and remaining verification

The deployed Minima image returns HTTP 200 with `status: false` and `error: "Command not found"` for the fixed read-only `checkrestore` RPC. The step 4 readiness helper consequently returns false. Normal automatic contact creation succeeds, but after an app-controlled wallet replacement the managed contact would remain pending and unavailable as a payment recipient until this compatibility issue is resolved.

No wallet replacement, payment, credential change, or authenticated browser test was performed. Resolve readiness verification against this deployed Minima version, then complete the [plan's manual acceptance checks](../plans/features/206-add-the-devices-own-node-address-to-the-addressbook-by-default.md) and user signoff using a disposable wallet for replacement tests.
