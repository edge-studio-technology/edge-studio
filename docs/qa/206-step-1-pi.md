# #206 step 1: Pi verification

**Date:** 2026-10-06

**Commit tested:** `39e5ccd3`

**Device:** Raspberry Pi 5, ARM64, `devpi5@192.168.0.108`

**Result:** Deployment and live backend foundation checks passed; authenticated browser checks pending.

## Deployment

- Committed the separate app-owned contact foundation on `task/206-add-the-devices-own-node-address-to-the-addressbook-by-default`.
- Transferred that commit as a Git bundle and created a branch in a local bare repository on the Pi. Ran this branch's installer with `DEV_MODE=true`, the feature branch as `APP_BRANCH`, and the local repository as `APP_REPO_URL`; no remote branch push was needed.
- Backed up SQLite using its backup API and copied the existing configuration to `/home/devpi5/edge-studio-206-backup`, restricted to root. Wallet data was retained by the installer.
- Both images reported revision `39e5ccd` and version `v0.42.2-dev+39e5ccd`. Backend and frontend were healthy. The release update agent was removed by the existing DEV_MODE installer behavior; Minima and MQTT stayed running.
- A brief connection outage did not interrupt the Pi-side installer; reconnected and confirmed successful completion.

## Checks

| Check | Result |
| --- | --- |
| Upgrade the previous release's globally unique address-book schema | Passed; ordinary-contact-only address index and single-local-marker index present. |
| Preserve existing manual contacts | Passed; two temporary contacts inserted before upgrade retained their IDs, labels, addresses, notes, timestamps, and ordinary marker. One was named `This device`; the other used the same destination's hex representation. |
| Parse the deployed Minima `scripts` response | Passed using the compiled parser inside the running backend; 65 script rows, including 64 valid default/simple wallet receive addresses. Only public address/flag fields were retained for evidence. |
| Create a separate app contact sharing an exact manual address | Passed by invoking the compiled repository helper with a real wallet destination already present in the manual fixture. Manual rows were unchanged. |
| Skip an existing app contact | Passed with the full address pool, an invalid candidate, and an empty pool. Exactly one marked contact remained. |
| Repeat migrations | Passed; managed identity and manual fields remained stable. |
| Restart backend | Passed; contacts survived startup migration, and the compiled check/create helper returned the existing contact without changes. |
| Playwright MCP setup | Passed; configured Microsoft's `@playwright/mcp@0.0.83` in Codex with cached Chromium, headless isolated context, and acceptance of the Pi's self-signed HTTPS certificate. Connected through the MCP SDK and exercised browser navigation, snapshots, and screenshots. |
| Render Pi login page | Passed at `https://192.168.0.108:8080/login`; the unauthenticated `/api/auth/me` returned the expected 401. |
| Authenticated contact create/edit/delete in browser | Pending app password/PIN or explicit authorization to create a temporary session. Automatic approval review rejected session creation outside normal login; that action did not run. |

The repository helper was invoked manually for testing. Step 1 has no automatic initializer or managed-contact mutation guards, and its frontend has no local-contact identity/protection UI. These checks do not establish acceptance for steps 2–4. No payments, wallet replacement, or reroll were performed.

## Cleanup and remaining work

Removed the three QA contacts and confirmed the address book returned to its original empty state. No temporary admin session was created, and existing credentials were unchanged. Left the healthy DEV_MODE branch build installed; retained the backup for recovery. Temporary tooling, scripts, and browser evidence are under `/tmp/edge-studio-206-pi-qa` on the development machine; the Pi installer log is `/home/devpi5/edge-studio-206-install.log`.

Finish authenticated Playwright contact CRUD checks after resolving login access. Automatic creation, protection, identity UI, and wallet-replacement policy remain in the [implementation plan](../plans/features/206-add-the-devices-own-node-address-to-the-addressbook-by-default.md). Reroll is explicitly out of scope.
