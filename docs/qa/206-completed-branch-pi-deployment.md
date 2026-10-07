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

## Editable-name follow-up (2026-10-07)

The user approved editable name/notes and a one-time dashboard-hostname default for newly created contacts. Existing names remain unchanged. Manual address changes, deletion, and marker changes remain protected; the managed address is visibly disabled and Remove is hidden even after renaming.

- Reproduced four backend and two frontend failures before implementation; 65 focused backend/190 frontend tests and full check passed (3,308 tests), with typechecks, coverage thresholds, clean audits, both builds, and Compose. Tests cover new hostname defaults, existing This device/custom names after hostname changes, validated rename/notes requests, invalid names, protected mixed requests, and name preservation during wallet replacement.
- Local Playwright fixtures exercised the actual panel: changed This device to Workshop Pi, saved only name/notes, retained Local device identity and hidden Remove, kept the address disabled, and preserved ordinary contact controls. A menu-presence check initially raced React rendering; waiting for the menu confirmed the expected ordinary actions.
- Backed up backend source files, transferred the three changed production files, and rebuilt/recreated frontend/backend in DEV_MODE. Build log: `/home/devpi5/206-editable-name-build.log`; exit code 0. Both images are healthy and labeled `v0.42.2-dev+a7ddc75e.rename.dirty`; this naming revision was subsequently committed locally.
- Verified all three local/Pi source checksums and HTTPS health. The existing local contact retained ID `613c09bf-848d-49ae-b896-ef2a2bbacb73`, label This device, and ready state; the new backend container's dashboard hostname is `cc6ff6d5605c`. No existing contact was renamed automatically. Minima/MQTT stayed running.

No schema migration, authenticated Pi rename/delete attempt, wallet replacement, or payment was performed. Existing contacts can now be renamed manually; the default hostname applies only to a newly created managed contact.

## Committed-source rebuild (2026-10-07)

Committed the naming revision as `90c38ead1a07cb22141882a272e1616a4a53a1af`, transferred it as a Git bundle, and reran that commit's installer with DEV_MODE=true and the feature branch/local bare source repository. Both app images were built from source; installer exit code was 0. Installed Git HEAD matches the commit, both image revisions are `90c38ead`, and both healthy services report `v0.42.2-dev+90c38ead`, replacing the dirty build labels.

Backed up SQLite/configuration to `/home/devpi5/edge-studio-206-backup-90c38ead`. Compared all saved fields of both contacts against the pre-install snapshot; names, notes, IDs, addresses, timestamps, and markers were unchanged. APP_SECRET, host-agent token, data paths, and frontend port remained unchanged. DEV_MODE=true, SQLite quick_check, and HTTPS health passed. Minima/MQTT stayed running. Installer log: `/home/devpi5/206-90c38ead-install.log`. No authenticated browser mutations, wallet replacement, or payments ran.

## Authenticated live contact-flow check (2026-10-07)

Used a visible Playwright-controlled Linux Chromium window on WSL against the real Pi at `https://192.168.0.108:8080`, logged in through the normal UI with user-provided credentials, and confirmed served version `v0.42.2-dev+90c38ead`. No API fixtures or authentication bypass were used.

- Managed contact: Remove absent, address disabled, name/notes enabled. Renamed to a temporary QA name and added notes; both persisted after reload, with the same ID/address/marker and visible Local device pill. Restored the original name/notes through the UI.
- Ordinary contact: created a temporary contact sharing the managed address, confirmed Remove and editable address, changed its name/address/notes, and deleted it through the confirmation dialog. The existing user-created contact was not edited.
- Authenticated direct PATCH of the managed address and DELETE both returned structured 409 responses. Compared all returned fields of both original contacts before/after; contents matched exactly and no temporary contact remained. Contact-row restoration does not undo audit history from these actions.
- Playwright's ordinary-contact Edit click initially timed out with the menu outside the viewport at the default window size. Enlarging the viewport to 1440×1000 and reopening the menu allowed the normal click and remaining flow to complete. Recorded as a positioning observation; no UI changes were made.

Wallet replacement, pending recovery, payments, and workflow recipient behavior were not exercised in this check. The missing-checkrestore compatibility issue below still prevents final feature signoff.

## Compatibility issue and remaining verification

The deployed Minima image returns HTTP 200 with `status: false` and `error: "Command not found"` for the fixed read-only `checkrestore` RPC. The step 4 readiness helper consequently returns false. Normal automatic contact creation succeeds, but after an app-controlled wallet replacement the managed contact would remain pending and unavailable as a payment recipient until this compatibility issue is resolved.

Authenticated contact CRUD/protection checks passed as recorded above. No wallet replacement, payment, or credential change was performed. Resolve readiness verification against this deployed Minima version, then complete the [plan's manual acceptance checks](../plans/features/206-add-the-devices-own-node-address-to-the-addressbook-by-default.md) and user signoff using a disposable wallet for replacement tests.
