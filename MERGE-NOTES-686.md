# Merge notes: #686 dead code cleanup

Temporary note. Delete this file once every open branch has merged `dev`.

#686 removed code that nothing in the UI or CLI used. Branches cut from `dev` before it can bring that code back during a merge, often without a conflict. When you merge `dev` into your branch, keep the removals. Full reasoning: `docs/adr/0036-remove-dead-code-and-unused-features.md`. Per-step details: `docs/plans/features/686-clean-out-dead-code-and-business-logic.md`.

## Removed

- **TOTP / two-factor login:** all routes, the setup wizard step, `otpauth`, `users.totp_secret`, and the `setup_pending` table.
- **Custom token creation:** `/api/tokens/*`, the create modal, the Assets tab, and the `custom_tokens` table.
- **Seed phrase import:** `POST /api/wallet/import` and `WalletSettingsPanel`.
- **Debug routes:** `/api/debug/*` and `POST /api/wallet/debug/clear-wallet-history`.
- **File browser API:** `/api/files`. The read-only host-files mount stays.
- **Unused API routes:**
  - Integritas `POST /hash`, `/stamp`, `/status`, `/verify`, and `/history/:id/poll`.
  - `GET /api/minima/balance`.
  - `GET /api/wallet/payment-status/:txpowid`.
  - `GET /api/automation/runs/:id`.
  - `POST /api/feedback/retry-pending`.
  - `GET /api/host-capabilities/{camera,gpio,sensors,mqtt}`.
- **`/setup` page:** the onboarding wizard replaces it.
- **Unused frontend files:** `SidebarUserBox`, `ReceiveQrPanel`, `add-device-classic/`, `AltDevicePicker`, `altDeviceOptions`, `AltOptionCard`, `OptionCard`, `CopyField`, `ListDisclosure`, `lib/paths`, and the flat `components/LoadingDots.tsx` shim. `components/ui/LoadingDots` stays.

## When you merge `dev`

1. **"Deleted in dev, modified in HEAD" conflict:** keep the deletion with `git rm <file>`. Move any change you still need into the code that replaced it.
2. **`app.ts`, `database.ts` or router conflict:** don't take your whole side. That re-adds the removed routes and tables.
3. **Check for returned code:** after the merge, search for `totp`, `custom_tokens`, `tokensRouter`, `importWallet`, `debugRouter`, `filesRouter`, and `SetupPage`. Hits in the `runMigrations()` drop statements in `backend/src/db/database.ts`, or in docs, are expected. Anything else is removed code coming back.
4. **Run `npm run check`.** A call to removed code fails the type check. Its knip step also fails on any unused file or export that came back.

Bringing any of this back needs a new product decision and ADR, not a revert. The database drops these tables and the column on every startup, so re-adding TOTP or tokens also needs a new migration.
